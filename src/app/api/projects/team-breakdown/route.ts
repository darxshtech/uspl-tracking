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
  const currentUserId = (session.user as any)?.id;
  const isManager = ["Admin", "CEO", "PM"].includes(role);

  const { searchParams } = new URL(req.url);
  const projectIdStr = searchParams.get("projectId");

  if (!projectIdStr) {
    return NextResponse.json({ error: "projectId query parameter is required" }, { status: 400 });
  }

  const projectId = parseInt(projectIdStr, 10);
  if (isNaN(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  try {
    // 1. Fetch project details
    const [projectRows]: any = await pool.query(
      `SELECT p.*, 
        u.name AS creator_name, 
        u.role AS creator_role
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = ?`,
      [projectId]
    );

    if (projectRows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = projectRows[0];

    // If not a manager, check if this user is a member of the project
    if (!isManager) {
      const [membership]: any = await pool.query(
        "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?",
        [projectId, currentUserId]
      );
      if (membership.length === 0) {
        return NextResponse.json({ error: "Forbidden: Not assigned to this project" }, { status: 403 });
      }
    }

    // 2. Fetch all members assigned to this project
    const [members]: any = await pool.query(
      `SELECT u.id, u.name, u.email, u.role
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = ?
       ORDER BY 
         CASE 
           WHEN u.role = 'Admin' THEN 1
           WHEN u.role = 'CEO' THEN 2
           WHEN u.role = 'PM' THEN 3
           WHEN u.role = 'Developer' THEN 4
           WHEN u.role = 'Tester' THEN 5
           ELSE 6
         END, u.name ASC`,
      [projectId]
    );

    // 3. Fetch all tasks for this project
    const [tasks]: any = await pool.query(
      `SELECT t.*, 
        u_creator.name AS creator_name,
        u_creator.role AS creator_role,
        u_assignee.name AS primary_assignee_name,
        u_assignee.role AS primary_assignee_role
       FROM tasks t
       LEFT JOIN users u_creator ON t.created_by = u_creator.id
       LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
       WHERE t.project_id = ?
       ORDER BY t.created_at DESC`,
      [projectId]
    );

    // 4. Fetch multi-assignee mappings for these tasks
    const [assigneeRows]: any = await pool.query(
      `SELECT ta.task_id, ta.user_id, u.name, u.role
       FROM task_assignees ta
       JOIN tasks t ON ta.task_id = t.id
       JOIN users u ON ta.user_id = u.id
       WHERE t.project_id = ?`,
      [projectId]
    );

    // Build task-to-users and user-to-tasks map
    const taskAssigneesMap: Record<number, number[]> = {};
    assigneeRows.forEach((row: any) => {
      if (!taskAssigneesMap[row.task_id]) {
        taskAssigneesMap[row.task_id] = [];
      }
      taskAssigneesMap[row.task_id].push(row.user_id);
    });

    // Helper to check if task is completed
    const isTaskCompleted = (status: string) => {
      return ["Completed", "Tested (PASS)", "Ready for Demo"].includes(status);
    };

    // Format tasks and associate with members
    const memberBreakdown = members.map((member: any) => {
      const memberTasks = tasks.filter((t: any) => {
        const isPrimary = t.assigned_to === member.id;
        const isMulti = taskAssigneesMap[t.id]?.includes(member.id);
        return isPrimary || isMulti;
      });

      const totalTasks = memberTasks.length;
      const completedTasks = memberTasks.filter((t: any) => isTaskCompleted(t.status)).length;
      const inProgressTasks = memberTasks.filter((t: any) => t.status === "In Progress").length;
      const pendingTasks = memberTasks.filter((t: any) => t.status === "Pending").length;
      const testingTasks = memberTasks.filter((t: any) => ["Sent to Testing", "Tested (FAIL)"].includes(t.status)).length;
      const completionRatio = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Format task items
      const formattedTasks = memberTasks.map((t: any) => {
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
          priority: t.priority || "Medium",
          status: t.status,
          progress_percentage: t.progress_percentage || 0,
          due_date: t.due_date,
          target_date: t.target_date,
          hours_spent: t.hours_spent || 0,
          blockers: t.blockers,
          task_link: t.task_link,
          task_links: taskLinks,
          creator_name: t.creator_name,
          creator_role: t.creator_role,
          created_at: t.created_at,
        };
      });

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: inProgressTasks,
        pending_tasks: pendingTasks,
        testing_tasks: testingTasks,
        completion_ratio: completionRatio,
        tasks: formattedTasks,
      };
    });

    // Project Overall Metrics
    const totalProjectTasks = tasks.length;
    const completedProjectTasks = tasks.filter((t: any) => isTaskCompleted(t.status)).length;
    const inProgressProjectTasks = tasks.filter((t: any) => t.status === "In Progress").length;
    const pendingProjectTasks = tasks.filter((t: any) => t.status === "Pending").length;
    const testingProjectTasks = tasks.filter((t: any) => ["Sent to Testing", "Tested (FAIL)"].includes(t.status)).length;
    const overallCompletionRatio = totalProjectTasks > 0 ? Math.round((completedProjectTasks / totalProjectTasks) * 100) : 0;

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        is_fast_track: Boolean(project.is_fast_track),
        target_date: project.target_date,
        created_by: project.created_by,
        creator_name: project.creator_name,
        creator_role: project.creator_role,
        documentation_url: project.documentation_url,
      },
      stats: {
        total_members: members.length,
        total_tasks: totalProjectTasks,
        completed_tasks: completedProjectTasks,
        in_progress_tasks: inProgressProjectTasks,
        pending_tasks: pendingProjectTasks,
        testing_tasks: testingProjectTasks,
        completion_ratio: overallCompletionRatio,
      },
      members: memberBreakdown,
    });
  } catch (error: any) {
    console.error("Error fetching project team breakdown:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
