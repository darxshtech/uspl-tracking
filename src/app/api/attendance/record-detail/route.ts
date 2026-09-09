import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

/**
 * GET /api/attendance/record-detail?attendance_id=123
 *
 * Returns detailed time breakdown for a single attendance record:
 *  - break sessions (start, end, duration, paused task name)
 *  - task time logs for that day (task title, project, minutes)
 *
 * Auth:
 *  - Management (Admin/CEO/PM): can fetch any record
 *  - Developer/Tester: can only fetch their own records
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const attendanceId = parseInt(searchParams.get("attendance_id") || "0", 10);

  if (!attendanceId || isNaN(attendanceId)) {
    return NextResponse.json({ error: "attendance_id is required" }, { status: 400 });
  }

  const role = (session.user as any).role;
  const sessionUserId = (session.user as any).id;
  const isManagement = ["Admin", "CEO", "PM"].includes(role);

  try {
    // 1. Fetch the attendance record to verify access + get date/user
    const [attRows]: any = await pool.query(
      "SELECT id, user_id, date, login_time, logout_time, total_hours FROM attendance WHERE id = ? LIMIT 1",
      [attendanceId]
    );

    if (!attRows || attRows.length === 0) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    const rec = attRows[0];

    // Authorization: non-management can only view own records
    if (!isManagement && rec.user_id !== sessionUserId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const attendanceDate = new Date(rec.date).toISOString().split("T")[0];

    // 2. Fetch break sessions for this attendance record
    let breaks: any[] = [];
    let totalBreakMinutes = 0;

    try {
      const [breakRows]: any = await pool.query(
        `SELECT
           ab.id,
           ab.break_start,
           ab.break_end,
           ab.duration_minutes,
           ab.paused_task_id,
           t.title as paused_task_title
         FROM attendance_breaks ab
         LEFT JOIN tasks t ON ab.paused_task_id = t.id
         WHERE ab.attendance_id = ?
         ORDER BY ab.break_start ASC`,
        [attendanceId]
      );

      breaks = (breakRows || []).map((b: any) => {
        // Format datetime to IST 12-hour time string
        const formatToIST12 = (dt: Date | null) => {
          if (!dt) return null;
          return new Date(dt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
            timeZone: "Asia/Kolkata",
          });
        };

        return {
          id: b.id,
          break_start: b.break_start,
          break_start_formatted: formatToIST12(b.break_start),
          break_end: b.break_end,
          break_end_formatted: b.break_end ? formatToIST12(b.break_end) : null,
          duration_minutes: b.duration_minutes,
          is_active: !b.break_end,
          paused_task_id: b.paused_task_id,
          paused_task_title: b.paused_task_title || null,
        };
      });

      totalBreakMinutes = breaks
        .filter((b: any) => !b.is_active && b.duration_minutes)
        .reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0);
    } catch (_) {
      // attendance_breaks table may not exist yet — return empty gracefully
      breaks = [];
      totalBreakMinutes = 0;
    }

    // 3. Fetch task time logs for this user on this date
    let taskLogs: any[] = [];
    let totalTaskMinutes = 0;

    try {
      const [taskRows]: any = await pool.query(
        `SELECT
           t.id as task_id,
           t.title as task_title,
           p.name as project_name,
           IFNULL(SUM(ttl.duration_minutes), 0) as total_minutes
         FROM task_time_logs ttl
         JOIN tasks t ON ttl.task_id = t.id
         LEFT JOIN projects p ON t.project_id = p.id
         WHERE ttl.user_id = ?
           AND DATE(ttl.started_at) = ?
           AND ttl.is_active = 0
           AND ttl.duration_minutes IS NOT NULL
           AND ttl.duration_minutes > 0
         GROUP BY t.id, t.title, p.name
         ORDER BY total_minutes DESC`,
        [rec.user_id, attendanceDate]
      );

      taskLogs = (taskRows || []).map((t: any) => ({
        task_id: t.task_id,
        task_title: t.task_title,
        project_name: t.project_name || null,
        total_minutes: parseInt(t.total_minutes, 10) || 0,
      }));

      totalTaskMinutes = taskLogs.reduce(
        (sum: number, t: any) => sum + (t.total_minutes || 0),
        0
      );
    } catch (_) {
      // task_time_logs table may not exist — return empty gracefully
      taskLogs = [];
      totalTaskMinutes = 0;
    }

    // 4. Compute net work time
    const grossMinutes = Math.round((parseFloat(rec.total_hours || "0")) * 60);
    const netMinutes = Math.max(0, grossMinutes - totalBreakMinutes);

    return NextResponse.json({
      attendance_id: attendanceId,
      date: attendanceDate,
      login_time: rec.login_time,
      logout_time: rec.logout_time,
      gross_minutes: grossMinutes,
      total_break_minutes: totalBreakMinutes,
      net_minutes: netMinutes,
      total_task_minutes: totalTaskMinutes,
      breaks,
      task_logs: taskLogs,
    });
  } catch (error: any) {
    console.error("GET /api/attendance/record-detail error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
