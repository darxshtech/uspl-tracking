import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const userId = (session.user as any).id;

    const [userRows]: any = await pool.query(
      "SELECT id, name, email, role, avatar_url, bio, phone, joining_date, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userRows[0];

    // Fetch user activity statistics
    const [attStats]: any = await pool.query(
      "SELECT COUNT(*) as total_days, IFNULL(SUM(total_hours), 0) as total_hours FROM attendance WHERE user_id = ?",
      [userId]
    );

    const [taskStats]: any = await pool.query(
      "SELECT COUNT(*) as completed_tasks FROM tasks WHERE assigned_to = ? AND status IN ('Completed', 'Tested (PASS)', 'Ready for Demo')",
      [userId]
    );

    const [workStats]: any = await pool.query(
      "SELECT COUNT(*) as total_logs, IFNULL(SUM(hours_worked), 0) as total_work_hours FROM daily_work WHERE user_id = ?",
      [userId]
    );

    return NextResponse.json({
      user,
      stats: {
        attendanceDays: attStats[0]?.total_days || 0,
        attendanceHours: parseFloat(attStats[0]?.total_hours || 0).toFixed(1),
        completedTasks: taskStats[0]?.completed_tasks || 0,
        workLogs: workStats[0]?.total_logs || 0,
        workHours: parseFloat(workStats[0]?.total_work_hours || 0).toFixed(1),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const userId = (session.user as any).id;
    const body = await req.json();
    const { name, avatar_url, bio, phone, joining_date } = body;

    await pool.query(
      `UPDATE users 
       SET name = IFNULL(?, name), 
           avatar_url = IFNULL(?, avatar_url), 
           bio = IFNULL(?, bio), 
           phone = IFNULL(?, phone), 
           joining_date = IFNULL(?, joining_date)
       WHERE id = ?`,
      [name || null, avatar_url || null, bio || null, phone || null, joining_date || null, userId]
    );

    return NextResponse.json({ success: true, message: "Profile updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
