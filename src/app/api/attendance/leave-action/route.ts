import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// GET /api/attendance/leave-action
// Fetches all pending leave applications and leave cancellation requests across employees for PM, CEO, and Admin
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: PM, CEO or Admin role required" }, { status: 403 });
  }

  try {
    const [pendingRows]: any = await pool.query(
      `SELECT a.id, a.user_id, a.date, a.status, a.notes, a.created_at,
              u.name as employee_name, u.role as employee_role, u.email as employee_email
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE a.status LIKE '%Pending%' OR a.status LIKE '%Cancel Requested%'
       ORDER BY a.date ASC, u.name ASC`
    );

    const enrichedRows = (pendingRows || []).map((rec: any) => {
      const statusStr = rec.status || "";
      const notesStr = rec.notes || "";
      const isHalfDay = statusStr.includes("Half Day") || notesStr.includes("PENDING_HALF_DAY");
      const isCancelRequest = statusStr.includes("Cancel Requested");

      let cleanReason = notesStr;
      if (isCancelRequest) {
        const match = notesStr.match(/\[CANCEL_REQUEST:\s*([^\]]+)\]/);
        cleanReason = match ? match[1] : notesStr;
      } else {
        cleanReason = notesStr
          .replace(/^PENDING_HALF_DAY:\s*/i, "")
          .replace(/^PENDING_LEAVE:\s*/i, "")
          .trim();
      }

      let leaveTypeLabel = "Full Day Leave";
      if (isCancelRequest) {
        leaveTypeLabel = isHalfDay ? "Cancel Approved Half Day" : "Cancel Approved Leave";
      } else if (isHalfDay) {
        leaveTypeLabel = "Half Day";
      }

      return {
        ...rec,
        is_half_day: isHalfDay,
        is_cancel_request: isCancelRequest,
        clean_reason: cleanReason || "No reason provided",
        leave_type_label: leaveTypeLabel,
      };
    });

    return NextResponse.json({ pendingLeaves: enrichedRows });
  } catch (error: any) {
    console.error("Error fetching pending leaves:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/attendance/leave-action
// Actions: 'approve' | 'reject' | 'approve_cancel' | 'reject_cancel'
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userName = (session?.user as any)?.name || userRole || "Management";

  if (!session || !["Admin", "CEO", "PM"].includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized: PM, CEO or Admin role required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ids, action, leave_type, reason } = body;

    const targetIds: number[] = Array.isArray(ids) ? ids : id ? [id] : [];

    if (targetIds.length === 0) {
      return NextResponse.json({ error: "No leave record IDs provided" }, { status: 400 });
    }

    const validActions = ["approve", "reject", "approve_cancel", "reject_cancel"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Action must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch details of target leave records
    const [leaveRecords]: any = await pool.query(
      `SELECT a.id, a.user_id, a.date, a.status, a.notes, u.name as employee_name
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE a.id IN (?)`,
      [targetIds]
    );

    if (leaveRecords.length === 0) {
      return NextResponse.json({ error: "No matching leave records found" }, { status: 404 });
    }

    // ACTION 1: APPROVE LEAVE APPLICATION
    if (action === "approve") {
      for (const rec of leaveRecords) {
        const isHalfDay =
          rec.status?.includes("Half Day") ||
          rec.notes?.includes("PENDING_HALF_DAY") ||
          leave_type === "Half Day";

        const finalStatus = isHalfDay ? "Half Day" : (leave_type || "Leave");
        const approvalNote = ` [Approved as ${finalStatus} by ${userName}]`;

        await pool.query(
          "UPDATE attendance SET status = ?, notes = CONCAT(IFNULL(notes, ''), ?) WHERE id = ?",
          [finalStatus, approvalNote, rec.id]
        );

        const dateStr = new Date(rec.date).toLocaleDateString();
        const notifTitle = isHalfDay ? "🌓 Half Day Approved" : `🏖️ Leave Request Approved (${finalStatus})`;
        const notifMsg = `Your ${isHalfDay ? "half day" : "leave"} application for ${dateStr} has been APPROVED by ${userName}.`;

        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
          [rec.user_id, notifTitle, notifMsg]
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully approved ${leaveRecords.length} leave application(s).`,
        count: leaveRecords.length,
      });
    }

    // ACTION 2: REJECT LEAVE APPLICATION
    if (action === "reject") {
      const rejectionNote = reason ? ` [Rejected by ${userName}: ${reason}]` : ` [Rejected by ${userName}]`;
      await pool.query(
        "UPDATE attendance SET status = 'Leave (Rejected)', notes = CONCAT(IFNULL(notes, ''), ?) WHERE id IN (?)",
        [rejectionNote, targetIds]
      );

      for (const rec of leaveRecords) {
        const dateStr = new Date(rec.date).toLocaleDateString();
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
          [
            rec.user_id,
            "❌ Leave Request Rejected",
            `Your leave application for ${dateStr} was REJECTED by ${userName}.${reason ? " Reason: " + reason : ""}`,
          ]
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully rejected ${leaveRecords.length} leave application(s).`,
        count: leaveRecords.length,
      });
    }

    // ACTION 3: APPROVE LEAVE CANCELLATION REQUEST
    if (action === "approve_cancel") {
      // Deleting the approved leave record restores the day as a normal workday and restores leave quota balance
      await pool.query("DELETE FROM attendance WHERE id IN (?)", [targetIds]);

      for (const rec of leaveRecords) {
        const dateStr = new Date(rec.date).toLocaleDateString();
        const isHalfDay = rec.status?.includes("Half Day") || rec.notes?.includes("HALF_DAY");
        const leaveTypeStr = isHalfDay ? "half day" : "leave";

        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
          [
            rec.user_id,
            "🏖️ Leave Cancellation Approved",
            `Your request to cancel your approved ${leaveTypeStr} on ${dateStr} has been APPROVED by ${userName}. Your leave balance has been restored.`,
          ]
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully approved cancellation for ${leaveRecords.length} leave(s). The dates are now restored as normal workdays.`,
        count: leaveRecords.length,
      });
    }

    // ACTION 4: REJECT LEAVE CANCELLATION REQUEST
    if (action === "reject_cancel") {
      for (const rec of leaveRecords) {
        // Revert status to original approved status
        const isHalfDay = rec.status?.includes("Half Day") || rec.notes?.includes("HALF_DAY");
        const restoredStatus = isHalfDay ? "Half Day" : "Leave";
        const rejectCancelNote = reason
          ? ` [Cancel Request Rejected by ${userName}: ${reason}]`
          : ` [Cancel Request Rejected by ${userName}]`;

        await pool.query(
          "UPDATE attendance SET status = ?, notes = CONCAT(IFNULL(notes, ''), ?) WHERE id = ?",
          [restoredStatus, rejectCancelNote, rec.id]
        );

        const dateStr = new Date(rec.date).toLocaleDateString();
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
          [
            rec.user_id,
            "❌ Leave Cancellation Request Rejected",
            `Your request to cancel your approved leave on ${dateStr} was REJECTED by ${userName}. The leave remains in effect.${reason ? " Reason: " + reason : ""}`,
          ]
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully rejected cancellation request for ${leaveRecords.length} leave(s).`,
        count: leaveRecords.length,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error processing leave action:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
