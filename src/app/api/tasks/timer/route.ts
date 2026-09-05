import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUserId = parseInt(String((session.user as any).id), 10);
  const currentRole = (session.user as any).role;
  const isManagement = ["PM", "Admin", "CEO"].includes(currentRole);

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "active";
  const taskId = searchParams.get("task_id");

  try {
    // 1. History of sessions for a specific task
    if (mode === "history") {
      if (!taskId) {
        return NextResponse.json({ error: "task_id is required for history mode" }, { status: 400 });
      }

      const [rows]: any = await pool.query(
        `SELECT ttl.*, u.name as user_name, u.role as user_role, u.email as user_email
         FROM task_time_logs ttl
         JOIN users u ON ttl.user_id = u.id
         WHERE ttl.task_id = ?
         ORDER BY ttl.started_at DESC`,
        [taskId]
      );
      return NextResponse.json({ success: true, history: rows });
    }

    // 2. Team live activity monitor (PM, Admin, CEO only)
    if (mode === "team") {
      if (!isManagement) {
        return NextResponse.json({ error: "Unauthorized: Management access required" }, { status: 403 });
      }

      const [rows]: any = await pool.query(
        `SELECT ttl.*, 
                u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role,
                t.id as task_id, t.title as task_title, t.priority, t.status as task_status,
                p.id as project_id, p.name as project_name,
                (
                  SELECT IFNULL(SUM(duration_minutes), 0) * 60 
                  FROM task_time_logs 
                  WHERE task_id = ttl.task_id AND user_id = ttl.user_id AND is_active = 0
                ) as previous_duration_seconds
         FROM task_time_logs ttl
         JOIN users u ON ttl.user_id = u.id
         JOIN tasks t ON ttl.task_id = t.id
         LEFT JOIN projects p ON t.project_id = p.id
         WHERE ttl.is_active = 1
         ORDER BY ttl.started_at DESC`
      );

      // Also get total active count & total hours today
      const todayStr = new Date().toISOString().split("T")[0];
      const [todayStats]: any = await pool.query(
        `SELECT COUNT(DISTINCT user_id) as active_users_count, 
                IFNULL(SUM(duration_minutes), 0) as total_minutes_today
         FROM task_time_logs 
         WHERE DATE(started_at) = ?`,
        [todayStr]
      );

      return NextResponse.json({ 
        success: true, 
        active_timers: rows,
        stats: {
          active_now: rows.length,
          active_users_today: todayStats[0]?.active_users_count || 0,
          total_hours_today: (parseFloat(todayStats[0]?.total_minutes_today || 0) / 60).toFixed(1)
        }
      });
    }

    // 3. Default: User's currently active running timer
    const [activeRows]: any = await pool.query(
      `SELECT ttl.*, 
              t.id as task_id, t.title as task_title, t.priority, t.status as task_status,
              p.name as project_name
       FROM task_time_logs ttl
       JOIN tasks t ON ttl.task_id = t.id
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE ttl.user_id = ? AND ttl.is_active = 1
       ORDER BY ttl.started_at DESC LIMIT 1`,
      [currentUserId]
    );

    let activeTimer = activeRows.length > 0 ? activeRows[0] : null;
    if (activeTimer) {
      // Calculate accumulated seconds from previous finished sessions on this task
      const [prevSum]: any = await pool.query(
        `SELECT IFNULL(SUM(duration_minutes), 0) * 60 as prev_seconds
         FROM task_time_logs
         WHERE task_id = ? AND user_id = ? AND is_active = 0`,
        [activeTimer.task_id, currentUserId]
      );
      activeTimer.previous_duration_seconds = Math.round(parseFloat(prevSum[0]?.prev_seconds || 0));
    }

    return NextResponse.json({
      success: true,
      active_timer: activeTimer
    });
  } catch (error: any) {
    console.error("GET /api/tasks/timer error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUserId = parseInt(String((session.user as any).id), 10);
  const currentUserName = session.user?.name || "User";
  const currentRole = (session.user as any).role;
  const isManagement = ["PM", "Admin", "CEO"].includes(currentRole);

  try {
    const body = await req.json();
    const { action } = body;

    // -------------------------------------------------------------
    // ACTION: START TIMER (With Strict Exclusivity & Completion Checks)
    // -------------------------------------------------------------
    if (action === "start") {
      const { task_id, start_time } = body;
      if (!task_id) {
        return NextResponse.json({ error: "task_id is required" }, { status: 400 });
      }

      // 1. Verify task exists and verify it is not already completed/logged
      const [tasks]: any = await pool.query(
        "SELECT id, title, status, project_id, hours_spent FROM tasks WHERE id = ?",
        [task_id]
      );
      if (tasks.length === 0) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      const task = tasks[0];

      // Validation: Once task is logged as completed, it cannot be started again
      if (task.status === "Completed") {
        return NextResponse.json({
          error: `Task "${task.title}" is already completed and logged (${task.hours_spent || 0}h). Once logged, you cannot start this task again.`
        }, { status: 400 });
      }

      // 2. Validation: If another task timer is active, user cannot start another until the earlier one ends
      const [existingActive]: any = await pool.query(
        `SELECT ttl.id, ttl.task_id, t.title as task_title 
         FROM task_time_logs ttl 
         JOIN tasks t ON ttl.task_id = t.id 
         WHERE ttl.user_id = ? AND ttl.is_active = 1`,
        [currentUserId]
      );

      if (existingActive.length > 0) {
        const currentActive = existingActive[0];
        if (currentActive.task_id === task_id) {
          return NextResponse.json({
            error: `Timer is already running on this task ("${currentActive.task_title}").`
          }, { status: 400 });
        } else {
          return NextResponse.json({
            error: `Another task is currently active ("${currentActive.task_title}"). You cannot start another task timer until the earlier task timer is paused or ended.`
          }, { status: 400 });
        }
      }

      // Determine starting timestamp: Regular employees always start at now.
      // Only management (PM, Admin, CEO) may supply a custom start_time.
      let effectiveStartTime = new Date();
      if (isManagement && start_time) {
        const customDate = new Date(start_time);
        if (!isNaN(customDate.getTime())) {
          effectiveStartTime = customDate;
        }
      }
      const startTimeFormatted = effectiveStartTime.toISOString().slice(0, 19).replace('T', ' ');

      // 3. Insert new active timer
      const [insertResult]: any = await pool.query(
        `INSERT INTO task_time_logs (task_id, user_id, started_at, is_active) 
         VALUES (?, ?, ?, 1)`,
        [task_id, currentUserId, startTimeFormatted]
      );

      // 4. Update task status to "In Progress" if currently "Assigned"
      if (task.status === "Assigned") {
        await pool.query("UPDATE tasks SET status = 'In Progress' WHERE id = ?", [task_id]);
      }

      return NextResponse.json({
        success: true,
        message: "Timer started successfully",
        timer_id: insertResult.insertId,
        task_id,
        started_at: startTimeFormatted,
        paused_previous_count: existingActive.length
      }, { status: 201 });
    }

    // -------------------------------------------------------------
    // ACTION: PAUSE (Break / Pause session, to be resumed later)
    // -------------------------------------------------------------
    if (action === "pause") {
      const { task_id, end_time, session_summary, blockers } = body;

      let query = "SELECT * FROM task_time_logs WHERE user_id = ? AND is_active = 1";
      const params: any[] = [currentUserId];
      if (task_id) {
        query += " AND task_id = ?";
        params.push(task_id);
      }
      query += " ORDER BY started_at DESC LIMIT 1";

      const [activeLogs]: any = await pool.query(query, params);
      if (activeLogs.length === 0) {
        return NextResponse.json({ error: "No active running timer found to pause." }, { status: 404 });
      }

      const activeTimer = activeLogs[0];
      const effectiveEndTime = end_time ? new Date(end_time) : new Date();
      const startTime = new Date(activeTimer.started_at);
      const durationMins = Math.max(1, Math.round((effectiveEndTime.getTime() - startTime.getTime()) / (1000 * 60)));
      const endTimeFormatted = effectiveEndTime.toISOString().slice(0, 19).replace('T', ' ');

      // Update timer log as paused
      await pool.query(
        `UPDATE task_time_logs 
         SET ended_at = ?, duration_minutes = ?, session_summary = IFNULL(?, 'Paused for break'), is_active = 0 
         WHERE id = ?`,
        [endTimeFormatted, durationMins, session_summary || null, activeTimer.id]
      );

      const totalHours = await syncTaskHours(activeTimer.task_id);

      if (blockers) {
        await pool.query("UPDATE tasks SET blockers = ? WHERE id = ?", [blockers, activeTimer.task_id]);
      }

      // Auto-sync session to daily_work
      try {
        const [taskInfo]: any = await pool.query("SELECT title, project_id, status FROM tasks WHERE id = ?", [activeTimer.task_id]);
        const project_id = taskInfo[0]?.project_id || null;
        const taskTitle = taskInfo[0]?.title || "Task";
        const sessionHours = parseFloat((durationMins / 60).toFixed(2));
        const todayStr = effectiveEndTime.toISOString().split("T")[0];

        await pool.query(
          `INSERT INTO daily_work (user_id, project_id, task_id, date, hours_worked, work_description, status, remarks)
           VALUES (?, ?, ?, ?, ?, ?, 'In Progress', ?)`,
          [
            currentUserId,
            project_id,
            activeTimer.task_id,
            todayStr,
            sessionHours,
            session_summary || `[Paused] Worked on: ${taskTitle} (${durationMins} mins)`,
            blockers || "Paused - on break"
          ]
        );
      } catch (workLogErr) {
        console.error("Failed to auto-sync pause session to daily_work:", workLogErr);
      }

      return NextResponse.json({
        success: true,
        is_paused: true,
        message: "Timer paused for break. You can resume work when you return.",
        duration_minutes: durationMins,
        hours_spent: totalHours,
        ended_at: endTimeFormatted
      });
    }

    // -------------------------------------------------------------
    // ACTION: STOP / FINISH (Task Done / Completed)
    // -------------------------------------------------------------
    if (action === "stop" || action === "complete" || action === "finish") {
      const { task_id, end_time, session_summary, blockers, task_status } = body;

      let query = "SELECT * FROM task_time_logs WHERE user_id = ? AND is_active = 1";
      const params: any[] = [currentUserId];
      if (task_id) {
        query += " AND task_id = ?";
        params.push(task_id);
      }
      query += " ORDER BY started_at DESC LIMIT 1";

      const [activeLogs]: any = await pool.query(query, params);
      
      let durationMins = 0;
      let effectiveEndTime = end_time ? new Date(end_time) : new Date();
      let endTimeFormatted = effectiveEndTime.toISOString().slice(0, 19).replace('T', ' ');
      let targetTaskId = task_id;

      if (activeLogs.length > 0) {
        const activeTimer = activeLogs[0];
        targetTaskId = activeTimer.task_id;
        const startTime = new Date(activeTimer.started_at);
        durationMins = Math.max(1, Math.round((effectiveEndTime.getTime() - startTime.getTime()) / (1000 * 60)));

        await pool.query(
          `UPDATE task_time_logs 
           SET ended_at = ?, duration_minutes = ?, session_summary = IFNULL(?, 'Task finished & timer stopped'), is_active = 0 
           WHERE id = ?`,
          [endTimeFormatted, durationMins, session_summary || null, activeTimer.id]
        );
      }

      if (!targetTaskId) {
        return NextResponse.json({ error: "task_id is required" }, { status: 400 });
      }

      // Sync cumulative hours_spent to task
      const totalHours = await syncTaskHours(targetTaskId);

      // Mark task completed / done with 100% progress
      const finalStatus = task_status || "Completed";
      await pool.query(
        `UPDATE tasks 
         SET status = ?, 
             progress_percentage = 100, 
             daily_summary = IFNULL(?, daily_summary),
             blockers = IFNULL(?, blockers) 
         WHERE id = ?`,
        [finalStatus, session_summary || "Task completed via timer stop", blockers || null, targetTaskId]
      );

      // Auto-sync final completion into daily_work
      try {
        const [taskInfo]: any = await pool.query("SELECT title, project_id FROM tasks WHERE id = ?", [targetTaskId]);
        const project_id = taskInfo[0]?.project_id || null;
        const taskTitle = taskInfo[0]?.title || "Task";
        const sessionHours = parseFloat((durationMins / 60).toFixed(2));
        const todayStr = effectiveEndTime.toISOString().split("T")[0];

        await pool.query(
          `INSERT INTO daily_work (user_id, project_id, task_id, date, hours_worked, work_description, status, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            currentUserId,
            project_id,
            targetTaskId,
            todayStr,
            sessionHours > 0 ? sessionHours : totalHours,
            session_summary || `[Completed] Finished task: ${taskTitle} (Total: ${totalHours}h)`,
            finalStatus,
            "Task marked done via timer"
          ]
        );
      } catch (workLogErr) {
        console.error("Failed to auto-sync stop session to daily_work:", workLogErr);
      }

      return NextResponse.json({
        success: true,
        is_completed: true,
        message: `Task finished and marked ${finalStatus}! Total hours spent: ${totalHours}h recorded.`,
        duration_minutes: durationMins,
        hours_spent: totalHours,
        ended_at: endTimeFormatted
      });
    }

    // -------------------------------------------------------------
    // ACTION: EDIT PAST LOG (PM, Admin & CEO Only)
    // -------------------------------------------------------------
    if (action === "edit_log") {
      if (!isManagement) {
        return NextResponse.json({ error: "Unauthorized: Only PM, Admin, and CEO can manually adjust past timer logs." }, { status: 403 });
      }

      const { log_id, started_at, ended_at, session_summary } = body;
      if (!log_id || !started_at || !ended_at) {
        return NextResponse.json({ error: "log_id, started_at, and ended_at are required" }, { status: 400 });
      }

      const start = new Date(started_at);
      const end = new Date(ended_at);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return NextResponse.json({ error: "Invalid date range: ended_at must be strictly after started_at" }, { status: 400 });
      }

      const durationMins = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
      const startFormatted = start.toISOString().slice(0, 19).replace('T', ' ');
      const endFormatted = end.toISOString().slice(0, 19).replace('T', ' ');

      // Find log to identify task_id
      const [targetLog]: any = await pool.query("SELECT task_id FROM task_time_logs WHERE id = ?", [log_id]);
      if (targetLog.length === 0) {
        return NextResponse.json({ error: "Time log entry not found" }, { status: 404 });
      }

      await pool.query(
        `UPDATE task_time_logs 
         SET started_at = ?, ended_at = ?, duration_minutes = ?, session_summary = IFNULL(?, session_summary)
         WHERE id = ?`,
        [startFormatted, endFormatted, durationMins, session_summary !== undefined ? session_summary : null, log_id]
      );

      const totalHours = await syncTaskHours(targetLog[0].task_id);

      return NextResponse.json({
        success: true,
        message: "Time log updated successfully by manager",
        duration_minutes: durationMins,
        total_hours: totalHours
      });
    }

    // -------------------------------------------------------------
    // ACTION: DELETE PAST LOG (PM, Admin & CEO Only)
    // -------------------------------------------------------------
    if (action === "delete_log") {
      if (!isManagement) {
        return NextResponse.json({ error: "Unauthorized: Only PM, Admin, and CEO can delete timer logs." }, { status: 403 });
      }

      const { log_id } = body;
      if (!log_id) {
        return NextResponse.json({ error: "log_id is required" }, { status: 400 });
      }

      const [targetLog]: any = await pool.query("SELECT task_id FROM task_time_logs WHERE id = ?", [log_id]);
      if (targetLog.length === 0) {
        return NextResponse.json({ error: "Time log entry not found" }, { status: 404 });
      }

      await pool.query("DELETE FROM task_time_logs WHERE id = ?", [log_id]);
      const totalHours = await syncTaskHours(targetLog[0].task_id);

      return NextResponse.json({
        success: true,
        message: "Time log deleted successfully and task hours recalculated",
        total_hours: totalHours
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/tasks/timer error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper: Calculate total duration of all finished sessions on a task and update tasks.hours_spent
async function syncTaskHours(taskId: number): Promise<number> {
  const [sumResult]: any = await pool.query(
    "SELECT IFNULL(SUM(duration_minutes), 0) as total_mins FROM task_time_logs WHERE task_id = ? AND is_active = 0",
    [taskId]
  );
  const totalMins = parseFloat(sumResult[0]?.total_mins || 0);
  const totalHours = parseFloat((totalMins / 60).toFixed(2));

  await pool.query("UPDATE tasks SET hours_spent = ? WHERE id = ?", [totalHours, taskId]);
  return totalHours;
}
