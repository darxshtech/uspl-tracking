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

    // Check if today is a scheduled company holiday
    const [holidayRows]: any = await pool.query(
      "SELECT id, title, title AS name, date, description FROM holidays WHERE date = ?",
      [todayIST]
    );
    const todayHoliday = holidayRows.length > 0 ? holidayRows[0] : null;

    // Fetch previous completed shift to check if yesterday was Half Day
    const [prevRows]: any = await pool.query(
      `SELECT * FROM attendance 
       WHERE user_id = ? AND date < ? AND login_time IS NOT NULL AND logout_time IS NOT NULL 
       ORDER BY date DESC, id DESC LIMIT 1`,
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

    // 1. Check if there is an unclosed active shift with a valid check-in (login_time IS NOT NULL, not leave/holiday)
    const [openRows]: any = await pool.query(
      `SELECT * FROM attendance 
       WHERE user_id = ? 
         AND login_time IS NOT NULL 
         AND logout_time IS NULL 
         AND (status IS NULL OR (status NOT LIKE '%Leave%' AND status != 'Holiday'))
       ORDER BY date DESC, id DESC LIMIT 1`,
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
        todayHoliday,
        fullDayHours,
        yesterdayHalfDay,
        currentDate: todayIST,
        currentTime: getCurrentISTTime12(),
      });
    }

    // 2. If no open shift, fetch today's record (if already completed or marked today)
    const [todayRows]: any = await pool.query(
      `SELECT * FROM attendance 
       WHERE user_id = ? AND date = ? 
       ORDER BY (CASE WHEN login_time IS NOT NULL THEN 1 ELSE 2 END), id DESC LIMIT 1`,
      [userId, todayIST]
    );

    const todayRecord = todayRows[0] || null;

    return NextResponse.json({
      isCeo: false,
      todayRecord,
      todayHoliday,
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
    const userRole = role;
    const isManagement = ["Admin", "CEO", "PM"].includes(role);
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

    const checkDate = targetDate || todayIST;

    // 2. Official Company Holiday Restriction Check
    // ONLY PM, Admin, and CEO can add IN/OUT times on official company holidays
    const [holidayRows]: any = await pool.query(
      "SELECT id, title, date, description FROM holidays WHERE date = ?",
      [checkDate]
    );
    const scheduledHoliday = holidayRows.length > 0 ? holidayRows[0] : null;

    if (scheduledHoliday && !isManagement) {
      return NextResponse.json(
        {
          error: `Today (${scheduledHoliday.title || checkDate}) is an official company holiday. Adding IN/OUT times on holidays is restricted to PM, Admin, and CEO.`,
          is_holiday_blocked: true,
          holiday: scheduledHoliday,
        },
        { status: 403 }
      );
    }

    // CHECK-IN ACTION
    if (action === "check-in") {
      // 1. Check if user currently has an approved/pending leave or holiday logged for today
      const [todayLeaveRows]: any = await pool.query(
        `SELECT * FROM attendance 
         WHERE user_id = ? AND date = ? AND (status LIKE '%Leave%' OR status = 'Holiday')`,
        [userId, todayIST]
      );

      if (todayLeaveRows.length > 0) {
        const todayLeave = todayLeaveRows[0];
        const leaveStatusName = todayLeave.status || "Leave";
        
        // Strict Block for Developers/Testers unless overridden by PM/Admin or override_leave flag passed
        if (!isManagement && !body.override_leave) {
          return NextResponse.json(
            {
              error: `You have an active ${leaveStatusName} logged for today (${todayIST}). Check-in is disabled during leave. Please contact your Project Manager or Management to override or cancel your leave if you are working today.`,
              is_leave_blocked: true,
              leave_status: leaveStatusName,
            },
            { status: 400 }
          );
        }

        // If PM/CEO/Admin or explicitly overridden, log override note
        const overrideNote = scheduledHoliday
          ? ` [Holiday Work by ${session.user?.name || userRole}]`
          : ` [Leave Overridden by ${session.user?.name || userRole}]`;
        await pool.query(
          `UPDATE attendance 
           SET status = 'Present', login_time = IFNULL(login_time, ?), notes = CONCAT(IFNULL(notes, ''), ?)
           WHERE id = ?`,
          [nowTime12, overrideNote, todayLeave.id]
        );
      } else {
        // Normal check-in insert/update
        const initialNotes = scheduledHoliday ? `[Holiday Work by ${userRole}]` : null;
        await pool.query(
          `INSERT INTO attendance (user_id, date, status, login_time, notes) 
           VALUES (?, ?, 'Present', ?, ?) 
           ON DUPLICATE KEY UPDATE login_time = IFNULL(login_time, ?), status = 'Present'`,
          [userId, todayIST, nowTime12, initialNotes, nowTime12]
        );
      }

      // 2. Check if user already has an active open shift that wasn't closed
      const [openRows]: any = await pool.query(
        `SELECT * FROM attendance 
         WHERE user_id = ? 
           AND login_time IS NOT NULL 
           AND logout_time IS NULL 
           AND (status IS NULL OR (status NOT LIKE '%Leave%' AND status != 'Holiday'))
         ORDER BY date DESC LIMIT 1`,
        [userId]
      );

      if (openRows.length > 0 && openRows[0].date !== todayIST) {
        const active = openRows[0];
        return NextResponse.json(
          { 
            error: `You already have an active shift started on ${active.date} at ${active.login_time}. Please check out of that shift first.` 
          },
          { status: 400 }
        );
      }

      // Check if previous shift was a Half Day to dispatch alert notification
      const [prevRows]: any = await pool.query(
        `SELECT * FROM attendance 
         WHERE user_id = ? 
           AND date < ? 
           AND login_time IS NOT NULL 
           AND logout_time IS NOT NULL 
         ORDER BY date DESC, id DESC LIMIT 1`,
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
        }
      }

      return NextResponse.json({
        success: true,
        login_time: nowTime12,
        date: todayIST,
        yesterdayNotice,
        message: `Checked IN successfully at ${nowTime12} (IST).`,
      });
    }

    // CHECK-OUT ACTION
    if (action === "check-out") {
      // Find the open active shift with actual login_time
      const [openRows]: any = await pool.query(
        `SELECT * FROM attendance 
         WHERE user_id = ? 
           AND login_time IS NOT NULL 
           AND logout_time IS NULL 
           AND (status IS NULL OR (status NOT LIKE '%Leave%' AND status != 'Holiday'))
         ORDER BY date DESC, id DESC LIMIT 1`,
        [userId]
      );

      let activeShift = openRows[0];

      // Fallback: If no open record found, check today's record with non-null login_time
      if (!activeShift) {
        const [todayRows]: any = await pool.query(
          `SELECT * FROM attendance 
           WHERE user_id = ? AND date = ? AND login_time IS NOT NULL 
           ORDER BY id DESC LIMIT 1`,
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

      const activeShiftDateStr = activeShift.date instanceof Date 
        ? activeShift.date.toISOString().split("T")[0] 
        : String(activeShift.date).split("T")[0];

      const isCrossDay = Boolean(is_overnight) || (Boolean(activeShiftDateStr) && activeShiftDateStr < todayIST);

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
      const halfDayThreshold = fullDayHours / 2;

      let status = "Present";
      let isAbsent = false;
      let isHalfDay = false;

      if (totalHours < halfDayThreshold) {
        status = "Absent";
        isAbsent = true;
      } else if (totalHours < fullDayHours) {
        status = "Half Day";
        isHalfDay = true;
      }

      await pool.query(
        `UPDATE attendance 
         SET logout_time = ?, total_hours = ?, status = ? 
         WHERE id = ?`,
        [nowTime12, totalHours.toFixed(2), status, activeShift.id]
      );

      const shiftDateStr = activeShift.date instanceof Date 
        ? activeShift.date.toISOString().split("T")[0] 
        : String(activeShift.date).split("T")[0];

      if (isAbsent) {
        const warningMsg = `You checked out after ${totalHours.toFixed(2)} hours on ${shiftDateStr} (<${halfDayThreshold.toFixed(1)} hrs half-shift minimum). Marked as FULL DAY ABSENT.`;
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
          [userId, `Shift Absent Notice (<${halfDayThreshold.toFixed(1)} Hours)`, warningMsg]
        );
      } else if (isHalfDay) {
        const warningMsg = `You completed ${totalHours.toFixed(2)} hours for shift ${shiftDateStr} (<${fullDayHours} hours required for Full Day). Recorded as HALF DAY.`;
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
          [userId, `Half Day Notice (<${fullDayHours} Hours)`, warningMsg]
        );
      }

      return NextResponse.json({
        success: true,
        isAbsent,
        isHalfDay,
        fullDayHours,
        halfDayThreshold,
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
