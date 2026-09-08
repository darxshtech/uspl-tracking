import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getCurrentISTDate } from "@/lib/timeUtils";

/**
 * GET /api/attendance/team-breaks
 * Returns all employees currently on break (active break_end IS NULL),
 * plus today's total break minutes per employee.
 * Management only (Admin, CEO, PM).
 */
// Ensure attendance_breaks table exists (idempotent)
async function ensureBreaksTable() {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS attendance_breaks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attendance_id INT NOT NULL,
        user_id INT NOT NULL,
        break_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        break_end DATETIME NULL,
        duration_minutes INT NULL,
        paused_task_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ab_user (user_id),
        INDEX idx_ab_attendance (attendance_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  } catch (_) {}

  try {
    const [cols]: any = await pool.query("SHOW COLUMNS FROM attendance_breaks LIKE 'paused_task_id'");
    if (!cols || cols.length === 0) {
      await pool.query("ALTER TABLE attendance_breaks ADD COLUMN paused_task_id INT NULL");
    }
  } catch (_) {}
}

/**
 * GET /api/attendance/team-breaks
 * Returns all employees currently on break (active break_end IS NULL),
 * plus today's total break minutes per employee.
 * Management only (Admin, CEO, PM).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const role = (session.user as any).role;
  if (!["Admin", "CEO", "PM"].includes(role)) {
    return NextResponse.json({ error: "Management access required" }, { status: 403 });
  }

  try {
    await ensureBreaksTable();
    const todayIST = getCurrentISTDate();

    // Employees with an active (open) break right now
    const [onBreakRows]: any = await pool.query(
      `SELECT
         ab.id as break_id,
         ab.attendance_id,
         ab.user_id,
         ab.break_start,
         ab.paused_task_id,
         u.name as user_name,
         u.role as user_role,
         u.email as user_email,
         t.title as paused_task_title,
         t.progress_percentage,
         TIMESTAMPDIFF(SECOND, ab.break_start, CURRENT_TIMESTAMP) as break_elapsed_seconds,
         (
           SELECT IFNULL(SUM(ab2.duration_minutes), 0)
           FROM attendance_breaks ab2
           WHERE ab2.attendance_id = ab.attendance_id AND ab2.break_end IS NOT NULL
         ) as completed_break_minutes_today,
         a.login_time as todays_intime,
         (
           SELECT COUNT(DISTINCT all_p.project_id)
           FROM (
             SELECT pm.project_id, pm.user_id FROM project_members pm
             UNION ALL
             SELECT t_sub.project_id, t_sub.assigned_to as user_id FROM tasks t_sub WHERE t_sub.project_id IS NOT NULL
           ) as all_p
           WHERE all_p.user_id = ab.user_id
         ) as projects_assigned_count,
         (
           SELECT COUNT(DISTINCT t2.project_id) 
           FROM task_time_logs ttl2 
           JOIN tasks t2 ON ttl2.task_id = t2.id 
           WHERE ttl2.user_id = ab.user_id AND DATE(ttl2.started_at) = ? AND t2.project_id IS NOT NULL
         ) as projects_worked_today_count,
         (
           SELECT COUNT(DISTINCT ttl2.task_id) 
           FROM task_time_logs ttl2 
           WHERE ttl2.user_id = ab.user_id AND DATE(ttl2.started_at) = ?
         ) as tasks_worked_today_count
       FROM attendance_breaks ab
       JOIN attendance a ON ab.attendance_id = a.id
       JOIN users u ON ab.user_id = u.id
       LEFT JOIN tasks t ON ab.paused_task_id = t.id
       WHERE ab.break_end IS NULL
         AND (a.date = ? OR (a.date = DATE_SUB(?, INTERVAL 1 DAY) AND a.logout_time IS NULL))
       ORDER BY ab.break_start ASC`,
       [todayIST, todayIST, todayIST, todayIST]
    );

    return NextResponse.json({
      success: true,
      on_break: onBreakRows,
      count: onBreakRows.length,
    });
  } catch (error: any) {
    console.error("GET /api/attendance/team-breaks error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
