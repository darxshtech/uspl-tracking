import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// POST /api/attendance/leave-cancel
// Allows an employee to directly cancel an unapproved (pending) leave application
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
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Leave record ID is required" }, { status: 400 });
    }

    // Fetch the target attendance record
    const [rows]: any = await pool.query(
      `SELECT a.id, a.user_id, a.date, a.status, a.notes, u.name as employee_name
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Leave record not found" }, { status: 404 });
    }

    const leaveRecord = rows[0];

    // Verify ownership (must be the requesting employee or management)
    if (!isManagement && leaveRecord.user_id !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only cancel your own leave requests" },
        { status: 403 }
      );
    }

    // Verify status is actually pending (not yet approved)
    const currentStatus = (leaveRecord.status || "").trim();
    if (!currentStatus.includes("Pending")) {
      return NextResponse.json(
        {
          error: `Cannot directly cancel leave with status '${currentStatus}'. If this leave was already approved, please submit a Cancellation Request instead.`,
        },
        { status: 400 }
      );
    }

    // Delete the pending attendance record so the date returns to a normal workday
    await pool.query("DELETE FROM attendance WHERE id = ?", [id]);

    const dateStr = new Date(leaveRecord.date).toLocaleDateString();
    const isHalfDay = currentStatus.includes("Half Day") || (leaveRecord.notes && leaveRecord.notes.includes("HALF_DAY"));
    const leaveLabel = isHalfDay ? "Half Day" : "Leave";

    // Notify PM, Admin, CEO that the pending leave was cancelled
    try {
      const [mgmtUsers]: any = await pool.query(
        "SELECT id FROM users WHERE role IN ('Admin', 'CEO', 'PM') AND is_active = 1"
      );

      if (mgmtUsers && mgmtUsers.length > 0) {
        const notifTitle = "🚫 Leave Application Cancelled";
        const notifMsg = `${userName} cancelled their pending ${leaveLabel} application for ${dateStr}.`;
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
      console.error("Failed to notify management of leave cancellation:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully cancelled pending ${leaveLabel} application for ${dateStr}.`,
    });
  } catch (error: any) {
    console.error("Error cancelling pending leave:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
