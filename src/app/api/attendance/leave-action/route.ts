import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// GET /api/attendance/leave-action
// Fetches all pending leave applications across employees for PM, CEO, and Admin
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
       WHERE a.status = 'Leave (Pending)' OR a.status LIKE '%Pending%'
       ORDER BY a.date ASC, u.name ASC`
    );

    return NextResponse.json({ pendingLeaves: pendingRows });
  } catch (error: any) {
    console.error("Error fetching pending leaves:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/attendance/leave-action
// Action: 'approve' | 'reject'
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userName = (session?.user as any)?.name || userRole || "Management";

  if (!session || !["Admin", "CEO", "PM"].includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized: PM, CEO or Admin role required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ids, action, leave_type = "Leave", reason } = body;

    const targetIds: number[] = Array.isArray(ids) ? ids : id ? [id] : [];

    if (targetIds.length === 0) {
      return NextResponse.json({ error: "No leave record IDs provided" }, { status: 400 });
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 });
    }

    // Fetch details of target leave records for notifications
    const [leaveRecords]: any = await pool.query(
      `SELECT a.id, a.user_id, a.date, u.name as employee_name
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE a.id IN (?)`,
      [targetIds]
    );

    if (leaveRecords.length === 0) {
      return NextResponse.json({ error: "No matching leave records found" }, { status: 404 });
    }

    let updatedCount = 0;

    if (action === "approve") {
      const finalStatus = leave_type || "Leave";
      await pool.query(
        `UPDATE attendance 
         SET status = ?, notes = CONCAT(IFNULL(notes, ''), ' [Approved by ', ?, ']')
         WHERE id IN (?)`,
        [finalStatus, userName, targetIds]
      );
      updatedCount = targetIds.length;

      // Send notifications to each employee
      for (const rec of leaveRecords) {
        const dateStr = new Date(rec.date).toLocaleDateString();
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
          [
            rec.user_id,
            `🏖️ Leave Request Approved (${finalStatus})`,
            `Your leave application for ${dateStr} has been APPROVED by ${userName}.`
          ]
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully approved ${updatedCount} leave request(s) as '${finalStatus}'`,
        count: updatedCount
      });
    } else {
      // Reject action
      const rejectionNote = reason ? ` [Rejected by ${userName}: ${reason}]` : ` [Rejected by ${userName}]`;
      await pool.query(
        `UPDATE attendance 
         SET status = 'Leave (Rejected)', notes = CONCAT(IFNULL(notes, ''), ?)
         WHERE id IN (?)`,
        [rejectionNote, targetIds]
      );
      updatedCount = targetIds.length;

      // Send notifications to each employee
      for (const rec of leaveRecords) {
        const dateStr = new Date(rec.date).toLocaleDateString();
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
          [
            rec.user_id,
            "❌ Leave Request Rejected",
            `Your leave application for ${dateStr} was REJECTED by ${userName}.${reason ? " Reason: " + reason : ""}`
          ]
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully rejected ${updatedCount} leave request(s)`,
        count: updatedCount
      });
    }
  } catch (error: any) {
    console.error("Error processing leave action:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
