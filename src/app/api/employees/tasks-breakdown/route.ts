import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any)?.role;
  const isManager = ["Admin", "CEO", "PM"].includes(role);

  if (!isManager) {
    return NextResponse.json({ error: "Unauthorized: PM, CEO or Admin role required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const employeeIdStr = searchParams.get("employeeId");

  if (!employeeIdStr) {
    return NextResponse.json({ error: "employeeId query parameter is required" }, { status: 400 });
  }

  const employeeId = parseInt(employeeIdStr, 10);
  if (isNaN(employeeId)) {
    return NextResponse.json({ error: "Invalid employeeId" }, { status: 400 });
  }

  try {
    // 1. Fetch employee details
    const [employeeRows]: any = await pool.query(
      `SELECT id, name, email, role, phone, bio, is_active, created_at
       FROM users
       WHERE id = ?`,
      [employeeId]
    );

    if (employeeRows.length === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const employee = employeeRows[0];

    // 2. Fetch all tasks assigned to this employee (direct assigned_to OR task_assignees)
    const [tasks]: any = await pool.query(
      `SELECT DISTINCT t.*,
        p.name AS project_name,
        p.created_by AS project_created_by,
        u_creator.name AS creator_name,
        u_creator.role AS creator_role
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN users u_creator ON t.created_by = u_creator.id
       WHERE t.assigned_to = ? 
          OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)
       ORDER BY t.created_at DESC`,
      [employeeId, employeeId]
    );

    // 3. Fetch co-assignees for these tasks
    const taskIds = tasks.map((t: any) => t.id);
    const coAssigneesMap: Record<number, any[]> = {};

    if (taskIds.length > 0) {
      const [coRows]: any = await pool.query(
        `SELECT ta.task_id, u.id, u.name, u.role, u.email
         FROM task_assignees ta
         JOIN users u ON ta.user_id = u.id
         WHERE ta.task_id IN (?)`,
        [taskIds]
      );
      coRows.forEach((r: any) => {
        if (!coAssigneesMap[r.task_id]) coAssigneesMap[r.task_id] = [];
        coAssigneesMap[r.task_id].push({
          id: r.id,
          name: r.name,
          role: r.role,
          email: r.email,
        });
      });
    }

    // Helper to check if task is completed
    const isTaskCompleted = (status: string) => {
      return ["Completed", "Tested (PASS)", "Ready for Demo"].includes(status);
    };

    // Calculate aggregated metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => isTaskCompleted(t.status)).length;
    const inProgressTasks = tasks.filter((t: any) => t.status === "In Progress" || t.status === "Planning").length;
    const readyForTestingTasks = tasks.filter((t: any) => t.status === "Ready for Testing" || t.status === "Testing").length;
    const changesRequiredTasks = tasks.filter((t: any) => t.status === "Changes Required").length;
    const totalHours = tasks.reduce((sum: number, t: any) => sum + (parseFloat(t.hours_spent) || 0), 0);
    const overallCompletionRatio = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Group projects breakdown
    const projectMap: Record<string, { id: number | null; name: string; total: number; completed: number }> = {};
    tasks.forEach((t: any) => {
      const pKey = t.project_id ? String(t.project_id) : "standalone";
      const pName = t.project_name || "Standalone / General";
      if (!projectMap[pKey]) {
        projectMap[pKey] = {
          id: t.project_id,
          name: pName,
          total: 0,
          completed: 0,
        };
      }
      projectMap[pKey].total += 1;
      if (isTaskCompleted(t.status)) {
        projectMap[pKey].completed += 1;
      }
    });

    const projectBreakdown = Object.values(projectMap).map((p) => ({
      ...p,
      completionRatio: p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0,
    }));

    // Format tasks list
    const formattedTasks = tasks.map((t: any) => {
      let taskLinks = [];
      if (typeof t.task_links === "string") {
        try { taskLinks = JSON.parse(t.task_links); } catch (_) {}
      } else if (Array.isArray(t.task_links)) {
        taskLinks = t.task_links;
      }

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        project_id: t.project_id,
        project_name: t.project_name || "Standalone / General",
        priority: t.priority || "Medium",
        status: t.status,
        progress_percentage: t.progress_percentage || 0,
        due_date: t.due_date,
        target_date: t.target_date,
        hours_spent: t.hours_spent || 0,
        blockers: t.blockers,
        daily_summary: t.daily_summary,
        task_link: t.task_link,
        task_links: taskLinks,
        creator_name: t.creator_name || "Management",
        creator_role: t.creator_role,
        is_primary: t.assigned_to === employeeId,
        co_assignees: coAssigneesMap[t.id] || [],
        created_at: t.created_at,
        updated_at: t.updated_at,
      };
    });

    return NextResponse.json({
      employee,
      metrics: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        readyForTestingTasks,
        changesRequiredTasks,
        totalHours,
        overallCompletionRatio,
      },
      projectBreakdown,
      tasks: formattedTasks,
    });
  } catch (error: any) {
    console.error("Error fetching employee tasks breakdown:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
