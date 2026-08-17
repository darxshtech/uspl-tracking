import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    // Testing queue: ONLY active tasks that are Ready for Testing or currently in Testing
    const [rows]: any = await pool.query(`
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
      WHERE t.status IN ('Ready for Testing', 'Testing')
      ORDER BY t.created_at DESC
    `);

    const formatted = rows.map((r: any) => {
      let parsedLinks: string[] = [];
      if (typeof r.task_links === "string") {
        try { parsedLinks = JSON.parse(r.task_links); } catch (_) {}
      } else if (Array.isArray(r.task_links)) {
        parsedLinks = r.task_links;
      } else if (r.task_link) {
        parsedLinks = [r.task_link];
      }

      return {
        ...r,
        task_links: parsedLinks,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Tester", "CEO", "PM", "Admin"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { task_id, result, remarks, submit_to_demo } = await req.json();
    const tester_id = (session.user as any).id;

    if (!task_id || !result) {
      return NextResponse.json({ error: "Task ID and test result (PASS/FAIL) are required" }, { status: 400 });
    }

    // 1. Insert testing record
    await pool.query(
      "INSERT INTO testing_records (task_id, tester_id, result, remarks) VALUES (?, ?, ?, ?)",
      [task_id, tester_id, result, remarks || ""]
    );

    // 2. Determine new status: PASS -> Tested (PASS) or Ready for Demo; FAIL -> Changes Required
    let newStatus = "Changes Required";
    if (result === "PASS") {
      newStatus = submit_to_demo ? "Ready for Demo" : "Tested (PASS)";
    }

    await pool.query(
      "UPDATE tasks SET status = ?, remarks = ? WHERE id = ?",
      [newStatus, remarks || "", task_id]
    );

    // Get task details for notification
    const [taskRows]: any = await pool.query(
      `SELECT t.title, t.assigned_to, p.name as project_name 
       FROM tasks t 
       LEFT JOIN projects p ON t.project_id = p.id 
       WHERE t.id = ?`,
      [task_id]
    );
    const currentTask = taskRows[0] || {};
    const taskTitle = currentTask.title || `Task #${task_id}`;
    const projectName = currentTask.project_name || "Project";

    // 3. Dispatch targeted notifications
    if (result === "PASS") {
      const isDemo = newStatus === "Ready for Demo";
      const notifTitle = isDemo ? `🚀 Demo Ready: ${taskTitle}` : `QA Passed: ${taskTitle}`;
      const notifMessage = isDemo
        ? `Task "${taskTitle}" in "${projectName}" has PASSED QA verification and is now SUBMITTED TO DEMO for client/stakeholders!`
        : `Task "${taskTitle}" in "${projectName}" has PASSED QA verification successfully.`;

      // Notify PM and CEO
      await pool.query(
        "INSERT INTO notifications (target_role, title, message, type) VALUES ('CEO', ?, ?, 'demo_ready'), ('PM', ?, ?, 'demo_ready')",
        [notifTitle, notifMessage, notifTitle, notifMessage]
      );

      // Notify developer
      if (currentTask.assigned_to) {
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
          [currentTask.assigned_to, `QA Passed: ${taskTitle}`, `Your task "${taskTitle}" passed testing!`]
        );
      }
    } else {
      // Rejection: Notify developer
      if (currentTask.assigned_to) {
        await pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')",
          [
            currentTask.assigned_to,
            `QA Failed: ${taskTitle}`,
            `QA found issues on "${taskTitle}". Remarks: ${remarks || "Changes required."}`
          ]
        );
      }
      // Notify PM
      await pool.query(
        "INSERT INTO notifications (target_role, title, message, type) VALUES ('PM', ?, ?, 'warning')",
        [
          `QA Issues Reported: ${taskTitle}`,
          `Task "${taskTitle}" in "${projectName}" failed verification and was returned for fixes. Remarks: ${remarks}`
        ]
      );
    }

    return NextResponse.json({ success: true, task_id, result, status: newStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
