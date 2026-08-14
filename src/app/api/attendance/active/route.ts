import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getCurrentISTDate, getCurrentISTTime12, calculateHoursDifference } from "@/lib/timeUtils";
import { sendEmail } from "@/lib/mailer";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    // CEO is completely exempt from attendance tracking
    if (role === "CEO") {
      return NextResponse.json({
        isCeo: true,
        todayRecord: null,
        message: "CEO is exempt from attendance tracking",
      });
    }

    const todayIST = getCurrentISTDate();

    const [rows]: any = await pool.query(
      "SELECT * FROM attendance WHERE user_id = ? AND date = ?",
      [userId, todayIST]
    );

    const todayRecord = rows[0] || null;

    return NextResponse.json({
      isCeo: false,
      todayRecord,
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
    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    const userEmail = session.user?.email || "";
    const userName = session.user?.name || "Employee";

    // 1. CEO cannot punch or log attendance
    if (role === "CEO") {
      return NextResponse.json(
        { error: "CEO role is the executive head and does not log daily attendance." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { action, targetDate } = body; // "check-in" or "check-out"
    const todayIST = getCurrentISTDate();
    const nowTime12 = getCurrentISTTime12();

    // 2. Strict Current Date Enforcement: Punch only allowed for current date!
    if (targetDate && targetDate !== todayIST) {
      const securityAlertMsg = `SECURITY ALERT: User ${userName} (${userEmail}) attempted to log attendance for unauthorized date (${targetDate}) instead of today (${todayIST}).`;

      // Log high-priority notification for PM & CEO
      await pool.query(
        "INSERT INTO notifications (target_role, title, message, type) VALUES ('PM', ?, ?, 'security_alert'), ('CEO', ?, ?, 'security_alert')",
        ["Unauthorized Attendance Date Attempt", securityAlertMsg, "Unauthorized Attendance Date Attempt", securityAlertMsg]
      );

      // Notify the employee
      await pool.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
        [
          userId,
          "Attendance Date Restriction",
          `Attendance can only be logged for today's current date (${todayIST}). Your action has been flagged to the Project Manager.`
        ]
      );

      // Dispatch security email
      await sendEmail({
        to: "pm@unitglo.com",
        subject: `[Security Warning] Unauthorized Attendance Date Modification: ${userName}`,
        html: `
          <h3>Security Alert: Unauthorized Attendance Date Attempt</h3>
          <p><strong>Employee:</strong> ${userName} (${userEmail})</p>
          <p><strong>Role:</strong> ${role}</p>
          <p><strong>Attempted Date:</strong> ${targetDate}</p>
          <p><strong>Actual Current Date (IST):</strong> ${todayIST}</p>
          <p>The action was automatically blocked by the system.</p>
        `,
      });

      return NextResponse.json(
        {
          error: `Attendance can ONLY be recorded for the current date (${todayIST}). Attempted date (${targetDate}) was rejected and reported to the PM.`,
        },
        { status: 400 }
      );
    }

    if (action === "check-in") {
      await pool.query(
        `INSERT INTO attendance (user_id, date, status, login_time) 
         VALUES (?, ?, 'Present', ?) 
         ON DUPLICATE KEY UPDATE login_time = IFNULL(login_time, ?), status = 'Present'`,
        [userId, todayIST, nowTime12, nowTime12]
      );

      return NextResponse.json({
        success: true,
        message: `Checked IN successfully at ${nowTime12} (India Time IST)`,
        login_time: nowTime12,
        date: todayIST,
      });
    }

    if (action === "check-out") {
      const [rows]: any = await pool.query(
        "SELECT login_time FROM attendance WHERE user_id = ? AND date = ?",
        [userId, todayIST]
      );

      let totalHours = 0;
      let isHalfDay = false;
      const loginTime = rows[0]?.login_time;

      if (loginTime) {
        totalHours = calculateHoursDifference(loginTime, nowTime12);
      }

      // If shift < 9 hours, mark as Half Day
      if (totalHours < 9) {
        isHalfDay = true;
      }

      const status = isHalfDay ? "Half Day" : "Present";

      await pool.query(
        `UPDATE attendance 
         SET logout_time = ?, total_hours = ?, status = ? 
         WHERE user_id = ? AND date = ?`,
        [nowTime12, totalHours.toFixed(2), status, userId, todayIST]
      );

      if (isHalfDay) {
        const warningMsg = `You completed ${totalHours.toFixed(2)} hours today (${todayIST}), which is less than 9 hours required. Shift recorded as HALF DAY.`;

        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
          [userId, "Half Day Notice (<9 Hours)", warningMsg]
        );

        await pool.query(
          "INSERT INTO notifications (target_role, title, message, type) VALUES ('PM', ?, ?, 'info')",
          [
            `Early Checkout: ${userName}`,
            `${userName} checked out after ${totalHours.toFixed(2)} hours (Half Day) at ${nowTime12}.`
          ]
        );

        return NextResponse.json({
          success: true,
          isHalfDay: true,
          totalHours: totalHours.toFixed(2),
          logout_time: nowTime12,
          message: `Checked OUT at ${nowTime12}. Total: ${totalHours.toFixed(2)} hrs (Marked as Half Day).`,
        });
      }

      return NextResponse.json({
        success: true,
        isHalfDay: false,
        totalHours: totalHours.toFixed(2),
        logout_time: nowTime12,
        message: `Checked OUT successfully at ${nowTime12} (Total: ${totalHours.toFixed(2)} hrs).`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
