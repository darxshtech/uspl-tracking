import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { calculateHoursDifference, formatHoursAndMinutes, getCurrentISTTime12 } from "@/lib/timeUtils";
import { getFullDayHours } from "@/lib/settings";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employee_id");
    const month = searchParams.get("month"); // '01' to '12'
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    // Auto-mark missing check-ins as Absent for working days since system start (1 Aug 2026)
    const SYSTEM_START_DATE = "2026-08-01";
    const todayIST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });

    // Fast path: Only run cleanup/sync if not recently synchronized
    const g = globalThis as any;
    if (g._lastManageSync === undefined || Date.now() - g._lastManageSync > 30 * 60 * 1000) {
      g._lastManageSync = Date.now();
      try {
        await pool.query(
          "DELETE FROM attendance WHERE user_id IN (SELECT id FROM users WHERE role IN ('CEO', 'Admin')) AND (status = 'Absent' OR notes LIKE 'Auto-marked%')"
        );

        const [employees]: any = await pool.query("SELECT id FROM users WHERE role NOT IN ('CEO', 'Admin') AND is_active = 1");
        if (employees && employees.length > 0) {
          const [holidayRows]: any = await pool.query(
            "SELECT DATE_FORMAT(date, '%Y-%m-%d') as hol_date FROM holidays WHERE date <= ?",
            [todayIST]
          );
          const holidayDates = new Set<string>(holidayRows.map((h: any) => h.hol_date));
          const dates: string[] = [];
          const cur = new Date(todayIST + "T00:00:00Z");
          for (let i = 0; i < 30; i++) {
            const dStr = cur.toISOString().split("T")[0];
            if (dStr < SYSTEM_START_DATE) break;
            const [y, m, d] = dStr.split("-");
            const dt = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)));
            if (dt.getUTCDay() !== 0 && !holidayDates.has(dStr)) dates.push(dStr);
            cur.setUTCDate(cur.getUTCDate() - 1);
          }

          if (dates.length > 0) {
            const minDate = dates[dates.length - 1];
            const [existingRows]: any = await pool.query(
              "SELECT user_id, DATE_FORMAT(date, '%Y-%m-%d') as date_str FROM attendance WHERE date >= ? AND date <= ?",
              [minDate, todayIST]
            );
            const existingSet = new Set<string>();
            existingRows.forEach((r: any) => existingSet.add(`${r.user_id}:${r.date_str}`));

            const insertValues: any[] = [];
            for (const emp of employees) {
              for (const dStr of dates) {
                if (!existingSet.has(`${emp.id}:${dStr}`)) {
                  insertValues.push([
                    emp.id,
                    dStr,
                    "Absent",
                    0,
                    "Auto-marked Absent (No Check-In or Leave Application)"
                  ]);
                }
              }
            }

            if (insertValues.length > 0) {
              await pool.query(
                "INSERT IGNORE INTO attendance (user_id, date, status, total_hours, notes) VALUES ?",
                [insertValues]
              );
            }
          }

          await pool.query(
            "UPDATE attendance SET status = 'Present' WHERE login_time IS NOT NULL AND status = 'Absent'"
          );
        }
      } catch (syncErr) {
        console.warn("Manage sync notice:", syncErr);
      }
    }

    let query = `
      SELECT a.*, u.name as employee_name, u.email as employee_email, u.role as employee_role
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE u.role NOT IN ('CEO', 'Admin') AND a.date >= ?
    `;
    let params: any[] = [SYSTEM_START_DATE];

    if (employeeId && employeeId !== "ALL") {
      query += " AND a.user_id = ?";
      params.push(employeeId);
    }

    if (month && month !== "ALL") {
      query += " AND DATE_FORMAT(a.date, '%m') = ?";
      params.push(month);
    }

    if (year) {
      query += " AND DATE_FORMAT(a.date, '%Y') = ?";
      params.push(year);
    }

    query += " ORDER BY a.date DESC, u.name ASC";

    const [rows] = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: PM, CEO or Admin role required" }, { status: 403 });
  }

  const managerName = (session.user as any)?.name || (session.user as any)?.role || "Management";

  try {
    const body = await req.json();
    const { id, login_time, logout_time, status, total_hours: manualHours, override_full_day, notes: customNotes } = body;

    if (!id) {
      return NextResponse.json({ error: "Attendance record ID is required" }, { status: 400 });
    }

    const fullDayHours = await getFullDayHours();
    const halfDayThreshold = fullDayHours / 2;

    // Auto-calculate total hours based on in time and out time or current time, or use override
    let finalHours = manualHours !== undefined && manualHours !== "" && manualHours !== null ? parseFloat(manualHours) : null;

    if (override_full_day) {
      finalHours = fullDayHours;
    } else if (finalHours === null && login_time) {
      const endTime = logout_time || getCurrentISTTime12();
      finalHours = calculateHoursDifference(login_time, endTime);
    }

    let computedStatus = status || "Present";

    if (override_full_day) {
      computedStatus = "Present";
    } else {
      // If login_time is provided and shift is active (no logout_time), ensure status is not left as Absent
      if (login_time && !logout_time && (computedStatus === "Absent" || !status)) {
        computedStatus = "Present";
      }

      // If shift is closed with logout_time and not a special leave/holiday, strictly enforce working hours status
      if (logout_time && finalHours !== null && (!status || status === "Present" || status === "Half Day" || status === "Absent")) {
        if (finalHours < halfDayThreshold) {
          computedStatus = "Absent";
        } else if (finalHours < fullDayHours) {
          computedStatus = "Half Day";
        } else {
          computedStatus = "Present";
        }
      }
    }

    // Fetch existing attendance record to preserve punch times if not supplied
    const [existingAttRows]: any = await pool.query(
      "SELECT id, user_id, date, login_time, logout_time, total_hours, notes FROM attendance WHERE id = ?",
      [id]
    );

    if (existingAttRows.length === 0) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    const currentRecord = existingAttRows[0];
    const finalLoginTime = login_time !== undefined ? login_time : currentRecord.login_time;
    const finalLogoutTime = logout_time !== undefined ? logout_time : currentRecord.logout_time;

    const overrideNote = override_full_day ? ` [Overridden to Full Day by ${managerName}]` : "";
    
    await pool.query(
      `UPDATE attendance 
       SET login_time = ?, logout_time = ?, status = ?, total_hours = ?, notes = CONCAT(IFNULL(notes, ''), ?)
       WHERE id = ?`,
      [
        finalLoginTime || null, 
        finalLogoutTime || null, 
        computedStatus, 
        finalHours !== null ? finalHours.toFixed(2) : null,
        overrideNote,
        id
      ]
    );

    // Get user ID and date for notification
    const [attRows]: any = await pool.query(
      "SELECT a.user_id, a.date, u.name as employee_name FROM attendance a JOIN users u ON a.user_id = u.id WHERE a.id = ?",
      [id]
    );

    if (attRows.length > 0) {
      const record = attRows[0];
      const recordDate = new Date(record.date).toLocaleDateString();

      const notifTitle = override_full_day 
        ? "🌟 Attendance Overridden to Full Day" 
        : "Attendance Record Updated by Management";

      const notifMsg = override_full_day
        ? `Your shift on ${recordDate} was approved as a FULL DAY (${fullDayHours} hrs) by ${managerName}.`
        : `Your attendance for ${recordDate} was updated by Management (${computedStatus}, ${formatHoursAndMinutes(finalHours)}).`;

      await pool.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
        [record.user_id, notifTitle, notifMsg]
      );
    }

    return NextResponse.json({
      success: true,
      message: override_full_day ? "Half-day successfully overridden to full day." : "Attendance updated successfully",
      total_hours: finalHours,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: PM, CEO or Admin role required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { 
      user_id, 
      start_date, 
      end_date, 
      selected_dates, 
      date, 
      status = "Present", 
      login_time, 
      logout_time, 
      total_hours, 
      reason, 
      remarks 
    } = body;

    if (!user_id) {
      return NextResponse.json({ error: "Employee selection is required" }, { status: 400 });
    }

    let datesToProcess: string[] = [];

    if (Array.isArray(selected_dates) && selected_dates.length > 0) {
      datesToProcess = selected_dates;
    } else if (start_date || date) {
      const startDateStr = start_date || date;
      const endDateStr = end_date || startDateStr;
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      const cur = new Date(start);
      while (cur <= end) {
        datesToProcess.push(cur.toISOString().split("T")[0]);
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      return NextResponse.json({ error: "Date selection is required" }, { status: 400 });
    }

    datesToProcess.sort();
    const minDate = datesToProcess[0];
    const maxDate = datesToProcess[datesToProcess.length - 1];

    // Fetch scheduled holidays in this range
    const [holidayRows]: any = await pool.query(
      "SELECT DATE_FORMAT(date, '%Y-%m-%d') as hol_date FROM holidays WHERE date BETWEEN ? AND ?",
      [minDate, maxDate]
    );
    const holidayDates = new Set<string>(holidayRows.map((h: any) => h.hol_date));

    // Determine default in/out times and duration based on status
    const fullDayHours = await getFullDayHours();
    let defaultIn = login_time || null;
    let defaultOut = logout_time || null;
    let defaultDuration = total_hours !== undefined && total_hours !== null && total_hours !== "" ? parseFloat(total_hours) : 0;

    if (status === "Present") {
      if (!defaultIn) defaultIn = "09:30:00 AM";
      if (!defaultOut) defaultOut = "06:30:00 PM";
      if (!defaultDuration) defaultDuration = fullDayHours;
    } else if (status === "Half Day") {
      if (!defaultIn) defaultIn = "09:30:00 AM";
      if (!defaultOut) defaultOut = "02:00:00 PM";
      if (!defaultDuration) defaultDuration = fullDayHours / 2;
    }

    let insertedCount = 0;
    let excludedCount = 0;

    for (const curDateStr of datesToProcess) {
      const [yearStr, monthStr, dayStr] = curDateStr.split("-");
      const dateObj = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr)));
      const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday

      // Skip Sunday weekly offs and company holidays for leaves
      if ((status.includes("Leave") || status === "Half Day") && (dayOfWeek === 0 || holidayDates.has(curDateStr))) {
        excludedCount++;
        continue;
      }

      await pool.query(
        `INSERT INTO attendance (user_id, date, status, login_time, logout_time, total_hours, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           status = VALUES(status), 
           login_time = VALUES(login_time), 
           logout_time = VALUES(logout_time), 
           total_hours = VALUES(total_hours), 
           notes = VALUES(notes)`,
        [
          user_id, 
          curDateStr, 
          status, 
          defaultIn, 
          defaultOut, 
          defaultDuration, 
          reason || remarks ? `Management: ${reason || remarks}` : "Recorded by Management"
        ]
      );
      insertedCount++;
    }

    // Notify employee
    const [userRows]: any = await pool.query("SELECT name FROM users WHERE id = ?", [user_id]);
    const empName = userRows[0]?.name || "Employee";

    await pool.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
      [
        user_id,
        `🗓️ Attendance Updated for ${insertedCount} day(s)`,
        `Management recorded ${status} for you from ${minDate} to ${maxDate}.${reason ? " Notes: " + reason : ""}`
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully recorded ${status} for ${empName} (${insertedCount} day(s) updated).`,
      count: insertedCount,
      excluded_count: excludedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

