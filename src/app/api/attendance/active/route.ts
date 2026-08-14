import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { 
  getCurrentISTDate, 
  getCurrentISTTime12, 
  calculateHoursDifference, 
  validateCheckoutTimeBuffer 
} from "@/lib/timeUtils";
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

    // 1. First check if there is an unclosed active shift (even if started on a previous day/yesterday)
    const [openRows]: any = await pool.query(
      "SELECT * FROM attendance WHERE user_id = ? AND logout_time IS NULL ORDER BY date DESC, id DESC LIMIT 1",
      [userId]
    );

    if (openRows.length > 0) {
      const activeShift = openRows[0];
      const isShiftFromPreviousDay = activeShift.date < todayIST;

      return NextResponse.json({
        isCeo: false,
        todayRecord: {
          ...activeShift,
          isOvernightShift: isShiftFromPreviousDay,
        },
        currentDate: todayIST,
        currentTime: getCurrentISTTime12(),
      });
    }

    // 2. If no open shift, fetch today's closed record (if already completed today)
    const [todayRows]: any = await pool.query(
      "SELECT * FROM attendance WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1",
      [userId, todayIST]
    );

    const todayRecord = todayRows[0] || null;

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
    const { action, targetDate, offline_time, manual_time, is_overnight } = body;
    const todayIST = getCurrentISTDate();
    const currentISTTime = getCurrentISTTime12();
    const nowTime12 = manual_time || offline_time || currentISTTime;

    // CHECK-IN ACTION
    if (action === "check-in") {
      // 2. Check if user already has an active open shift that wasn't closed
      const [openRows]: any = await pool.query(
        "SELECT * FROM attendance WHERE user_id = ? AND logout_time IS NULL ORDER BY date DESC LIMIT 1",
        [userId]
      );

      if (openRows.length > 0) {
        const active = openRows[0];
        return NextResponse.json(
          { 
            error: `You already have an active shift started on ${active.date} at ${active.login_time}. Please check out of that shift first.` 
          },
          { status: 400 }
        );
      }

      await pool.query(
        `INSERT INTO attendance (user_id, date, status, login_time) 
         VALUES (?, ?, 'Present', ?) 
         ON DUPLICATE KEY UPDATE login_time = IFNULL(login_time, ?), status = 'Present'`,
        [userId, todayIST, nowTime12, nowTime12]
      );

      return NextResponse.json({
        success: true,
        message: `Checked IN successfully at ${nowTime12} (India Time IST)${offline_time ? ' [Synced from offline session]' : ''}`,
        login_time: nowTime12,
        date: todayIST,
      });
    }

    // CHECK-OUT ACTION
    if (action === "check-out") {
      // Find the open active shift
      const [openRows]: any = await pool.query(
        "SELECT * FROM attendance WHERE user_id = ? AND logout_time IS NULL ORDER BY date DESC, id DESC LIMIT 1",
        [userId]
      );

      let activeShift = openRows[0];

      // Fallback: If no open record found, check today's record
      if (!activeShift) {
        const [todayRows]: any = await pool.query(
          "SELECT * FROM attendance WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1",
          [userId, todayIST]
        );
        activeShift = todayRows[0];
      }

      if (!activeShift || !activeShift.login_time) {
        return NextResponse.json(
          { error: "No active check-in record found to check out from." },
          { status: 400 }
        );
      }

      const isCrossDay = is_overnight || activeShift.date < todayIST;

      // 3. Validate checkout buffer: Cannot be more than 30 minutes in advance of current time
      const isBufferValid = validateCheckoutTimeBuffer(nowTime12, currentISTTime, 30, isCrossDay);
      if (!isBufferValid) {
        return NextResponse.json(
          { 
            error: "Check-out time cannot be more than 30 minutes in advance of the current time." 
          },
          { status: 400 }
        );
      }

      // 4. Calculate total hours with overnight awareness
      const totalHours = calculateHoursDifference(activeShift.login_time, nowTime12, isCrossDay);
      const isHalfDay = totalHours < 9;
      const isOvertime = totalHours >= 12;

      let status = "Present";
      if (isHalfDay) status = "Half Day";
      else if (isOvertime) status = "Present (Overtime)";

      await pool.query(
        `UPDATE attendance 
         SET logout_time = ?, total_hours = ?, status = ? 
         WHERE id = ?`,
        [nowTime12, totalHours.toFixed(2), status, activeShift.id]
      );

      if (isHalfDay) {
        const warningMsg = `You completed ${totalHours.toFixed(2)} hours for shift ${activeShift.date} (<9 hours required). Recorded as HALF DAY.`;
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
          [userId, "Half Day Notice (<9 Hours)", warningMsg]
        );
      }

      return NextResponse.json({
        success: true,
        isHalfDay,
        isOvertime,
        totalHours: totalHours.toFixed(2),
        shiftDate: activeShift.date,
        login_time: activeShift.login_time,
        logout_time: nowTime12,
        message: `Checked OUT successfully at ${nowTime12}. Total: ${totalHours.toFixed(2)} hrs (${status}).`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
