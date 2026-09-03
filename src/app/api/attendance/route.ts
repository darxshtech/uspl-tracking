import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getCurrentISTDate, getCurrentISTTime12 } from "@/lib/timeUtils";

const SYSTEM_START_DATE = "2026-08-01";

let lastAutoAbsentSync = 0;
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // Throttle to run at most once every 30 minutes

async function syncAutoAbsentRecords(todayIST: string) {
  const now = Date.now();
  if (now - lastAutoAbsentSync < SYNC_INTERVAL_MS) {
    return; // Instant exit if recently synchronized
  }
  lastAutoAbsentSync = now;

  try {
    // 1. Clean up auto-marked absent records for exempt executive management roles (CEO, Admin)
    await pool.query(
      "DELETE FROM attendance WHERE user_id IN (SELECT id FROM users WHERE role IN ('CEO', 'Admin')) AND (status = 'Absent' OR notes LIKE 'Auto-marked%')"
    );

    // 2. Fetch active staff users
    const [employees]: any = await pool.query(
      "SELECT id FROM users WHERE role NOT IN ('CEO', 'Admin') AND is_active = 1"
    );
    if (!employees || employees.length === 0) return;

    // 3. Fetch scheduled holidays
    const [holidayRows]: any = await pool.query(
      "SELECT DATE_FORMAT(date, '%Y-%m-%d') as hol_date FROM holidays WHERE date <= ?",
      [todayIST]
    );
    const holidayDates = new Set<string>(holidayRows.map((h: any) => h.hol_date));

    // 4. Calculate valid workdays up to past 30 days
    const dates: string[] = [];
    const cur = new Date(todayIST + "T00:00:00Z");
    for (let i = 0; i < 30; i++) {
      const dStr = cur.toISOString().split("T")[0];
      if (dStr < SYSTEM_START_DATE) break;

      const [y, m, d] = dStr.split("-");
      const dt = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)));
      const dayOfWeek = dt.getUTCDay();
      if (dayOfWeek !== 0 && !holidayDates.has(dStr)) {
        dates.push(dStr);
      }
      cur.setUTCDate(cur.getUTCDate() - 1);
    }

    if (dates.length === 0) return;
    const minDate = dates[dates.length - 1];

    // 5. Fetch all existing attendance records in one bulk query
    const [existingRows]: any = await pool.query(
      "SELECT id, user_id, DATE_FORMAT(date, '%Y-%m-%d') as date_str, login_time, status FROM attendance WHERE date >= ? AND date <= ?",
      [minDate, todayIST]
    );

    const existingMap = new Set<string>();
    existingRows.forEach((r: any) => {
      existingMap.add(`${r.user_id}:${r.date_str}`);
    });

    // 6. Build batch insert values for missing dates
    const insertValues: any[] = [];
    for (const emp of employees) {
      for (const dStr of dates) {
        const key = `${emp.id}:${dStr}`;
        if (!existingMap.has(key)) {
          insertValues.push([
            emp.id,
            dStr,
            "Absent",
            0,
            "Auto-marked Absent (No Check-In or Leave Application)",
          ]);
        }
      }
    }

    if (insertValues.length > 0) {
      // Chunk bulk inserts into batches of 100 for safety
      const chunkSize = 100;
      for (let i = 0; i < insertValues.length; i += chunkSize) {
        const chunk = insertValues.slice(i, i + chunkSize);
        await pool.query(
          `INSERT IGNORE INTO attendance (user_id, date, status, total_hours, notes) VALUES ?`,
          [chunk]
        );
      }
    }

    // Auto-correct any records where login_time exists but status was left as Absent
    await pool.query(
      "UPDATE attendance SET status = 'Present' WHERE login_time IS NOT NULL AND status = 'Absent'"
    );
  } catch (err) {
    console.error("Auto absent sync error:", err);
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    const todayIST = getCurrentISTDate();

    // Sync auto-absent records for unperformed shifts/leaves
    await syncAutoAbsentRecords(todayIST);

    // 1. Fetch attendance records (excluding CEO & Admin exempt management roles)
    let query = `
      SELECT a.*, u.name as employee_name, u.role as employee_role, u.email as employee_email 
      FROM attendance a 
      JOIN users u ON a.user_id = u.id
      WHERE u.role NOT IN ('CEO', 'Admin') AND a.date >= ? AND (a.date <= ? OR a.status LIKE '%Leave%' OR a.status LIKE '%Pending%')
    `;
    let params: any[] = [SYSTEM_START_DATE, todayIST];

    if (role === "Developer" || role === "Tester") {
      query += " AND a.user_id = ?";
      params.push(userId);
    }

    query += " ORDER BY a.date DESC, a.id DESC LIMIT 60";

    const [rows] = await pool.query(query, params);

    // 2. Fetch upcoming pending leave applications for this user (date >= todayIST)
    let pendingLeaves: any[] = [];
    if (role === "Developer" || role === "Tester" || role === "PM") {
      const [pendingRows]: any = await pool.query(
        `SELECT id, date, status, notes, created_at 
         FROM attendance 
         WHERE user_id = ? AND date >= ? AND (status LIKE '%Pending%' OR status LIKE '%Cancel Requested%')
         ORDER BY date ASC`,
        [userId, todayIST]
      );
      pendingLeaves = pendingRows;
    }

    return NextResponse.json({
      attendance: rows,
      pendingLeaves,
      currentDate: todayIST,
      currentTime: getCurrentISTTime12(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const userName = (session.user as any).name || userRole || "Employee";
    const isManagement = ["Admin", "CEO", "PM"].includes(userRole);
    const body = await req.json();
    const { action, start_date, end_date, selected_dates, status = "Leave", reason } = body;

    if (action === "leave") {
      let datesToProcess: string[] = [];

      if (Array.isArray(selected_dates) && selected_dates.length > 0) {
        datesToProcess = selected_dates;
      } else if (start_date) {
        const endDateStr = end_date || start_date;
        const start = new Date(start_date);
        const end = new Date(endDateStr);

        if (start > end) {
          return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
        }

        const cur = new Date(start);
        while (cur <= end) {
          datesToProcess.push(cur.toISOString().split("T")[0]);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        return NextResponse.json({ error: "Please select at least one date for leave" }, { status: 400 });
      }

      // Sort dates
      datesToProcess.sort();
      const minDate = datesToProcess[0];
      const maxDate = datesToProcess[datesToProcess.length - 1];

      // Fetch scheduled holidays in this range
      const [holidayRows]: any = await pool.query(
        "SELECT DATE_FORMAT(date, '%Y-%m-%d') as hol_date FROM holidays WHERE date BETWEEN ? AND ?",
        [minDate, maxDate]
      );
      const holidayDates = new Set<string>(holidayRows.map((h: any) => h.hol_date));

      let leaveDaysCount = 0;
      let excludedHolidayCount = 0;

      // Status for non-management: Half Day (Pending) vs Leave (Pending)
      const isHalfDay = status === "Half Day";
      const targetStatus = isManagement 
        ? (status || "Leave") 
        : (isHalfDay ? "Half Day (Pending)" : "Leave (Pending)");

      for (const dateStr of datesToProcess) {
        // Date parsing using UTC to avoid timezone drift
        const [yearStr, monthStr, dayStr] = dateStr.split("-");
        const dateObj = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr)));
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday

        // Exclude Sundays and scheduled holidays
        if (dayOfWeek === 0 || holidayDates.has(dateStr)) {
          excludedHolidayCount++;
          continue;
        }

        const [existing]: any = await pool.query(
          "SELECT id FROM attendance WHERE user_id = ? AND date = ?",
          [userId, dateStr]
        );

        const notesText = isManagement
          ? `LEAVE: ${reason || "Logged by Management"}`
          : (isHalfDay ? `PENDING_HALF_DAY: ${reason || ""}` : `PENDING_LEAVE: ${reason || ""}`);

        if (existing.length > 0) {
          await pool.query(
            "UPDATE attendance SET status = ?, notes = ? WHERE id = ?",
            [targetStatus, notesText, existing[0].id]
          );
        } else {
          await pool.query(
            "INSERT INTO attendance (user_id, date, status, notes) VALUES (?, ?, ?, ?)",
            [userId, dateStr, targetStatus, notesText]
          );
        }

        leaveDaysCount++;
      }

      if (leaveDaysCount === 0 && excludedHolidayCount > 0) {
        return NextResponse.json({
          error: "Selected date(s) fall on Sundays or official company holidays and are exempt from paid leaves.",
          excluded_holidays: excludedHolidayCount,
        }, { status: 400 });
      }

      // Dispatch notifications to PM, Admin, CEO
      if (!isManagement && leaveDaysCount > 0) {
        try {
          const datesSummary = datesToProcess.length === 1 
            ? datesToProcess[0] 
            : `${datesToProcess[0]} to ${datesToProcess[datesToProcess.length - 1]} (${leaveDaysCount} day${leaveDaysCount > 1 ? 's' : ''})`;
          const notifTitle = isHalfDay ? "🌓 New Half Day Leave Application" : "🏖️ New Leave Application";
          const notifMsg = `${userName} (${userRole}) applied for a ${isHalfDay ? "Half Day" : "Leave"} on ${datesSummary}.${reason ? " Reason: " + reason : ""}`;

          const [mgmtUsers]: any = await pool.query(
            "SELECT id FROM users WHERE role IN ('Admin', 'CEO', 'PM') AND is_active = 1"
          );
          if (mgmtUsers && mgmtUsers.length > 0) {
            const notifValues = mgmtUsers.map((m: any) => [
              m.id,
              notifTitle,
              notifMsg,
              "info"
            ]);
            await pool.query(
              "INSERT INTO notifications (user_id, title, message, type) VALUES ?",
              [notifValues]
            );
          }
        } catch (notifErr) {
          console.error("Failed to insert management leave notifications:", notifErr);
        }
      }

      const msg = isManagement
        ? `Leave officially logged for ${leaveDaysCount} day(s). (${excludedHolidayCount} Sunday/holiday(s) excluded).`
        : `${isHalfDay ? "Half day leave" : "Leave"} application submitted for ${leaveDaysCount} working day(s) awaiting PM approval. (${excludedHolidayCount} Sunday/holiday(s) excluded).`;

      return NextResponse.json({
        message: msg,
        days_counted: leaveDaysCount,
        excluded_holidays: excludedHolidayCount,
      });
    }

      return NextResponse.json({
        message: msg,
        days_counted: leaveDaysCount,
        excluded_holidays: excludedHolidayCount,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Attendance POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
