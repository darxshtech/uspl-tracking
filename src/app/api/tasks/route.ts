import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    
    let query = `
      SELECT t.*, 
        p.name as project_name, 
        p.created_by as project_created_by,
        pu.name as project_creator_name,
        pu.role as project_creator_role,
        u1.name as assignee_name, 
        u2.name as creator_name,
        u2.role as creator_role
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users pu ON p.created_by = pu.id
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
    `;
    let params: any[] = [];
    
    if (role === "Developer") {
      query += " WHERE t.assigned_to = ?";
      params = [userId];
    } else if (role === "Tester") {
      query += " WHERE t.status IN ('Ready for Testing', 'Testing', 'Tested (PASS)', 'Ready for Demo', 'Completed', 'Changes Required')";
    }

    query += " ORDER BY t.created_at DESC";

    const [rows]: any = await pool.query(query, params);

    // Fetch checklists
    const [checklistRows]: any = await pool.query("SELECT * FROM task_checklists ORDER BY id ASC");
    const checklistMap: Record<number, any[]> = {};
    checklistRows.forEach((c: any) => {
      if (!checklistMap[c.task_id]) checklistMap[c.task_id] = [];
      checklistMap[c.task_id].push({
        id: c.id,
        item_text: c.item_text,
        is_completed: Boolean(c.is_completed),
      });
    });

    const formatted = rows.map((r: any) => {
      return {
        ...r,
        checklists: checklistMap[r.id] || [],
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const role = (session.user as any).role;
    const currentUserId = (session.user as any).id;
    const currentUserName = session.user?.name || "User";
    const body = await req.json();

    // 1. Sub-task / Checklist item creation
    if (body.action === "add_checklist") {
      const { task_id, item_text } = body;
      if (!task_id || !item_text) {
        return NextResponse.json({ error: "Task ID and item text are required" }, { status: 400 });
      }

      const [result]: any = await pool.query(
        "INSERT INTO task_checklists (task_id, item_text, is_completed) VALUES (?, ?, false)",
        [task_id, item_text]
      );

      return NextResponse.json({ success: true, id: result.insertId, task_id, item_text, is_completed: false });
    }

    // 2. Main Task creation (Developers, PM, CEO, Tester)
    const { title, description, project_id, assigned_to, priority, due_date, target_date, timeline, checklists } = body;

    if (!title || !project_id) {
      return NextResponse.json({ error: "Task title and project are required" }, { status: 400 });
    }

    // Calculate target date for Today vs Tomorrow
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    let taskTargetDate = target_date || todayStr;
    if (timeline === "tomorrow") {
      taskTargetDate = tomorrowStr;
    } else if (timeline === "today") {
      taskTargetDate = todayStr;
    }

    let finalAssignee = assigned_to;
    if (role === "Developer" && !finalAssignee) {
      finalAssignee = currentUserId; // Developer creates tasks for themselves
    }

    if (!finalAssignee) {
      return NextResponse.json({ error: "Assignee is required" }, { status: 400 });
    }

    const [result]: any = await pool.query(
      `INSERT INTO tasks (title, description, project_id, created_by, assigned_to, priority, due_date, target_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        project_id,
        currentUserId,
        finalAssignee,
        priority || "Medium",
        due_date || taskTargetDate,
        taskTargetDate,
        role === "Developer" ? "In Progress" : "Assigned",
      ]
    );

    const taskId = result.insertId;

    // Insert subtasks / checklists if provided
    if (checklists && Array.isArray(checklists) && checklists.length > 0) {
      for (const item of checklists) {
        if (typeof item === "string" && item.trim()) {
          await pool.query(
            "INSERT INTO task_checklists (task_id, item_text, is_completed) VALUES (?, ?, false)",
            [taskId, item.trim()]
          );
        }
      }
    }

    // Notify assigned developer if created by someone else
    if (finalAssignee !== currentUserId) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'task_assigned')`,
        [
          finalAssignee,
          `New Task Assigned by ${currentUserName} (${role})`,
          `Task "${title}" has been assigned to you. Scheduled for: ${taskTargetDate}.`
        ]
      );
    }

    return NextResponse.json({ id: taskId, title, status: role === "Developer" ? "In Progress" : "Assigned", target_date: taskTargetDate }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const body = await req.json();

    // 1. Toggle checklist item completion
    if (body.action === "toggle_checklist") {
      const { checklist_id, is_completed } = body;
      await pool.query(
        "UPDATE task_checklists SET is_completed = ? WHERE id = ?",
        [is_completed ? 1 : 0, checklist_id]
      );
      return NextResponse.json({ success: true, checklist_id, is_completed });
    }

    // 2. Task lifecycle status updates & Task Link Submission
    const { id, status, remarks, task_link } = body;
    if (!id || !status) {
      return NextResponse.json({ error: "Task ID and status are required" }, { status: 400 });
    }

    // Retrieve current task details
    const [taskRows]: any = await pool.query(
      `SELECT t.*, p.name as project_name, u.name as assignee_name 
       FROM tasks t 
       LEFT JOIN projects p ON t.project_id = p.id 
       LEFT JOIN users u ON t.assigned_to = u.id 
       WHERE t.id = ?`,
      [id]
    );
    const currentTask = taskRows[0] || {};

    // Validate mandatory task link when submitting to testing
    if (status === "Ready for Testing" && !task_link && !currentTask.task_link) {
      return NextResponse.json(
        { error: "A task preview link or PR URL is strictly required before sending to testing." },
        { status: 400 }
      );
    }

    await pool.query(
      `UPDATE tasks 
       SET status = ?, remarks = IFNULL(?, remarks), task_link = IFNULL(?, task_link) 
       WHERE id = ?`,
      [status, remarks || null, task_link || null, id]
    );

    const activeLink = task_link || currentTask.task_link || "";

    // Notify on "Ready for Testing" -> Send to QA Testers
    if (status === "Ready for Testing") {
      await pool.query(
        `INSERT INTO notifications (target_role, title, message, type) VALUES ('Tester', ?, ?, 'task_ready')`,
        [
          `QA Testing Required: ${currentTask.title || "Task"}`,
          `${currentTask.assignee_name || "Developer"} submitted "${currentTask.title}" in project "${currentTask.project_name}" for QA verification. Preview Link: ${activeLink || "Provided in dashboard"}`
        ]
      );
    }

    // Notify on "Ready for Demo" (SUBMIT TO DEMO) -> ALERT TO PM & CEO!
    if (status === "Ready for Demo") {
      const demoMsg = `Task "${currentTask.title}" in project "${currentTask.project_name}" (Dev: ${currentTask.assignee_name}) has PASSED QA testing and is now submitted for client/executive DEMO!`;
      await pool.query(
        `INSERT INTO notifications (target_role, title, message, type) VALUES ('CEO', ?, ?, 'demo_ready'), ('PM', ?, ?, 'demo_ready')`,
        [
          `🚀 Demo Ready: ${currentTask.title || "Feature"}`,
          demoMsg,
          `🚀 Demo Ready: ${currentTask.title || "Feature"}`,
          demoMsg,
        ]
      );
    }

    // Notify on "Changes Required" (QA Rejection)
    if (status === "Changes Required" && currentTask.assigned_to) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')`,
        [
          currentTask.assigned_to,
          `QA Failed: ${currentTask.title}`,
          `QA reported issues on "${currentTask.title}". Remarks: ${remarks || "Changes required before re-testing."}`
        ]
      );
    }

    return NextResponse.json({ success: true, id, status, task_link: activeLink });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: PM or CEO role required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    await pool.query("DELETE FROM task_checklists WHERE task_id = ?", [id]);
    await pool.query("DELETE FROM tasks WHERE id = ?", [id]);

    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

