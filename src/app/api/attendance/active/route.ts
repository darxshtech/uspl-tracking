import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { 
  getCurrentISTDate, 
  getCurrentISTTime12, 
  calculateHoursDifference, 
  validateCheckoutTimeBuffer,
  formatHoursAndMinutes
} from "@/lib/timeUtils";
import { getFullDayHours } from "@/lib/settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    const fullDayHours = await getFullDayHours();

    // CEO is completely exempt from attendance tracking
    if (role === "CEO") {
      return NextResponse.json({
        isCeo: true,
        todayRecord: null,
        fullDayHours,
        yesterdayHalfDay: null,
        message: "CEO is exempt from attendance tracking",
      });
    }

    const todayIST = getCurrentISTDate();

    // Fetch previous completed shift to check if yesterday was Half Day
    const [prevRows]: any = await pool.query(
      "SELECT * FROM attendance WHERE user_id = ? AND date < ? AND logout_time IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1",
      [userId, todayIST]
    );

    let yesterdayHalfDay: any = null;
    if (prevRows.length > 0) {
      const prevShift = prevRows[0];
      const prevHours = parseFloat(prevShift.total_hours || 0);
      if (prevShift.status === "Half Day" || (prevShift.total_hours !== null && prevHours < fullDayHours)) {
        yesterdayHalfDay = {
          date: prevShift.date,
          hours: prevHours,
          status: prevShift.status,
          requiredHours: fullDayHours,
        };
      }
    }

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
        fullDayHours,
        yesterdayHalfDay,
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
      fullDayHours,
      yesterdayHalfDay,
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
    const fullDayHours = await getFullDayHours();

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

      // Check if previous shift was a Half Day to dispatch alert notification
      const [prevRows]: any = await pool.query(
        "SELECT * FROM attendance WHERE user_id = ? AND date < ? AND logout_time IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1",
        [userId, todayIST]
      );

      let yesterdayNotice: any = null;
      if (prevRows.length > 0) {
        const prevShift = prevRows[0];
        const prevHours = parseFloat(prevShift.total_hours || 0);
        const shiftDateStr = prevShift.date instanceof Date 
          ? prevShift.date.toISOString().split("T")[0] 
          : String(prevShift.date).split("T")[0];

        if (prevShift.status === "Half Day" || (prevShift.total_hours !== null && prevHours < fullDayHours)) {
          yesterdayNotice = {
            date: shiftDateStr,
            hours: prevHours,
            requiredHours: fullDayHours,
          };

          const notifTitle = `⚠️ Half Day Alert (${shiftDateStr})`;
          const notifMsg = `Your previous shift on ${shiftDateStr} was recorded as a Half Day (${prevHours.toFixed(1)} hrs completed, <${fullDayHours} hrs required). Please ensure you complete your full ${fullDayHours} hours today!`;

          const [existingNotif]: any = await pool.query(
            "SELECT id FROM notifications WHERE user_id = ? AND title = ? LIMIT 1",
            [userId, notifTitle]
          );

          if (!existingNotif || existingNotif.length === 0) {
            await pool.query(
              "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
              [userId, notifTitle, notifMsg]
            );
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Checked IN successfully at ${nowTime12} (India Time IST)${offline_time ? ' [Synced from offline session]' : ''}`,
        login_time: nowTime12,
        date: todayIST,
        yesterdayNotice,
        fullDayHours,
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

      // 4. Calculate total hours with overnight awareness & configurable fullDayHours
      const totalHours = calculateHoursDifference(activeShift.login_time, nowTime12, isCrossDay);
      const isHalfDay = totalHours < fullDayHours;
      const isOvertime = totalHours >= (fullDayHours + 3);

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
        const shiftDateStr = activeShift.date instanceof Date 
          ? activeShift.date.toISOString().split("T")[0] 
          : String(activeShift.date).split("T")[0];
        const warningMsg = `You completed ${totalHours.toFixed(2)} hours for shift ${shiftDateStr} (<${fullDayHours} hours required). Recorded as HALF DAY.`;
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
          [userId, `Half Day Notice (<${fullDayHours} Hours)`, warningMsg]
        );
      }

      return NextResponse.json({
        success: true,
        isHalfDay,
        isOvertime,
        fullDayHours,
        totalHours: totalHours.toFixed(2),
        shiftDate: activeShift.date,
        login_time: activeShift.login_time,
        logout_time: nowTime12,
        message: `Checked OUT successfully at ${nowTime12}. Total: ${formatHoursAndMinutes(totalHours)} (${status}).`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
