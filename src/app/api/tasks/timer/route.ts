import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { formatHoursAndMinutes, getCurrentISTDate } from "@/lib/timeUtils";

function parseISTTimeToDate(timeStr: string, dateStr: string): Date | null {
  if (!timeStr || !dateStr) return null;
  const is12Hour = /am|pm/i.test(timeStr);
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (is12Hour) {
    const parts = timeStr.trim().split(/[:\s]/);
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
    seconds = parseInt(parts[2], 10) || 0;
    const meridian = (parts[parts.length - 1] || "").toUpperCase();
    if (meridian === "PM" && hours < 12) hours += 12;
    if (meridian === "AM" && hours === 12) hours = 0;
  } else {
    const [h, m, s] = timeStr.split(":").map(Number);
    hours = h || 0;
    minutes = m || 0;
    seconds = s || 0;
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  const isoStr = `${dateStr}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+05:30`;
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatToMySQLDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

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
    // 0. Auto-healing: Fix any legacy records where started_at was saved with UTC offset (started_at < created_at - 1 hour)
    await pool.query(
      `UPDATE task_time_logs 
       SET started_at = created_at 
       WHERE is_active = 1 AND started_at < (created_at - INTERVAL 1 HOUR)`
    ).catch(() => {});

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

      // Auto-heal: If any employee has multiple active timer rows, keep only the latest one and close the rest
      try {
        await pool.query(
          `UPDATE task_time_logs ttl
           JOIN (
             SELECT user_id, MAX(id) as keep_id
             FROM task_time_logs
             WHERE is_active = 1
             GROUP BY user_id
             HAVING COUNT(*) > 1
           ) dup ON ttl.user_id = dup.user_id
           SET ttl.is_active = 0,
               ttl.ended_at = ttl.started_at,
               ttl.duration_minutes = 0,
               ttl.session_summary = 'Auto-closed duplicate concurrent session'
           WHERE ttl.is_active = 1 AND ttl.id != dup.keep_id`
        );
      } catch (healErr) {
        console.warn("Auto-heal duplicate active timers warning:", healErr);
      }

      const todayIST = getCurrentISTDate();
      const [rows]: any = await pool.query(
        `SELECT ttl.*, 
                u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role,
                t.id as task_id, t.title as task_title, t.priority, t.status as task_status,
                t.progress_percentage, t.daily_summary, t.blockers,
                t.start_date as task_assigned_start_date,
                COALESCE(
                  (
                    SELECT MIN(started_at) 
                    FROM task_time_logs 
                    WHERE task_id = ttl.task_id AND user_id = ttl.user_id
                  ),
                  (
                    SELECT MIN(started_at) 
                    FROM task_time_logs 
                    WHERE task_id = ttl.task_id
                  ),
                  ttl.started_at
                ) as first_timer_started_at,
                (
                  SELECT MAX(created_at) 
                  FROM daily_work 
                  WHERE task_id = ttl.task_id AND user_id = ttl.user_id
                ) as last_progress_checkin_at,
                p.id as project_id, p.name as project_name,
                TIMESTAMPDIFF(SECOND, ttl.started_at, CURRENT_TIMESTAMP) as current_session_seconds,
                (
                  SELECT IFNULL(SUM(duration_minutes), 0) * 60 
                  FROM task_time_logs 
                  WHERE task_id = ttl.task_id AND user_id = ttl.user_id AND is_active = 0
                ) as previous_duration_seconds,
                DATE_FORMAT(att.date, '%Y-%m-%d') as attendance_date,
                att.login_time as todays_intime,
                att.logout_time as todays_outtime,
                att.total_hours as todays_attendance_hours,
                att.status as attendance_status,
                (
                  SELECT COUNT(*) FROM attendance_breaks ab 
                  WHERE ab.attendance_id = att.id AND ab.break_end IS NULL
                ) > 0 as is_on_break,
                (
                  SELECT ab.break_start FROM attendance_breaks ab 
                  WHERE ab.attendance_id = att.id AND ab.break_end IS NULL 
                  ORDER BY ab.break_start DESC LIMIT 1
                ) as active_break_start,
                (
                  SELECT IFNULL(SUM(ab.duration_minutes), 0) FROM attendance_breaks ab 
                  WHERE ab.attendance_id = att.id AND ab.break_end IS NOT NULL
                ) as today_break_minutes,
                (
                  SELECT COUNT(DISTINCT all_p.project_id)
                  FROM (
                    SELECT pm.project_id, pm.user_id FROM project_members pm
                    UNION ALL
                    SELECT t_sub.project_id, t_sub.assigned_to as user_id FROM tasks t_sub WHERE t_sub.project_id IS NOT NULL
                  ) as all_p
                  WHERE all_p.user_id = ttl.user_id
                ) as projects_assigned_count,
                (
                  SELECT COUNT(DISTINCT t2.project_id) 
                  FROM task_time_logs ttl2 
                  JOIN tasks t2 ON ttl2.task_id = t2.id 
                  WHERE ttl2.user_id = ttl.user_id AND DATE(ttl2.started_at) = ? AND t2.project_id IS NOT NULL
                ) as projects_worked_today_count,
                (
                  SELECT COUNT(DISTINCT ttl2.task_id) 
                  FROM task_time_logs ttl2 
                  WHERE ttl2.user_id = ttl.user_id AND DATE(ttl2.started_at) = ?
                ) as tasks_worked_today_count
         FROM task_time_logs ttl
         INNER JOIN (
           SELECT user_id, MAX(id) as max_id 
           FROM task_time_logs 
           WHERE is_active = 1 
           GROUP BY user_id
         ) latest ON ttl.id = latest.max_id
         JOIN users u ON ttl.user_id = u.id
         JOIN tasks t ON ttl.task_id = t.id
         LEFT JOIN projects p ON t.project_id = p.id
         LEFT JOIN attendance att ON att.id = (
           SELECT a2.id FROM attendance a2 
           WHERE a2.user_id = ttl.user_id 
             AND a2.login_time IS NOT NULL 
             AND (a2.date = ? OR (a2.date = DATE_SUB(?, INTERVAL 1 DAY) AND a2.logout_time IS NULL))
           ORDER BY a2.date DESC, a2.id DESC 
           LIMIT 1
         )
         WHERE ttl.is_active = 1
         ORDER BY ttl.started_at DESC`,
        [todayIST, todayIST, todayIST, todayIST]
      );

      const nowMs = Date.now();
      const enrichedRows = rows.map((r: any) => {
        let officeElapsedSeconds = 0;
        if (r.todays_intime && r.attendance_date) {
          const loginDate = parseISTTimeToDate(r.todays_intime, r.attendance_date);
          if (loginDate) {
            if (r.todays_outtime) {
              const logoutDate = parseISTTimeToDate(r.todays_outtime, r.attendance_date);
              if (logoutDate) {
                officeElapsedSeconds = Math.max(0, Math.floor((logoutDate.getTime() - loginDate.getTime()) / 1000));
              } else if (Number(r.todays_attendance_hours) > 0) {
                officeElapsedSeconds = Math.floor(Number(r.todays_attendance_hours) * 3600);
              }
            } else {
              officeElapsedSeconds = Math.max(0, Math.floor((nowMs - loginDate.getTime()) / 1000));
            }
          }
        }

        const prevSecs = Number(r.previous_duration_seconds) || 0;
        const curSecs = Number(r.current_session_seconds) || 0;
        const totalTaskSecs = prevSecs + curSecs;

        // Progress Overdue: Task running >= 45 mins without progress update
        let isProgressOverdue = false;
        if (totalTaskSecs >= 2700) {
          if (!r.last_progress_checkin_at) {
            isProgressOverdue = true;
          } else {
            const lastCheckinMs = new Date(r.last_progress_checkin_at).getTime();
            const secsSinceCheckin = Math.max(0, Math.floor((nowMs - lastCheckinMs) / 1000));
            if (secsSinceCheckin >= 2700) {
              isProgressOverdue = true;
            }
          }
        }

        return {
          ...r,
          total_task_elapsed_seconds: totalTaskSecs,
          is_progress_overdue: isProgressOverdue,
          office_elapsed_seconds: officeElapsedSeconds
        };
      });

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
        active_timers: enrichedRows,
        stats: {
          active_now: enrichedRows.length,
          active_users_today: todayStats[0]?.active_users_count || 0,
          total_hours_today: (parseFloat(todayStats[0]?.total_minutes_today || 0) / 60).toFixed(1)
        }
      });
    }

    // 3. Default: User's currently active running timer
    const [activeRows]: any = await pool.query(
      `SELECT ttl.*, 
              t.id as task_id, t.title as task_title, t.priority, t.status as task_status,
              t.progress_percentage, t.daily_summary, t.blockers,
              p.name as project_name,
              p.is_fast_track as project_is_fast_track,
              TIMESTAMPDIFF(SECOND, ttl.started_at, CURRENT_TIMESTAMP) as current_session_seconds,
              (
                SELECT MAX(created_at) 
                FROM daily_work 
                WHERE task_id = ttl.task_id AND user_id = ttl.user_id
              ) as last_progress_checkin_at
       FROM task_time_logs ttl
       JOIN tasks t ON ttl.task_id = t.id
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE ttl.user_id = ? AND ttl.is_active = 1
       ORDER BY ttl.started_at DESC LIMIT 1`,
      [currentUserId]
    );

    let activeTimer = activeRows.length > 0 ? activeRows[0] : null;
    if (activeTimer) {
      // Auto-heal: If task is in a terminal or verification state, deactivate any lingering timer
      const LOCKED_STATUSES = [
        "Completed",
        "Ready for Demo",
        "Ready for Testing",
        "Testing",
        "Tested (PASS)"
      ];
      if (LOCKED_STATUSES.includes(activeTimer.task_status)) {
        await pool.query(
          `UPDATE task_time_logs 
           SET ended_at = CURRENT_TIMESTAMP, 
               duration_minutes = GREATEST(1, ROUND(TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP) / 60)), 
               session_summary = CONCAT('Auto-stopped on task state: ', ?), 
               is_active = 0 
           WHERE id = ?`,
          [activeTimer.task_status, activeTimer.id]
        );
        await syncTaskHours(activeTimer.task_id);
        activeTimer = null;
      }
    }

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

      // Validation: Once task is logged as completed, submitted for demo, or in QA testing, timer cannot be started or resumed
      const NON_STARTABLE_STATUSES = [
        "Completed",
        "Ready for Demo",
        "Ready for Testing",
        "Testing",
        "Tested (PASS)"
      ];
      if (NON_STARTABLE_STATUSES.includes(task.status)) {
        let reason = `Task "${task.title}" is in "${task.status}" state.`;
        if (task.status === "Completed") {
          reason = `Task "${task.title}" is already completed and logged (${formatHoursAndMinutes(task.hours_spent)}). Once logged, you cannot start or resume this task again.`;
        } else if (task.status === "Ready for Demo") {
          reason = `Task "${task.title}" has been submitted for Demo. Once submitted for Demo, timer cannot be started or resumed.`;
        } else if (task.status === "Ready for Testing" || task.status === "Testing") {
          reason = `Task "${task.title}" is currently in QA testing ("${task.status}"). Timer cannot be started or resumed while under QA review.`;
        } else if (task.status === "Tested (PASS)") {
          reason = `Task "${task.title}" has passed QA verification ("Tested (PASS)"). Timer is locked unless changes are requested.`;
        }
        return NextResponse.json({ error: reason }, { status: 400 });
      }

      // Check-In Validation: Verify employee has an active open shift
      if (!isManagement) {
        const [openShift]: any = await pool.query(
          "SELECT id FROM attendance WHERE user_id = ? AND login_time IS NOT NULL AND logout_time IS NULL ORDER BY date DESC LIMIT 1",
          [currentUserId]
        );
        if (openShift.length === 0) {
          return NextResponse.json({ error: "You must be Checked-In to start a task timer." }, { status: 400 });
        }
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

      // 3. Atomic exclusivity safeguard: Ensure any lingering active timer for this user is closed
      await pool.query(
        `UPDATE task_time_logs 
         SET is_active = 0, 
             ended_at = CURRENT_TIMESTAMP, 
             duration_minutes = GREATEST(1, ROUND(TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP) / 60)),
             session_summary = IFNULL(session_summary, 'Auto-closed on new task start')
         WHERE user_id = ? AND is_active = 1`,
        [currentUserId]
      );

      // Insert new active timer using MySQL CURRENT_TIMESTAMP to avoid TZ discrepancies
      let insertQuery = `INSERT INTO task_time_logs (task_id, user_id, started_at, is_active) VALUES (?, ?, CURRENT_TIMESTAMP, 1)`;
      let insertParams: any[] = [task_id, currentUserId];

      if (isManagement && start_time) {
        const customDate = new Date(start_time);
        if (!isNaN(customDate.getTime())) {
          insertQuery = `INSERT INTO task_time_logs (task_id, user_id, started_at, is_active) VALUES (?, ?, ?, 1)`;
          insertParams = [task_id, currentUserId, formatToMySQLDateTime(customDate)];
        }
      }

      const [insertResult]: any = await pool.query(insertQuery, insertParams);

      // Fetch the actual started_at from the database
      const [insertedRows]: any = await pool.query(
        "SELECT started_at FROM task_time_logs WHERE id = ?",
        [insertResult.insertId]
      );
      const dbStartedAt = insertedRows[0]?.started_at;

      // 4. Update task status to "In Progress" if currently "Assigned"
      if (task.status === "Assigned" || task.status === "Planning") {
        await pool.query("UPDATE tasks SET status = 'In Progress' WHERE id = ?", [task_id]);
      }

      return NextResponse.json({
        success: true,
        message: "Timer started successfully",
        timer_id: insertResult.insertId,
        task_id,
        started_at: dbStartedAt,
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

      let updateSql = `
        UPDATE task_time_logs 
        SET ended_at = CURRENT_TIMESTAMP, 
            duration_minutes = GREATEST(1, ROUND(TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP) / 60)), 
            session_summary = IFNULL(?, 'Paused for break'), 
            is_active = 0 
        WHERE id = ?
      `;
      let updateParams: any[] = [session_summary || null, activeTimer.id];

      if (end_time) {
        const customEndDate = new Date(end_time);
        if (!isNaN(customEndDate.getTime())) {
          const formattedEnd = formatToMySQLDateTime(customEndDate);
          updateSql = `
            UPDATE task_time_logs 
            SET ended_at = ?, 
                duration_minutes = GREATEST(1, ROUND(TIMESTAMPDIFF(SECOND, started_at, ?) / 60)), 
                session_summary = IFNULL(?, 'Paused for break'), 
                is_active = 0 
            WHERE id = ?
          `;
          updateParams = [formattedEnd, formattedEnd, session_summary || null, activeTimer.id];
        }
      }

      await pool.query(updateSql, updateParams);

      const [updatedLog]: any = await pool.query(
        "SELECT duration_minutes, ended_at, DATE(ended_at) as log_date FROM task_time_logs WHERE id = ?",
        [activeTimer.id]
      );
      const durationMins = updatedLog[0]?.duration_minutes || 1;
      const endTimeFormatted = updatedLog[0]?.ended_at;
      const todayStr = updatedLog[0]?.log_date || new Date().toISOString().split("T")[0];

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
      let endTimeFormatted = null;
      let targetTaskId = task_id;

      if (activeLogs.length > 0) {
        const activeTimer = activeLogs[0];
        targetTaskId = activeTimer.task_id;

        let updateSql = `
          UPDATE task_time_logs 
          SET ended_at = CURRENT_TIMESTAMP, 
              duration_minutes = GREATEST(1, ROUND(TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP) / 60)), 
              session_summary = IFNULL(?, 'Task finished & timer stopped'), 
              is_active = 0 
          WHERE id = ?
        `;
        let updateParams: any[] = [session_summary || null, activeTimer.id];

        if (end_time) {
          const customEndDate = new Date(end_time);
          if (!isNaN(customEndDate.getTime())) {
            const formattedEnd = formatToMySQLDateTime(customEndDate);
            updateSql = `
              UPDATE task_time_logs 
              SET ended_at = ?, 
                  duration_minutes = GREATEST(1, ROUND(TIMESTAMPDIFF(SECOND, started_at, ?) / 60)), 
                  session_summary = IFNULL(?, 'Task finished & timer stopped'), 
                  is_active = 0 
              WHERE id = ?
            `;
            updateParams = [formattedEnd, formattedEnd, session_summary || null, activeTimer.id];
          }
        }

        await pool.query(updateSql, updateParams);

        const [updatedLog]: any = await pool.query(
          "SELECT duration_minutes, ended_at, DATE(ended_at) as log_date FROM task_time_logs WHERE id = ?",
          [activeTimer.id]
        );
        durationMins = updatedLog[0]?.duration_minutes || 1;
        endTimeFormatted = updatedLog[0]?.ended_at;
      }

      if (!targetTaskId) {
        return NextResponse.json({ error: "task_id is required" }, { status: 400 });
      }

      // Sync cumulative hours_spent to task
      const totalHours = await syncTaskHours(targetTaskId);

      // Mark task completed / done with 100% progress
      const { task_links, task_link } = body;
      const finalStatus = task_status || "Completed";
      
      let linkParams: any[] = [];
      let extraSet = "";
      if (task_links || task_link) {
        const cleanedLinks = Array.isArray(task_links) 
          ? task_links.filter((l: any) => l && String(l).trim()) 
          : (task_link && String(task_link).trim() ? [String(task_link).trim()] : []);
        if (cleanedLinks.length > 0) {
          extraSet += ", task_link = ?, task_links = ?";
          linkParams.push(cleanedLinks[0], JSON.stringify(cleanedLinks));
        }
      }

      if (finalStatus === "Ready for Testing") {
        extraSet += ", sent_to_testing_at = CURRENT_TIMESTAMP";
      }

      await pool.query(
        `UPDATE tasks 
         SET status = ?, 
             progress_percentage = 100, 
             daily_summary = IFNULL(?, daily_summary),
             blockers = IFNULL(?, blockers)
             ${extraSet}
         WHERE id = ?`,
        [finalStatus, session_summary || "Task completed via timer stop", blockers || null, ...linkParams, targetTaskId]
      );

      // Alert QA testers if submitted for testing
      if (finalStatus === "Ready for Testing") {
        try {
          const [tInfo]: any = await pool.query(
            `SELECT t.title, p.name as project_name, u.name as assignee_name 
             FROM tasks t 
             LEFT JOIN projects p ON t.project_id = p.id 
             LEFT JOIN users u ON t.assigned_to = u.id 
             WHERE t.id = ?`,
            [targetTaskId]
          );
          if (tInfo.length > 0) {
            await pool.query(
              `INSERT INTO notifications (target_role, title, message, type) VALUES ('Tester', ?, ?, 'task_ready')`,
              [
                `QA Testing Required: ${tInfo[0].title || "Task"}`,
                `${tInfo[0].assignee_name || "Developer"} finished task and submitted "${tInfo[0].title}" in project "${tInfo[0].project_name || "General"}" for QA verification.`
              ]
            );
          }
        } catch (notifErr) {
          console.error("Error creating QA notification on timer stop:", notifErr);
        }
      }

      // Alert Admin, CEO, and PM if submitted for demo (Fastest Development)
      if (finalStatus === "Ready for Demo") {
        try {
          const [tInfo]: any = await pool.query(
            `SELECT t.title, p.name as project_name, u.name as assignee_name 
             FROM tasks t 
             LEFT JOIN projects p ON t.project_id = p.id 
             LEFT JOIN users u ON t.assigned_to = u.id 
             WHERE t.id = ?`,
            [targetTaskId]
          );
          if (tInfo.length > 0) {
            for (const targetRole of ["Admin", "CEO", "PM"]) {
              await pool.query(
                `INSERT INTO notifications (target_role, title, message, type) VALUES (?, ?, ?, 'demo_ready')`,
                [
                  targetRole,
                  `🚀 Fast-Track Demo Ready: ${tInfo[0].title || "Task"}`,
                  `${tInfo[0].assignee_name || "Developer"} completed task in project "${tInfo[0].project_name || "General"}" and submitted directly for Demo review.`
                ]
              );
            }
          }
        } catch (notifErr) {
          console.error("Error creating Demo notification on timer stop:", notifErr);
        }
      }

      // Auto-sync final completion into daily_work
      try {
        const [taskInfo]: any = await pool.query("SELECT title, project_id FROM tasks WHERE id = ?", [targetTaskId]);
        const project_id = taskInfo[0]?.project_id || null;
        const taskTitle = taskInfo[0]?.title || "Task";
        const sessionHours = parseFloat((durationMins / 60).toFixed(2));
        const todayStr = (endTimeFormatted ? String(endTimeFormatted).split(" ")[0] : null) || new Date().toISOString().split("T")[0];

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
        message: `Task finished and marked ${finalStatus}! Total hours spent: ${formatHoursAndMinutes(totalHours)} recorded.`,
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
      const startFormatted = formatToMySQLDateTime(start);
      const endFormatted = formatToMySQLDateTime(end);

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

    // -------------------------------------------------------------
    // ACTION: 45-MINUTE TASK PROGRESS CHECK-IN
    // -------------------------------------------------------------
    if (action === "progress_checkin") {
      const { task_id, progress_percentage, session_summary, blockers } = body;
      if (!task_id) {
        return NextResponse.json({ error: "task_id is required" }, { status: 400 });
      }

      const parsedProgress = progress_percentage !== undefined && progress_percentage !== null
        ? Math.max(0, Math.min(100, parseInt(String(progress_percentage), 10)))
        : null;

      const is100Percent = parsedProgress === 100;
      const todayStr = new Date().toISOString().split("T")[0];

      const [taskRows]: any = await pool.query(
        "SELECT title, project_id, status FROM tasks WHERE id = ?", 
        [task_id]
      );
      const taskObj = taskRows[0];
      const taskTitle = taskObj?.title || "Task";

      // -----------------------------------------------------------
      // IF 100% PROGRESS: Task is Finished! Trigger Finish & Stop Timer
      // -----------------------------------------------------------
      if (is100Percent) {
        await pool.query(
          `UPDATE tasks 
           SET status = 'Completed',
               progress_percentage = 100,
               daily_summary = IFNULL(?, daily_summary),
               blockers = IFNULL(?, blockers)
           WHERE id = ?`,
          [session_summary ? session_summary.trim() : "Completed at 100%", blockers || null, task_id]
        );

        // Deactivate active running timer for this task
        await pool.query(
          `UPDATE task_time_logs 
           SET ended_at = CURRENT_TIMESTAMP, 
               duration_minutes = GREATEST(1, ROUND(TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP) / 60)), 
               session_summary = IFNULL(?, 'Finished task with 100% progress'),
               is_active = 0 
           WHERE task_id = ? AND is_active = 1`,
          [session_summary ? session_summary.trim() : null, task_id]
        );

        const totalHours = await syncTaskHours(task_id);

        // Record completed accomplishment in daily_work table
        try {
          await pool.query(
            `INSERT INTO daily_work (user_id, project_id, task_id, date, hours_worked, work_description, status, remarks)
             VALUES (?, ?, ?, ?, ?, ?, 'Completed', 'Finished with 100% progress')`,
            [
              currentUserId,
              taskObj?.project_id || null,
              task_id,
              todayStr,
              totalHours > 0 ? totalHours : 0.75,
              session_summary ? `[Completed 100%] ${session_summary.trim()}` : `[Completed 100%] Finished task: ${taskTitle}`,
            ]
          );
        } catch (dwErr) {
          console.error("daily_work 100% completion error:", dwErr);
        }

        // Notify employee
        try {
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type)
             VALUES (?, ?, ?, 'task_completed')`,
            [
              currentUserId,
              `🎉 Task Completed (100%)`,
              `You marked "${taskTitle}" as 100% finished! Timer has been stopped and hours recorded.`,
            ]
          );
        } catch (_) {}

        // Notify Admin, CEO, and PM of 100% completion
        await notifyManagement(
          `🎉 Task Finished (100%): ${currentUserName}`,
          `${currentUserName} (${currentRole}) marked task "${taskTitle}" as 100% Completed. Total hours: ${totalHours}h. Work: "${session_summary || 'Finished'}".`,
          "task_completed"
        );

        return NextResponse.json({
          success: true,
          is_completed: true,
          message: `Task finished and marked Completed (100%)! Total hours spent: ${totalHours}h recorded.`,
          task_id,
          progress_percentage: 100,
          status: "Completed",
          hours_spent: totalHours
        });
      }

      // -----------------------------------------------------------
      // Progress < 100%: Standard 45-Minute Progress Check-In
      // -----------------------------------------------------------
      await pool.query(
        `UPDATE tasks 
         SET progress_percentage = IFNULL(?, progress_percentage),
             daily_summary = IFNULL(?, daily_summary),
             blockers = IFNULL(?, blockers)
         WHERE id = ?`,
        [
          parsedProgress,
          session_summary ? session_summary.trim() : null,
          blockers !== undefined ? blockers.trim() : null,
          task_id
        ]
      );

      // Record work accomplishment in daily_work audit table
      try {
        if (taskObj && (session_summary || parsedProgress !== null)) {
          await pool.query(
            `INSERT INTO daily_work (user_id, project_id, task_id, date, hours_worked, work_description, status, remarks)
             VALUES (?, ?, ?, ?, 0.75, ?, ?, ?)`,
            [
              currentUserId,
              taskObj.project_id || null,
              task_id,
              todayStr,
              session_summary ? session_summary.trim() : `45-min check-in: Progress set to ${parsedProgress}%`,
              taskObj.status || "In Progress",
              blockers ? blockers.trim() : null
            ]
          );
        }
      } catch (dwErr) {
        console.error("daily_work log on progress checkin error:", dwErr);
      }

      // Record in-app notification for the user
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES (?, ?, ?, 'task_progress')`,
          [
            currentUserId,
            `⏱️ 45-Min Progress Check-In Saved`,
            `Progress updated to ${parsedProgress}% for "${taskTitle}". Great job maintaining focus!`,
          ]
        );
      } catch (_) {}

      // Notify Admin, CEO, and PM of Progress Update
      await notifyManagement(
        `📝 Task Progress Updated: ${currentUserName} (${parsedProgress}%)`,
        `${currentUserName} (${currentRole}) updated progress to ${parsedProgress}% on task "${taskTitle}". Work accomplished: "${session_summary || 'Progress updated'}".`,
        "task_progress_updated"
      );

      return NextResponse.json({
        success: true,
        message: "Task progress check-in saved successfully",
        task_id,
        progress_percentage: parsedProgress
      });
    }

    // -------------------------------------------------------------
    // ACTION: 45-MINUTE TASK UPDATE REMINDER NOTIFICATION DISPATCH
    // -------------------------------------------------------------
    if (action === "notify_reminder") {
      const { task_id, elapsed_minutes } = body;
      try {
        const [taskRows]: any = await pool.query("SELECT title FROM tasks WHERE id = ?", [task_id]);
        const taskTitle = taskRows[0]?.title || "Task";
        
        // Notify employee
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES (?, ?, ?, 'task_reminder')`,
          [
            currentUserId,
            `⏱️ 45-Min Task Progress Reminder`,
            `You've been focused on "${taskTitle}" for ${elapsed_minutes || 45} minutes. Please update your task progress!`,
          ]
        );

        // Notify Admin, CEO, and PM that employee has been running task for >45m without adding progress!
        await notifyManagement(
          `⚠️ 45m+ Progress Update Pending: ${currentUserName}`,
          `${currentUserName} (${currentRole}) has been running task "${taskTitle}" for ${elapsed_minutes || 45} minutes without updating task progress.`,
          "task_progress_pending"
        );
      } catch (_) {}

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/tasks/timer error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper: Notify all management users (Admin, CEO, PM)
async function notifyManagement(title: string, message: string, type: string = "task_progress") {
  try {
    const [executives]: any = await pool.query(
      "SELECT id FROM users WHERE role IN ('Admin', 'CEO', 'PM')"
    );
    for (const exec of executives) {
      await pool.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
        [exec.id, title, message, type]
      );
    }
  } catch (err) {
    console.error("notifyManagement error:", err);
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
