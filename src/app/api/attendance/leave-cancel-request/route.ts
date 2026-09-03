import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getCurrentISTDate } from "@/lib/timeUtils";

// POST /api/attendance/leave-cancel-request
// Allows an employee to submit a cancellation request for an approved leave
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const userName = (session.user as any).name || userRole || "Employee";
    const isManagement = ["Admin", "CEO", "PM"].includes(userRole);

    const body = await req.json().catch(() => ({}));
    const { id, reason } = body;

    if (!id) {
      return NextResponse.json({ error: "Leave record ID is required" }, { status: 400 });
    }

    // Fetch the target attendance record
    const [rows]: any = await pool.query(
      `SELECT a.id, a.user_id, DATE_FORMAT(a.date, '%Y-%m-%d') as date_str, a.date, a.status, a.notes, u.name as employee_name
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Leave record not found" }, { status: 404 });
    }

    const leaveRecord = rows[0];

    // Verify ownership
    if (!isManagement && leaveRecord.user_id !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only request cancellation for your own leaves" },
        { status: 403 }
      );
    }

    const currentStatus = (leaveRecord.status || "").trim();

    // If it's already pending, guide them to use direct cancel
    if (currentStatus.includes("Pending")) {
      return NextResponse.json(
        {
          error: "This leave request is not yet approved. You can cancel it directly without a management cancellation request.",
        },
        { status: 400 }
      );
    }

    // If it's already in cancel requested state
    if (currentStatus.includes("Cancel Requested")) {
      return NextResponse.json(
        { error: "A cancellation request for this leave is already awaiting management review." },
        { status: 400 }
      );
    }

    // Must be an approved leave or half day
    if (!["Leave", "Half Day", "Paid Leave", "Sick Leave", "Unpaid Leave"].includes(currentStatus)) {
      return NextResponse.json(
        { error: `Cannot request cancellation for record with status '${currentStatus}'` },
        { status: 400 }
      );
    }

    // Verify date is upcoming or today
    const todayIST = getCurrentISTDate();
    if (leaveRecord.date_str < todayIST) {
      return NextResponse.json(
        { error: "Cannot request cancellation for past leaves that have already concluded." },
        { status: 400 }
      );
    }

    const isHalfDay = currentStatus === "Half Day";
    const newStatus = isHalfDay ? "Half Day (Cancel Requested)" : "Leave (Cancel Requested)";
    const cancelReasonNote = reason ? ` [CANCEL_REQUEST: ${reason}]` : " [CANCEL_REQUEST: Reason not specified]";

    await pool.query(
      "UPDATE attendance SET status = ?, notes = CONCAT(IFNULL(notes, ''), ?) WHERE id = ?",
      [newStatus, cancelReasonNote, id]
    );

    const dateFormatted = new Date(leaveRecord.date).toLocaleDateString();

    // Notify PM, Admin, CEO of the cancellation request
    try {
      const [mgmtUsers]: any = await pool.query(
        "SELECT id FROM users WHERE role IN ('Admin', 'CEO', 'PM') AND is_active = 1"
      );

      if (mgmtUsers && mgmtUsers.length > 0) {
        const notifTitle = "⚠️ Leave Cancellation Request";
        const notifMsg = `${userName} requested to cancel their approved ${currentStatus} for ${dateFormatted}.${reason ? " Reason: " + reason : ""}`;
        const notifValues = mgmtUsers.map((m: any) => [
          m.id,
          notifTitle,
          notifMsg,
          "warning",
        ]);

        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES ?",
          [notifValues]
        );
      }
    } catch (notifErr) {
      console.error("Failed to notify management of leave cancellation request:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `Cancellation request for approved ${currentStatus} on ${dateFormatted} has been submitted to management for review.`,
    });
  } catch (error: any) {
    console.error("Error submitting leave cancellation request:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
