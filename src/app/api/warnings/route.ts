import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getFullDayHours } from "@/lib/settings";
import { getCurrentISTDate } from "@/lib/timeUtils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const role = (session.user as any)?.role;
  if (!["Admin", "CEO", "PM"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized: Management role required" }, { status: 403 });
  }

  try {
    const fullDayHours = await getFullDayHours();
    const today = getCurrentISTDate();

    // 1. Fetch all warning notifications sent with employee info
    const [warningRows]: any = await pool.query(
      `SELECT n.*, u.name as employee_name, u.email as employee_email, u.role as employee_role, u.avatar_url
       FROM notifications n
       LEFT JOIN users u ON n.user_id = u.id
       WHERE n.type = 'warning'
       ORDER BY n.created_at DESC
       LIMIT 100`
    );

    // 2. Fetch all employees except CEO and Admin
    const [employees]: any = await pool.query(
      "SELECT id, name, role, email, avatar_url FROM users WHERE role NOT IN ('CEO', 'Admin')"
    );

    const incompleteEmployees: any[] = [];

    for (const emp of employees) {
      const [shifts]: any = await pool.query(
        `SELECT * FROM attendance 
         WHERE user_id = ? AND logout_time IS NOT NULL AND date < ? 
         ORDER BY date DESC, id DESC LIMIT 1`,
        [emp.id, today]
      );

      if (shifts.length > 0) {
        const lastShift = shifts[0];
        const hours = parseFloat(lastShift.total_hours || 0);

        if (lastShift.status === "Half Day" || (lastShift.total_hours !== null && hours < fullDayHours)) {
          const shiftDateStr = lastShift.date instanceof Date 
            ? lastShift.date.toISOString().split("T")[0] 
            : String(lastShift.date).split("T")[0];

          // Check if a warning was already sent to this employee today
          const sentToday = warningRows.find(
            (w: any) => String(w.user_id) === String(emp.id) &&
                       w.created_at &&
                       new Date(w.created_at).toISOString().startsWith(today)
          );

          incompleteEmployees.push({
            id: emp.id,
            name: emp.name,
            role: emp.role,
            email: emp.email,
            avatar_url: emp.avatar_url,
            shiftDate: shiftDateStr,
            loginTime: lastShift.login_time,
            logoutTime: lastShift.logout_time,
            hoursCompleted: hours,
            requiredHours: fullDayHours,
            shortBy: Math.max(0, fullDayHours - hours).toFixed(2),
            warningSentToday: Boolean(sentToday),
            lastWarningTime: sentToday ? sentToday.created_at : null,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      today,
      fullDayHours,
      warningLogs: warningRows,
      incompleteEmployees,
    });
  } catch (error: any) {
    console.error("Error fetching warnings data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const role = (session.user as any)?.role;
  if (!["Admin", "CEO", "PM"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized: Management role required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { employeeId, resendAll } = body;
    const fullDayHours = await getFullDayHours();
    const today = getCurrentISTDate();

    const dispatched: any[] = [];

    // Target specific employee or all employees with incomplete shifts
    let targetQuery = "SELECT id, name, role, email FROM users WHERE role NOT IN ('CEO', 'Admin')";
    let params: any[] = [];

    if (employeeId && !resendAll) {
      targetQuery += " AND id = ?";
      params = [employeeId];
    }

    const [employees]: any = await pool.query(targetQuery, params);

    for (const emp of employees) {
      const [shifts]: any = await pool.query(
        `SELECT * FROM attendance 
         WHERE user_id = ? AND logout_time IS NOT NULL AND date < ? 
         ORDER BY date DESC, id DESC LIMIT 1`,
        [emp.id, today]
      );

      if (shifts.length > 0) {
        const lastShift = shifts[0];
        const hours = parseFloat(lastShift.total_hours || 0);

        if (lastShift.status === "Half Day" || hours < fullDayHours) {
          const shiftDateStr = lastShift.date instanceof Date 
            ? lastShift.date.toISOString().split("T")[0] 
            : String(lastShift.date).split("T")[0];

          const notifTitle = `⚠️ Half Day Alert (${shiftDateStr})`;
          const notifMsg = `Your previous shift on ${shiftDateStr} was recorded as a Half Day (${hours.toFixed(1)} hrs completed, <${fullDayHours} hrs required). Please ensure you complete your full ${fullDayHours} hours today!`;

          // Insert fresh unread notification specifically for this employee
          await pool.query(
            "INSERT INTO notifications (user_id, target_role, title, message, type, is_read) VALUES (?, NULL, ?, ?, 'warning', 0)",
            [emp.id, notifTitle, notifMsg]
          );

          dispatched.push({
            id: emp.id,
            name: emp.name,
            role: emp.role,
            shiftDate: shiftDateStr,
            hoursCompleted: hours,
            requiredHours: fullDayHours,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Shift policy warning sent to ${dispatched.length} ${dispatched.length === 1 ? "employee" : "employees"}.`,
      dispatched,
    });
  } catch (error: any) {
    console.error("Error resending warning notifications:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
