import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getCurrentISTDate, getCurrentISTTime12 } from "@/lib/timeUtils";

const SYSTEM_START_DATE = "2026-08-17";

async function syncAutoAbsentRecords(todayIST: string) {
  try {
    // Delete legacy attendance records created prior to system launch (17 Aug 2026)
    await pool.query("DELETE FROM attendance WHERE date < ?", [SYSTEM_START_DATE]);

    const [employees]: any = await pool.query(
      "SELECT id FROM users WHERE role != 'CEO' AND is_active = 1"
    );
    if (!employees || employees.length === 0) return;

    const [holidayRows]: any = await pool.query(
      "SELECT DATE_FORMAT(date, '%Y-%m-%d') as hol_date FROM holidays WHERE date <= ?",
      [todayIST]
    );
    const holidayDates = new Set<string>(holidayRows.map((h: any) => h.hol_date));

    const dates: string[] = [];
    const cur = new Date(todayIST + "T00:00:00Z");
    for (let i = 0; i < 30; i++) {
      const dStr = cur.toISOString().split("T")[0];
      if (dStr < SYSTEM_START_DATE) break; // Stop at system start date 2026-08-17

      const [y, m, d] = dStr.split("-");
      const dt = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)));
      const dayOfWeek = dt.getUTCDay();
      if (dayOfWeek !== 0 && !holidayDates.has(dStr)) {
        dates.push(dStr);
      }
      cur.setUTCDate(cur.getUTCDate() - 1);
    }

    for (const emp of employees) {
      for (const dStr of dates) {
        const [existing]: any = await pool.query(
          "SELECT id, login_time, status FROM attendance WHERE user_id = ? AND date = ?",
          [emp.id, dStr]
        );

        if (existing.length === 0) {
          await pool.query(
            `INSERT INTO attendance (user_id, date, status, total_hours, notes) 
             VALUES (?, ?, 'Absent', 0, 'Auto-marked Absent (No Check-In or Leave Application)')`,
            [emp.id, dStr]
          );
        } else {
          const rec = existing[0];
          if (
            dStr <= todayIST &&
            !rec.login_time &&
            rec.status !== "Holiday" &&
            !rec.status?.includes("Leave") &&
            rec.status !== "Absent"
          ) {
            await pool.query(
              "UPDATE attendance SET status = 'Absent', total_hours = 0, notes = 'Auto-marked Absent (No Check-In or Leave Application)' WHERE id = ?",
              [rec.id]
            );
          }
        }
      }
    }
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

    // 1. Fetch attendance records (including future pending/approved leaves)
    let query = `
      SELECT a.*, u.name as employee_name, u.role as employee_role, u.email as employee_email 
      FROM attendance a 
      JOIN users u ON a.user_id = u.id
      WHERE u.role != 'CEO' AND a.date >= ? AND (a.date <= ? OR a.status LIKE '%Leave%' OR a.status LIKE '%Pending%')
    `;
    let params: any[] = [SYSTEM_START_DATE, todayIST];

    if (role === "Developer" || role === "Tester") {
      query += " AND a.user_id = ?";
      params.push(userId);
    }

    query += " ORDER BY a.date DESC, a.id DESC LIMIT 60";

    const [rows] = await pool.query(query, params);

    // 2. Fetch upcoming pending leave applications for this user (date > todayIST)
    let pendingLeaves: any[] = [];
    if (role === "Developer" || role === "Tester" || role === "PM") {
      const [pendingRows]: any = await pool.query(
        `SELECT id, date, status, notes, created_at 
         FROM attendance 
         WHERE user_id = ? AND date > ? AND status = 'Leave (Pending)'
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

      // Status for non-management is 'Leave (Pending)'; for PM/CEO/Admin creating directly it's the requested status
      const targetStatus = isManagement ? (status || "Leave") : "Leave (Pending)";

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
          : `PENDING_LEAVE: ${reason || ""}`;

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

      const msg = isManagement
        ? `Leave officially logged for ${leaveDaysCount} day(s). (${excludedHolidayCount} Sunday/holiday(s) excluded).`
        : `Leave application submitted for ${leaveDaysCount} working day(s) awaiting PM approval. (${excludedHolidayCount} Sunday/holiday(s) excluded).`;

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
