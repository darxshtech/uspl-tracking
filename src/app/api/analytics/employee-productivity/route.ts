import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { 
  getCurrentISTDate, 
  getCurrentISTTime12, 
  calculateHoursDifference, 
  formatHoursAndMinutes 
} from "@/lib/timeUtils";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any)?.role;
  const isAuthorized = ["Admin", "CEO", "PM"].includes(role);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: Executive leadership (Admin, CEO, PM) access required." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "today";
  const customStart = searchParams.get("start_date");
  const customEnd = searchParams.get("end_date");
  const targetEmployeeId = searchParams.get("employee_id");

  const todayIST = getCurrentISTDate();
  const currentTime12 = getCurrentISTTime12();

  // 1. Calculate date boundaries (Asia/Kolkata)
  let startDate = todayIST;
  let endDate = todayIST;

  if (period === "today") {
    startDate = todayIST;
    endDate = todayIST;
  } else if (period === "week") {
    // Current week starting from Monday
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    startDate = monday.toISOString().split("T")[0];
    endDate = todayIST;
  } else if (period === "month") {
    // Current month from 1st of month to today
    const [year, month] = todayIST.split("-");
    startDate = `${year}-${month}-01`;
    endDate = todayIST;
  } else if (period === "year") {
    // Current year from Jan 1st to today
    const year = todayIST.split("-")[0];
    startDate = `${year}-01-01`;
    endDate = todayIST;
  } else if (period === "custom" && customStart && customEnd) {
    startDate = customStart;
    endDate = customEnd;
  }

  try {
    // 2. Fetch target employee(s) (exclude clients)
    let userQuery = `
      SELECT id, name, email, role, avatar
      FROM users 
      WHERE is_active = 1 AND role != 'Client'
    `;
    const userQueryParams: any[] = [];

    if (targetEmployeeId) {
      userQuery += " AND id = ?";
      userQueryParams.push(parseInt(targetEmployeeId, 10));
    }

    userQuery += " ORDER BY name ASC";
    const [employees]: any = await pool.query(userQuery, userQueryParams);

    if (!employees || employees.length === 0) {
      return NextResponse.json({
        period,
        date_range: { start: startDate, end: endDate },
        summary: { total_employees: 0, ideal_count: 0, active_count: 0, idle_count: 0, off_count: 0 },
        employees: []
      });
    }

    const employeeIds: number[] = employees.map((e: any) => e.id);

    // 3. Batch Query: Attendance records in date range
    const [attendanceRows]: any = await pool.query(
      `SELECT user_id, DATE_FORMAT(date, '%Y-%m-%d') as date_str, login_time, logout_time, total_hours, status
       FROM attendance
       WHERE user_id IN (?) AND date >= ? AND date <= ?`,
      [employeeIds, startDate, endDate]
    );

    // 4. Batch Query: Task timer logs in date range
    const [timerRows]: any = await pool.query(
      `SELECT ttl.user_id, ttl.task_id, ttl.duration_minutes, ttl.is_active, ttl.started_at,
              DATE_FORMAT(ttl.started_at, '%Y-%m-%d') as session_date,
              TIMESTAMPDIFF(SECOND, ttl.started_at, CURRENT_TIMESTAMP) as active_seconds
       FROM task_time_logs ttl
       WHERE ttl.user_id IN (?) AND DATE(ttl.started_at) >= ? AND DATE(ttl.started_at) <= ?`,
      [employeeIds, startDate, endDate]
    );

    // 5. Batch Query: Tasks assigned to or worked on by employees in date range
    const [taskRows]: any = await pool.query(
      `SELECT DISTINCT t.id, t.title, t.status, t.project_id, t.assigned_to, t.hours_spent,
              DATE_FORMAT(t.created_at, '%Y-%m-%d') as created_date,
              ta.user_id as co_assignee_id
       FROM tasks t
       LEFT JOIN task_assignees ta ON t.id = ta.task_id
       WHERE (t.assigned_to IN (?) OR ta.user_id IN (?))
         AND (
           (DATE(t.created_at) >= ? AND DATE(t.created_at) <= ?)
           OR t.id IN (
             SELECT DISTINCT task_id FROM task_time_logs 
             WHERE user_id IN (?) AND DATE(started_at) >= ? AND DATE(started_at) <= ?
           )
         )`,
      [employeeIds, employeeIds, startDate, endDate, employeeIds, startDate, endDate]
    );

    // 6. Batch Query: Subtask checklists for the relevant tasks
    const relevantTaskIds = Array.from(new Set(taskRows.map((t: any) => t.id)));
    let checklistRows: any[] = [];
    if (relevantTaskIds.length > 0) {
      const [chkRows]: any = await pool.query(
        `SELECT task_id, is_completed FROM task_checklists WHERE task_id IN (?)`,
        [relevantTaskIds]
      );
      checklistRows = chkRows;
    }

    // 7. Batch Query: Project memberships
    const [projectMemberRows]: any = await pool.query(
      `SELECT project_id, user_id FROM project_members WHERE user_id IN (?)`,
      [employeeIds]
    );

    // 8. Process and evaluate metrics per employee
    let idealCount = 0;
    let activeCount = 0;
    let idleCount = 0;
    let offCount = 0;

    const evaluatedEmployees = employees.map((emp: any) => {
      const empId = emp.id;

      // --- A. Working Shift Time (Attendance) ---
      const empAtt = attendanceRows.filter((a: any) => a.user_id === empId);
      let totalShiftHours = 0;
      let hasActiveShiftToday = false;

      for (const att of empAtt) {
        if (att.logout_time && att.total_hours !== null) {
          totalShiftHours += parseFloat(att.total_hours || 0);
        } else if (att.date_str === todayIST && att.login_time && !att.logout_time) {
          // Live running shift today
          hasActiveShiftToday = true;
          const liveElapsed = calculateHoursDifference(att.login_time, currentTime12);
          totalShiftHours += liveElapsed;
        }
      }
      totalShiftHours = Math.round(totalShiftHours * 100) / 100;

      // --- B. Task Timer Hours Logged ---
      const empLogs = timerRows.filter((l: any) => l.user_id === empId);
      let totalTaskHours = 0;

      for (const log of empLogs) {
        if (log.is_active === 1 && log.session_date === todayIST) {
          // Live active timer ticking right now
          const liveSeconds = Math.max(0, parseInt(log.active_seconds || 0, 10));
          totalTaskHours += liveSeconds / 3600;
        } else {
          totalTaskHours += (parseFloat(log.duration_minutes || 0) / 60);
        }
      }

      // If no timer log records found for this period, fallback to assigned task hours_spent if relevant
      if (totalTaskHours === 0 && empLogs.length === 0) {
        const empTasksDirect = taskRows.filter(
          (t: any) => (t.assigned_to === String(empId) || t.co_assignee_id === empId) && t.created_date >= startDate && t.created_date <= endDate
        );
        const fallbackHours = empTasksDirect.reduce(
          (sum: number, t: any) => sum + (parseFloat(t.hours_spent) || 0), 
          0
        );
        totalTaskHours = fallbackHours;
      }
      totalTaskHours = Math.round(totalTaskHours * 100) / 100;

      // --- C. Tasks Progress & Output ---
      const empTasks = taskRows.filter(
        (t: any) => t.assigned_to === String(empId) || t.co_assignee_id === empId
      );
      // Deduplicate tasks
      const uniqueTaskMap = new Map<number, any>();
      for (const t of empTasks) {
        uniqueTaskMap.set(t.id, t);
      }
      const uniqueTasks = Array.from(uniqueTaskMap.values());
      const tasksTotal = uniqueTasks.length;

      const completedTasks = uniqueTasks.filter((t: any) => 
        ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)
      ).length;

      const inProgressTasks = uniqueTasks.filter((t: any) => 
        ["In Progress", "Planning", "Testing", "Ready for Testing", "Changes Required"].includes(t.status)
      ).length;

      const taskRate = tasksTotal > 0 
        ? Math.min(100, Math.round(((completedTasks + (0.5 * inProgressTasks)) / tasksTotal) * 100))
        : 0;

      // --- D. Subtask Execution ---
      const empTaskIds = new Set(uniqueTasks.map((t: any) => t.id));
      const empChecklists = checklistRows.filter((c: any) => empTaskIds.has(c.task_id));
      const subtasksTotal = empChecklists.length;
      const subtasksCompleted = empChecklists.filter((c: any) => c.is_completed === 1).length;

      // If tasks have subtasks, use checklist completion rate. Otherwise gracefully inherit taskRate.
      const subtaskRate = subtasksTotal > 0
        ? Math.min(100, Math.round((subtasksCompleted / subtasksTotal) * 100))
        : taskRate;

      // --- E. Project Engagement ---
      const assignedProjectIds = new Set<number>();
      for (const pm of projectMemberRows.filter((p: any) => p.user_id === empId)) {
        assignedProjectIds.add(pm.project_id);
      }
      for (const t of uniqueTasks) {
        if (t.project_id) assignedProjectIds.add(t.project_id);
      }
      const totalProjects = assignedProjectIds.size;

      const activeProjectIds = new Set<number>();
      for (const t of uniqueTasks) {
        if (t.project_id && (t.hours_spent > 0 || completedTasks > 0 || inProgressTasks > 0)) {
          activeProjectIds.add(t.project_id);
        }
      }
      const activeProjects = activeProjectIds.size;

      const projectRate = totalProjects > 0
        ? Math.min(100, Math.round((activeProjects / totalProjects) * 100))
        : (tasksTotal > 0 ? 100 : 0);

      // --- F. Composite Scoring Engine (0 - 100 Points) ---
      // Utilization is task hours vs shift hours
      const utilizationRate = totalShiftHours > 0
        ? Math.min(100, Math.round((totalTaskHours / totalShiftHours) * 100))
        : 0;

      const timeScore = Math.round(utilizationRate * 0.40);       // Max 40
      const taskScore = Math.round(taskRate * 0.25);             // Max 25
      const subtaskScore = Math.round(subtaskRate * 0.20);       // Max 20
      const projectScore = Math.round(projectRate * 0.15);       // Max 15

      const compositeScore = Math.min(100, timeScore + taskScore + subtaskScore + projectScore);

      // --- G. Determine Performance Tag ---
      let tag: "ideal" | "active" | "idle" | "off" = "off";
      let tagLabel = "⚪ Off / On Leave";

      if (totalShiftHours === 0 && !hasActiveShiftToday) {
        tag = "off";
        tagLabel = "⚪ Off / On Leave";
        offCount++;
      } else if (compositeScore >= 75) {
        tag = "ideal";
        tagLabel = "🌟 Ideal Employee";
        idealCount++;
      } else if (compositeScore >= 50) {
        tag = "active";
        tagLabel = "🟢 Active / Working";
        activeCount++;
      } else {
        tag = "idle";
        tagLabel = "🟡 Under-utilized";
        idleCount++;
      }

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        avatar: emp.avatar,
        score: compositeScore,
        tag,
        tag_label: tagLabel,
        has_active_shift: hasActiveShiftToday,
        metrics: {
          shift_hours: totalShiftHours,
          task_hours: totalTaskHours,
          utilization_rate: utilizationRate,
          tasks_total: tasksTotal,
          tasks_completed: completedTasks,
          tasks_in_progress: inProgressTasks,
          task_rate: taskRate,
          subtasks_total: subtasksTotal,
          subtasks_completed: subtasksCompleted,
          subtask_rate: subtaskRate,
          total_projects: totalProjects,
          active_projects: activeProjects,
          project_rate: projectRate,
        }
      };
    });

    return NextResponse.json({
      period,
      date_range: { start: startDate, end: endDate },
      summary: {
        total_employees: evaluatedEmployees.length,
        ideal_count: idealCount,
        active_count: activeCount,
        idle_count: idleCount,
        off_count: offCount,
      },
      employees: evaluatedEmployees,
    });
  } catch (error: any) {
    console.error("GET /api/analytics/employee-productivity error:", error);
    return NextResponse.json({ error: error.message || "Failed to calculate productivity" }, { status: 500 });
  }
}
