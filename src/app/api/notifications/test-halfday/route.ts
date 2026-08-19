import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getFullDayHours } from "@/lib/settings";
import { getCurrentISTDate } from "@/lib/timeUtils";

export async function GET(req: Request) {
  return handleDispatch(req);
}

export async function POST(req: Request) {
  return handleDispatch(req);
}

async function handleDispatch(req: Request) {
  const session = await getServerSession(authOptions);
  const isDev = process.env.NODE_ENV !== "production";
  if (!session && !isDev) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const fullDayHours = await getFullDayHours();
    const today = getCurrentISTDate();

    // 1. Clear generic test broadcast notifications
    await pool.query(
      "DELETE FROM notifications WHERE title LIKE '%Test Push Notification%' OR title LIKE '%Half Day Warning Alert%'"
    );

    // 2. Fetch all employees except CEO
    const [employees]: any = await pool.query(
      "SELECT id, name, role, email FROM users WHERE role != 'CEO'"
    );

    const pushedTo: any[] = [];

    // 3. For each employee, inspect their most recent completed shift before today
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

          // Insert target notification ONLY for this specific user
          await pool.query(
            "INSERT INTO notifications (user_id, target_role, title, message, type, is_read) VALUES (?, NULL, ?, ?, 'warning', 0)",
            [emp.id, notifTitle, notifMsg]
          );

          pushedTo.push({
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
      message: `Half-day shift warning pushed only to ${pushedTo.length} employees with incomplete 9-hour shifts.`,
      pushedTo,
    });
  } catch (error: any) {
    console.error("Error pushing half-day warnings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
