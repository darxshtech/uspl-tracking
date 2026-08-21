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
        p.is_fast_track as project_is_fast_track,
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
    
    // For Developers and Testers: fetch their own daily tasks (assigned or self-created)
    if (role === "Developer" || role === "Tester") {
      query += " WHERE (t.assigned_to = ? OR t.created_by = ?)";
      params = [userId, userId];
    }

    query += " ORDER BY t.created_at DESC";

    const [rows]: any = await pool.query(query, params);

    // Safely Fetch checklists if table exists
    const checklistMap: Record<number, any[]> = {};
    try {
      const [checklistRows]: any = await pool.query("SELECT * FROM task_checklists ORDER BY id ASC");
      if (Array.isArray(checklistRows)) {
        checklistRows.forEach((c: any) => {
          if (!checklistMap[c.task_id]) checklistMap[c.task_id] = [];
          checklistMap[c.task_id].push({
            id: c.id,
            item_text: c.item_text,
            is_completed: Boolean(c.is_completed),
          });
        });
      }
    } catch (_) {
      // Table may not exist yet, fallback gracefully
    }

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
        checklists: checklistMap[r.id] || [],
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/tasks error:", error);
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

    // 2. Main Task creation (Developers, Testers, PM, CEO, Admin)
    const { 
      title, 
      description, 
      project_id, 
      assigned_to, 
      priority, 
      due_date, 
      target_date, 
      timeline, 
      checklists, 
      assigned_by_type,
      assign_to_all,
      is_mock_task
    } = body;

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

    const finalAssignedByType = assigned_by_type || (role === "Developer" || role === "Tester" ? "Self Tested" : role);
    const isExecutiveOrAdmin = ["Admin", "CEO", "PM"].includes(role);

    // MASS / MOCK TASK ASSIGNMENT TO ALL EMPLOYEES
    if (assign_to_all && isExecutiveOrAdmin) {
      const [allEmployees]: any = await pool.query(
        "SELECT id, name, email FROM users WHERE is_active = 1"
      );

      let createdCount = 0;
      for (const emp of allEmployees) {
        const [result]: any = await pool.query(
          `INSERT INTO tasks (title, description, project_id, created_by, assigned_to, priority, due_date, target_date, status, assigned_by_type) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?)`,
          [
            title,
            description || null,
            project_id,
            currentUserId,
            emp.id,
            priority || "Medium",
            due_date || taskTargetDate,
            taskTargetDate,
            finalAssignedByType
          ]
        );

        const taskId = result.insertId;

        // Insert subtasks / checklists for this employee's task copy
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

        // Notify employee
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'task_assigned')`,
          [
            emp.id,
            `${is_mock_task ? "⚡ Mock Task Broadcast" : "Task Assigned"} by ${currentUserName} (${role})`,
            `Task "${title}" has been assigned to you. Scheduled for: ${taskTargetDate}.`
          ]
        );

        createdCount++;
      }

      return NextResponse.json({
        success: true,
        count: createdCount,
        message: `Task successfully assigned to all ${createdCount} employees.`
      }, { status: 201 });
    }

    // SINGLE TASK CREATION
    let finalAssignee = assigned_to;
    if ((role === "Developer" || role === "Tester") && !finalAssignee) {
      finalAssignee = currentUserId; // Created for self
    }

    if (!finalAssignee) {
      return NextResponse.json({ error: "Assignee is required" }, { status: 400 });
    }

    const [result]: any = await pool.query(
      `INSERT INTO tasks (title, description, project_id, created_by, assigned_to, priority, due_date, target_date, status, assigned_by_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        project_id,
        currentUserId,
        finalAssignee,
        priority || "Medium",
        due_date || taskTargetDate,
        taskTargetDate,
        role === "Developer" || role === "Tester" ? "In Progress" : "Assigned",
        finalAssignedByType
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

    // Notify assigned developer/tester if created by someone else
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

    return NextResponse.json({ 
      id: taskId, 
      title, 
      status: role === "Developer" || role === "Tester" ? "In Progress" : "Assigned", 
      target_date: taskTargetDate 
    }, { status: 201 });
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

    const { 
      id, 
      action,
      title,
      description,
      project_id,
      assigned_to,
      priority,
      target_date,
      due_date,
      assigned_by_type,
      status, 
      remarks, 
      task_link, 
      task_links, 
      progress_percentage, 
      hours_spent, 
      blockers, 
      daily_summary,
      issues_count,
      test_sheet_link
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const currentUserId = (session.user as any).id;
    const currentRole = (session.user as any).role;
    const isExecutiveOrAdmin = ["Admin", "CEO", "PM"].includes(currentRole);

    // Retrieve current task details
    const [taskRows]: any = await pool.query(
      `SELECT t.*, p.name as project_name, u.name as assignee_name 
       FROM tasks t 
       LEFT JOIN projects p ON t.project_id = p.id 
       LEFT JOIN users u ON t.assigned_to = u.id 
       WHERE t.id = ?`,
      [id]
    );
    const currentTask = taskRows[0];
    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 2. Action: Edit Task Details (PM/CEO/Admin always, Developer/Tester before Completed)
    if (action === "admin_edit") {
      const isDevOrTester = ["Developer", "Tester"].includes(currentRole);
      if (!isExecutiveOrAdmin) {
        if (!isDevOrTester) {
          return NextResponse.json({ error: "Unauthorized: PM, CEO, Admin, Developer or Tester role required." }, { status: 403 });
        }
        if (currentTask.status === "Completed") {
          return NextResponse.json({ error: "Developers and testers cannot edit a task after it is marked Completed." }, { status: 403 });
        }
      }

      await pool.query(
        `UPDATE tasks 
         SET title = IFNULL(?, title),
             description = IFNULL(?, description),
             project_id = IFNULL(?, project_id),
             assigned_to = IFNULL(?, assigned_to),
             priority = IFNULL(?, priority),
             target_date = IFNULL(?, target_date),
             due_date = IFNULL(?, due_date),
             status = IFNULL(?, status),
             assigned_by_type = IFNULL(?, assigned_by_type),
             progress_percentage = IFNULL(?, progress_percentage),
             hours_spent = IFNULL(?, hours_spent),
             blockers = IFNULL(?, blockers),
             remarks = IFNULL(?, remarks)
         WHERE id = ?`,
        [
          title !== undefined ? title : null,
          description !== undefined ? description : null,
          project_id !== undefined ? project_id : null,
          assigned_to !== undefined ? assigned_to : null,
          priority !== undefined ? priority : null,
          target_date !== undefined ? target_date : null,
          due_date !== undefined ? due_date : null,
          status !== undefined ? status : null,
          assigned_by_type !== undefined ? assigned_by_type : null,
          progress_percentage !== undefined ? progress_percentage : null,
          hours_spent !== undefined ? hours_spent : null,
          blockers !== undefined ? blockers : null,
          remarks !== undefined ? remarks : null,
          id
        ]
      );

      return NextResponse.json({ success: true, id, message: "Task updated successfully by management." });
    }

    // 3. Action: Start Testing (Check-in by QA Tester)
    if (action === "start_testing") {
      await pool.query(
        "UPDATE tasks SET status = 'Testing', testing_started_at = NOW() WHERE id = ?",
        [id]
      );
      return NextResponse.json({ success: true, id, status: "Testing" });
    }

    // 4. Action: Finish Testing (Check-out by QA Tester with issue count and test sheet)
    if (action === "finish_testing") {
      const parsedIssuesCount = parseInt(issues_count) || 0;
      const finalTestStatus = parsedIssuesCount > 0 ? "Changes Required" : "Tested (PASS)";

      await pool.query(
        `UPDATE tasks 
         SET status = ?, 
             testing_ended_at = NOW(), 
             issues_count = ?, 
             test_sheet_link = ?, 
             remarks = IFNULL(?, remarks) 
         WHERE id = ?`,
        [finalTestStatus, parsedIssuesCount, test_sheet_link || null, remarks || null, id]
      );

      // Auto-record QA testing accomplishment in daily_work table for the Tester
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        let testingHours = 1.0;
        if (currentTask.testing_started_at) {
          const startTime = new Date(currentTask.testing_started_at).getTime();
          const diffHours = Math.max(0.25, (Date.now() - startTime) / (1000 * 60 * 60));
          testingHours = Math.round(diffHours * 10) / 10;
        }

        const workSummary = parsedIssuesCount === 0 
          ? `QA Verification PASSED: "${currentTask.title}" in project "${currentTask.project_name || 'General'}" (0 issues). Verified and ready for Demo.`
          : `QA Verification COMPLETED: "${currentTask.title}" in project "${currentTask.project_name || 'General'}" (${parsedIssuesCount} issues found). Returned to developer with test sheet: ${test_sheet_link || 'N/A'}`;

        await pool.query(
          `INSERT INTO daily_work (user_id, project_id, task_id, date, hours_worked, work_description, status, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            currentUserId,
            currentTask.project_id || null,
            id,
            todayStr,
            testingHours,
            workSummary,
            finalTestStatus === "Tested (PASS)" ? "Completed" : "In Progress",
            remarks || (parsedIssuesCount > 0 ? `${parsedIssuesCount} issues reported` : "QA Verification Passed")
          ]
        );
      } catch (logErr) {
        console.error("Failed to auto-sync QA accomplishment to daily_work:", logErr);
      }

      // Notify developer
      if (currentTask.assigned_to) {
        if (parsedIssuesCount > 0) {
          // Send back to developer with issues
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')`,
            [
              currentTask.assigned_to,
              `QA Reported ${parsedIssuesCount} Issue(s) on "${currentTask.title}"`,
              `QA testing complete. ${parsedIssuesCount} issues found. Test Sheet: ${test_sheet_link || "Check dashboard"}. Notes: ${remarks || "Please fix and re-submit."}`
            ]
          );
        } else {
          // Fully fixed / passed QA
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'success')`,
            [
              currentTask.assigned_to,
              `QA Verification PASSED: "${currentTask.title}"`,
              `All test cases passed cleanly with 0 issues. Task is ready for demo submission.`
            ]
          );
        }
      }

      return NextResponse.json({ 
        success: true, 
        id, 
        status: finalTestStatus, 
        issues_count: parsedIssuesCount,
        test_sheet_link 
      });
    }

    // 5. Action: Send to Testing (Developer submitting preview links)
    if (action === "send_to_testing") {
      let finalLinksArray = task_links;
      if (!finalLinksArray && task_link) finalLinksArray = [task_link];
      if (!Array.isArray(finalLinksArray) || finalLinksArray.filter(l => l && l.trim()).length === 0) {
        return NextResponse.json({ error: "At least one valid Task Preview or PR link is required." }, { status: 400 });
      }

      const linksCleaned = finalLinksArray.filter(l => l && l.trim());
      const primaryLink = linksCleaned[0];
      const linksJson = JSON.stringify(linksCleaned);

      await pool.query(
        `UPDATE tasks 
         SET status = 'Ready for Testing', 
             task_link = ?, 
             task_links = ?, 
             remarks = IFNULL(?, remarks),
             progress_percentage = 100 
         WHERE id = ?`,
        [primaryLink, linksJson, remarks || null, id]
      );

      // Alert QA testers
      await pool.query(
        `INSERT INTO notifications (target_role, title, message, type) VALUES ('Tester', ?, ?, 'task_ready')`,
        [
          `QA Testing Required: ${currentTask.title || "Task"}`,
          `${currentTask.assignee_name || "Developer"} submitted "${currentTask.title}" in project "${currentTask.project_name}" for QA verification. ${linksCleaned.length} preview links provided.`
        ]
      );

      return NextResponse.json({ success: true, id, status: "Ready for Testing", task_links: linksCleaned });
    }

    // 5b. Action: Direct Submit (Fast-track to Ready for Demo)
    if (action === "direct_submit") {
      let finalLinksArray = task_links;
      if (!finalLinksArray && task_link) finalLinksArray = [task_link];
      if (!Array.isArray(finalLinksArray) || finalLinksArray.filter(l => l && l.trim()).length === 0) {
        return NextResponse.json({ error: "At least one valid preview link is required." }, { status: 400 });
      }

      const linksCleaned = finalLinksArray.filter(l => l && l.trim());
      const primaryLink = linksCleaned[0];
      const linksJson = JSON.stringify(linksCleaned);

      await pool.query(
        `UPDATE tasks 
         SET status = 'Ready for Demo', 
             task_link = ?, 
             task_links = ?, 
             remarks = IFNULL(?, remarks),
             progress_percentage = 100 
         WHERE id = ?`,
        [primaryLink, linksJson, remarks || null, id]
      );

      // Alert PMs/CEOs
      await pool.query(
        `INSERT INTO notifications (target_role, title, message, type) VALUES ('PM', ?, ?, 'success'), ('CEO', ?, ?, 'success')`,
        [
          `Direct Submit: ${currentTask.title || "Task"}`,
          `${currentTask.assignee_name || "Developer"} fast-tracked "${currentTask.title}" directly to Demo.`,
          `Direct Submit: ${currentTask.title || "Task"}`,
          `${currentTask.assignee_name || "Developer"} fast-tracked "${currentTask.title}" directly to Demo.`
        ]
      );

      return NextResponse.json({ success: true, id, status: "Ready for Demo", task_links: linksCleaned });
    }

    // 6. Standard Progress / Lifecycle Status Update
    const newStatus = status || currentTask.status;

    let linksJson = undefined;
    if (task_links && Array.isArray(task_links)) {
      linksJson = JSON.stringify(task_links.filter(l => l && l.trim()));
    }

    await pool.query(
      `UPDATE tasks 
       SET status = ?, 
           remarks = IFNULL(?, remarks), 
           task_link = IFNULL(?, task_link),
           task_links = IFNULL(?, task_links),
           progress_percentage = IFNULL(?, progress_percentage),
           hours_spent = IFNULL(?, hours_spent),
           blockers = IFNULL(?, blockers),
           daily_summary = IFNULL(?, daily_summary)
       WHERE id = ?`,
      [
        newStatus, 
        remarks !== undefined ? remarks : null, 
        task_link !== undefined ? task_link : null,
        linksJson !== undefined ? linksJson : null,
        progress_percentage !== undefined ? progress_percentage : null,
        hours_spent !== undefined ? hours_spent : null,
        blockers !== undefined ? blockers : null,
        daily_summary !== undefined ? daily_summary : null,
        id
      ]
    );

    // Auto-record into daily_work table if hours or work summary logged
    if ((hours_spent && parseFloat(hours_spent) > 0) || daily_summary) {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        await pool.query(
          `INSERT INTO daily_work (user_id, project_id, task_id, date, hours_worked, work_description, status, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            currentUserId,
            currentTask.project_id || null,
            id,
            todayStr,
            parseFloat(hours_spent) || 1.0,
            daily_summary || `Worked on ${currentTask.title} (${progress_percentage || 0}% done)`,
            newStatus,
            blockers || remarks || null
          ]
        );
      } catch (logErr) {
        console.error("Failed to auto-sync to daily_work log:", logErr);
      }
    }

    // Submit to Demo (Only allowed if QA passed / Tested (PASS)) -> Notify CEO & PM
    if (newStatus === "Ready for Demo" && currentTask.status !== "Ready for Demo") {
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

    return NextResponse.json({ 
      success: true, 
      id, 
      status: newStatus, 
      progress_percentage: progress_percentage ?? currentTask.progress_percentage,
      hours_spent: hours_spent ?? currentTask.hours_spent,
      blockers: blockers ?? currentTask.blockers,
      daily_summary: daily_summary ?? currentTask.daily_summary
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session?.user as any)?.role;
  const isManagement = ["Admin", "CEO", "PM"].includes(role);
  const isDevOrTester = ["Developer", "Tester"].includes(role);

  if (!isManagement && !isDevOrTester) {
    return NextResponse.json({ error: "Unauthorized: PM, CEO, Admin, Developer or Tester role required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const [taskRows]: any = await pool.query("SELECT * FROM tasks WHERE id = ?", [id]);
    if (!taskRows || taskRows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const currentTask = taskRows[0];

    // Developers and testers can only delete tasks before completed status
    if (!isManagement && isDevOrTester && currentTask.status === "Completed") {
      return NextResponse.json({ error: "Developers and testers cannot delete a task after it is marked Completed." }, { status: 403 });
    }

    await pool.query("DELETE FROM task_checklists WHERE task_id = ?", [id]);
    await pool.query("DELETE FROM daily_work WHERE task_id = ?", [id]);
    await pool.query("DELETE FROM tasks WHERE id = ?", [id]);

    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
