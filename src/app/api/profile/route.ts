import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// Ensure avatar_url exists in users table safely
async function ensureAvatarColumn() {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL");
  } catch (_) {
    // Column already exists or table locked - ignore
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const userId = (session.user as any).id;
    await ensureAvatarColumn();

    let user: any = null;
    try {
      const [userRows]: any = await pool.query(
        "SELECT id, name, email, role, avatar_url, bio, phone, joining_date, created_at FROM users WHERE id = ?",
        [userId]
      );
      if (userRows && userRows.length > 0) {
        user = userRows[0];
      }
    } catch (colErr) {
      // Fallback without avatar_url column
      const [fallbackRows]: any = await pool.query(
        "SELECT id, name, email, role, bio, phone, joining_date, created_at FROM users WHERE id = ?",
        [userId]
      );
      if (fallbackRows && fallbackRows.length > 0) {
        user = { ...fallbackRows[0], avatar_url: null };
      }
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch user activity statistics safely
    let attStats: any = [{ total_days: 0, total_hours: 0 }];
    let taskStats: any = [{ completed_tasks: 0 }];
    let workStats: any = [{ total_logs: 0, total_work_hours: 0 }];

    try {
      const [res]: any = await pool.query(
        "SELECT COUNT(*) as total_days, IFNULL(SUM(total_hours), 0) as total_hours FROM attendance WHERE user_id = ?",
        [userId]
      );
      attStats = res;
    } catch (_) {}

    try {
      const [res]: any = await pool.query(
        "SELECT COUNT(*) as completed_tasks FROM tasks WHERE assigned_to = ? AND status IN ('Completed', 'Tested (PASS)', 'Ready for Demo')",
        [userId]
      );
      taskStats = res;
    } catch (_) {}

    try {
      const [res]: any = await pool.query(
        "SELECT COUNT(*) as total_logs, IFNULL(SUM(hours_worked), 0) as total_work_hours FROM daily_work WHERE user_id = ?",
        [userId]
      );
      workStats = res;
    } catch (_) {}

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
    console.error("GET /api/profile error:", error);
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

    await ensureAvatarColumn();

    // Sanitize joining_date so empty string does not throw MySQL date error
    let sanitizedDate: string | null = null;
    if (joining_date && typeof joining_date === "string" && joining_date.trim().length >= 8) {
      sanitizedDate = joining_date.trim();
    }

    try {
      await pool.query(
        `UPDATE users 
         SET name = IFNULL(?, name), 
             avatar_url = IFNULL(?, avatar_url), 
             bio = IFNULL(?, bio), 
             phone = IFNULL(?, phone), 
             joining_date = ?
         WHERE id = ?`,
        [
          name || null, 
          avatar_url || null, 
          bio !== undefined ? (bio || null) : null, 
          phone !== undefined ? (phone || null) : null, 
          sanitizedDate, 
          userId
        ]
      );
    } catch (updateErr) {
      // Fallback if avatar_url column fails
      await pool.query(
        `UPDATE users 
         SET name = IFNULL(?, name), 
             bio = IFNULL(?, bio), 
             phone = IFNULL(?, phone), 
             joining_date = ?
         WHERE id = ?`,
        [
          name || null, 
          bio !== undefined ? (bio || null) : null, 
          phone !== undefined ? (phone || null) : null, 
          sanitizedDate, 
          userId
        ]
      );
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully" });
  } catch (error: any) {
    console.error("PUT /api/profile error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
