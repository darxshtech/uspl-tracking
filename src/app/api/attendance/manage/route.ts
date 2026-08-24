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

    let query = `
      SELECT a.*, u.name as employee_name, u.email as employee_email, u.role as employee_role
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE u.role != 'CEO'
    `;
    let params: any[] = [];

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

  try {
    const body = await req.json();
    const { id, login_time, logout_time, status, total_hours: manualHours } = body;

    if (!id) {
      return NextResponse.json({ error: "Attendance record ID is required" }, { status: 400 });
    }

    // Auto-calculate total hours based on in time and out time or current time, or use override
    let finalHours = manualHours !== undefined && manualHours !== "" && manualHours !== null ? parseFloat(manualHours) : null;

    if (finalHours === null && login_time) {
      const endTime = logout_time || getCurrentISTTime12();
      finalHours = calculateHoursDifference(login_time, endTime);
    }

    const fullDayHours = await getFullDayHours();
    const halfDayThreshold = fullDayHours / 2;

    let computedStatus = status || "Present";
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

    await pool.query(
      `UPDATE attendance 
       SET login_time = ?, logout_time = ?, status = ?, total_hours = ?
       WHERE id = ?`,
      [login_time || null, logout_time || null, computedStatus, finalHours !== null ? finalHours.toFixed(2) : null, id]
    );

    // Get user ID and date for notification
    const [attRows]: any = await pool.query(
      "SELECT a.user_id, a.date, u.name as employee_name FROM attendance a JOIN users u ON a.user_id = u.id WHERE a.id = ?",
      [id]
    );

    if (attRows.length > 0) {
      const record = attRows[0];
      const recordDate = new Date(record.date).toLocaleDateString();

      await pool.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
        [
          record.user_id,
          "Attendance Record Updated by Management",
          `Your attendance for ${recordDate} was updated by Management (${status}, ${formatHoursAndMinutes(finalHours)}).`
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Attendance updated successfully",
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
    const { user_id, start_date, end_date, selected_dates, date, status = "Leave", reason, remarks } = body;

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

    let insertedCount = 0;
    let excludedCount = 0;

    for (const curDateStr of datesToProcess) {
      const [yearStr, monthStr, dayStr] = curDateStr.split("-");
      const dateObj = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr)));
      const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday

      // Skip Sunday weekly offs and company holidays so they aren't counted as paid leaves
      if ((status === "Leave" || status === "Leave (Pending)" || status === "Half Day") && (dayOfWeek === 0 || holidayDates.has(curDateStr))) {
        excludedCount++;
        continue;
      }

      await pool.query(
        `INSERT INTO attendance (user_id, date, status, login_time, logout_time, total_hours, notes) 
         VALUES (?, ?, ?, NULL, NULL, 0, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), login_time = NULL, logout_time = NULL, total_hours = 0, notes = VALUES(notes)`,
        [user_id, curDateStr, status, reason ? `MANAGEMENT_RECORDED: ${reason}` : null]
      );
      insertedCount++;
    }

    // Notify employee about leave approval / registration
    const [userRows]: any = await pool.query("SELECT name FROM users WHERE id = ?", [user_id]);
    const empName = userRows[0]?.name || "Employee";

    await pool.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
      [
        user_id,
        `🏖️ ${status} Logged by Management`,
        `Your ${status} for ${insertedCount} day(s) has been officially recorded by Management.${reason ? " Notes: " + reason : ""}`
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully logged ${status} for ${empName} (${insertedCount} working day(s), ${excludedCount} Sunday/holiday(s) excluded).`,
      count: insertedCount,
      excluded_count: excludedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

