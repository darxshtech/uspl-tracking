import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

async function ensureTestingColumns() {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS testing_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        tester_id INT NOT NULL,
        result VARCHAR(20) NOT NULL,
        issues_count INT DEFAULT 0,
        test_sheet_link TEXT NULL,
        remarks TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tr_task (task_id),
        INDEX idx_tr_tester (tester_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  } catch (_) {}

  try {
    const [cols]: any = await pool.query("SHOW COLUMNS FROM tasks LIKE 'sent_to_testing_at'");
    if (!cols || cols.length === 0) {
      await pool.query("ALTER TABLE tasks ADD COLUMN sent_to_testing_at DATETIME NULL");
    }
  } catch (_) {}
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await ensureTestingColumns();
    const { searchParams } = new URL(req.url);

    if (searchParams.get("mode") === "stats") {
      const [rRows]: any = await pool.query(`
        SELECT COUNT(*) as cnt FROM tasks 
        WHERE status = 'Ready for Testing' 
           OR (assigned_to IN (SELECT id FROM users WHERE role = 'Tester') AND status NOT IN ('Completed', 'Tested (PASS)', 'Ready for Demo'))
      `);
      const [tRows]: any = await pool.query("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'Testing'");
      const [pRows]: any = await pool.query(`
        SELECT COUNT(DISTINCT t.id) as cnt FROM tasks t
        WHERE t.status IN ('Tested (PASS)', 'Ready for Demo')
           OR (t.assigned_to IN (SELECT id FROM users WHERE role = 'Tester') AND t.status = 'Completed')
      `);
      const [cRows]: any = await pool.query("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'Changes Required'");

      let trPassCount = 0;
      let trFailCount = 0;
      try {
        const [trPass]: any = await pool.query("SELECT COUNT(*) as cnt FROM testing_records WHERE result = 'PASS'");
        const [trFail]: any = await pool.query("SELECT COUNT(*) as cnt FROM testing_records WHERE result = 'FAIL'");
        trPassCount = trPass[0]?.cnt || 0;
        trFailCount = trFail[0]?.cnt || 0;
      } catch (_) {}

      return NextResponse.json({
        readyForTesting: rRows[0]?.cnt || 0,
        inTesting: tRows[0]?.cnt || 0,
        testedPass: Math.max(pRows[0]?.cnt || 0, trPassCount),
        changesRequired: Math.max(cRows[0]?.cnt || 0, trFailCount),
      });
    }

    // Testing queue: active tasks that are Ready for Testing, currently in Testing, OR assigned to Tester role
    const [rows]: any = await pool.query(`
      SELECT t.*, 
        p.id as project_id,
        p.name as project_name, 
        p.created_by as project_created_by,
        pu.name as project_creator_name,
        pu.role as project_creator_role,
        u1.name as assignee_name, 
        u1.role as assignee_role,
        COALESCE(
          (SELECT u_dev.name FROM users u_dev WHERE u_dev.id = t.created_by AND u_dev.role = 'Developer'),
          (SELECT u_pm.name FROM project_members pm JOIN users u_pm ON pm.user_id = u_pm.id WHERE pm.project_id = t.project_id AND u_pm.role = 'Developer' LIMIT 1),
          (SELECT u_dev2.name FROM tasks t_dev JOIN users u_dev2 ON (t_dev.assigned_to = u_dev2.id OR t_dev.created_by = u_dev2.id) WHERE t_dev.project_id = t.project_id AND u_dev2.role = 'Developer' LIMIT 1),
          pu.name,
          'Developer'
        ) as developer_name,
        u2.name as creator_name,
        u2.role as creator_role,
        COALESCE(
          t.sent_to_testing_at, 
          (SELECT MIN(started_at) FROM task_time_logs WHERE task_id = t.id),
          t.created_at
        ) as date_time_sent,
        COALESCE(
          t.testing_started_at,
          (SELECT MIN(started_at) FROM task_time_logs WHERE task_id = t.id AND user_id IN (SELECT id FROM users WHERE role = 'Tester')),
          t.created_at
        ) as qa_started_at,
        TIMESTAMPDIFF(SECOND, 
          COALESCE(
            t.testing_started_at,
            (SELECT MIN(started_at) FROM task_time_logs WHERE task_id = t.id AND user_id IN (SELECT id FROM users WHERE role = 'Tester')),
            t.created_at
          ), 
          CURRENT_TIMESTAMP
        ) as testing_elapsed_seconds
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users pu ON p.created_by = pu.id
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.status IN ('Ready for Testing', 'Testing')
         OR (t.assigned_to IN (SELECT id FROM users WHERE role = 'Tester') AND t.status NOT IN ('Completed', 'Tested (PASS)', 'Ready for Demo'))
      ORDER BY t.created_at DESC
    `);

    // FAST & OPTIMIZED: Fetch checklists ONLY for tasks currently in the queue
    const taskIds = rows.map((r: any) => r.id);
    const checklistMap: Record<number, any[]> = {};
    if (taskIds.length > 0) {
      try {
        const [checklistRows]: any = await pool.query(
          "SELECT * FROM task_checklists WHERE task_id IN (?) ORDER BY id ASC",
          [taskIds]
        );
        if (Array.isArray(checklistRows)) {
          checklistRows.forEach((c: any) => {
            if (!checklistMap[c.task_id]) checklistMap[c.task_id] = [];
            let parsedAtts: any[] = [];
            if (typeof c.attachments === "string") {
              try { parsedAtts = JSON.parse(c.attachments); } catch (_) {}
            } else if (Array.isArray(c.attachments)) {
              parsedAtts = c.attachments;
            }
            checklistMap[c.task_id].push({
              id: c.id,
              task_id: c.task_id,
              item_text: c.item_text,
              is_completed: Boolean(c.is_completed),
              attachments: parsedAtts,
            });
          });
        }
      } catch (_) {}
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

      let parsedAttachments: any[] = [];
      if (typeof r.attachments === "string") {
        try { parsedAttachments = JSON.parse(r.attachments); } catch (_) {}
      } else if (Array.isArray(r.attachments)) {
        parsedAttachments = r.attachments;
      }

      return {
        ...r,
        task_links: parsedLinks,
        attachments: parsedAttachments,
        checklists: checklistMap[r.id] || [],
      };
    });

    // Fetch summary stats for Testers (for Admin, CEO, PM & Tester brief views)
    const [testers]: any = await pool.query(
      `SELECT id, name, email, role FROM users WHERE role = 'Tester' AND is_active = 1 ORDER BY name ASC`
    );

    const testerSummaries: any[] = [];
    for (const tester of testers) {
      // 1. Tasks the tester is working on today
      const [todayLogs]: any = await pool.query(`
        SELECT DISTINCT t.id as task_id, t.title as task_title, t.project_id,
               COALESCE(p.name, 'General') as project_name,
               COALESCE(
                 (SELECT u_dev.name FROM users u_dev WHERE u_dev.id = t.created_by AND u_dev.role = 'Developer'),
                 (SELECT u_pm.name FROM project_members pm JOIN users u_pm ON pm.user_id = u_pm.id WHERE pm.project_id = t.project_id AND u_pm.role = 'Developer' LIMIT 1),
                 'Developer'
               ) as developer_name,
               COALESCE(t.sent_to_testing_at, t.created_at) as date_time_sent,
               COALESCE(t.expected_date, t.due_date, t.target_date) as expected_date,
               ttl.is_active,
               ttl.started_at as session_started_at,
               (
                 SELECT IFNULL(SUM(duration_minutes), 0)
                 FROM task_time_logs 
                 WHERE task_id = t.id AND user_id = ? AND DATE(started_at) = CURRENT_DATE()
               ) as minutes_today
        FROM task_time_logs ttl
        JOIN tasks t ON ttl.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE ttl.user_id = ? AND (ttl.is_active = 1 OR DATE(ttl.started_at) = CURRENT_DATE())
        ORDER BY ttl.started_at DESC
      `, [tester.id, tester.id]);

      // 2. Tested tasks records completed by the tester
      const [records]: any = await pool.query(
        `SELECT DISTINCT t.id as task_id, t.title as task_title, t.project_id, 
                COALESCE(p.name, 'General') as project_name,
                COALESCE(
                  (SELECT u_dev.name FROM users u_dev WHERE u_dev.id = t.created_by AND u_dev.role = 'Developer'),
                  (SELECT u_pm.name FROM project_members pm JOIN users u_pm ON pm.user_id = u_pm.id WHERE pm.project_id = t.project_id AND u_pm.role = 'Developer' LIMIT 1),
                  (SELECT u_dev2.name FROM tasks t_dev JOIN users u_dev2 ON (t_dev.assigned_to = u_dev2.id OR t_dev.created_by = u_dev2.id) WHERE t_dev.project_id = t.project_id AND u_dev2.role = 'Developer' LIMIT 1),
                  'Developer'
                ) as developer_name,
                COALESCE(t.sent_to_testing_at, t.created_at) as date_time_sent,
                COALESCE(t.expected_date, t.due_date, t.target_date) as expected_date,
                COALESCE(t.testing_ended_at, t.updated_at, t.created_at) as tested_at,
                'PASS' as result,
                t.remarks
         FROM tasks t
         LEFT JOIN projects p ON t.project_id = p.id
         WHERE (t.assigned_to = ? OR t.id IN (SELECT task_id FROM task_time_logs WHERE user_id = ?))
           AND t.status IN ('Completed', 'Tested (PASS)', 'Ready for Demo')
         ORDER BY tested_at DESC`,
        [tester.id, tester.id]
      );

      // Group completed tested tasks by project
      const projTestedMap = new Map<number, {
        project_id: number;
        project_name: string;
        count: number;
        tested_count: number;
        developers: Set<string>;
        tasks: any[];
      }>();

      for (const rec of records) {
        const pId = rec.project_id || 0;
        const pName = rec.project_name || "General";
        if (!projTestedMap.has(pId)) {
          projTestedMap.set(pId, {
            project_id: pId,
            project_name: pName,
            count: 0,
            tested_count: 0,
            developers: new Set<string>(),
            tasks: [],
          });
        }
        const grp = projTestedMap.get(pId)!;
        grp.count++;
        grp.tested_count++;
        if (rec.developer_name && rec.developer_name !== "Developer") {
          grp.developers.add(rec.developer_name);
        }
        grp.tasks.push(rec);
      }

      const projectsTestedList = Array.from(projTestedMap.values()).map((p) => ({
        project_id: p.project_id,
        project_name: p.project_name,
        count: p.count,
        tested_count: p.count,
        developers_count: p.developers.size || 1,
        developer_names: Array.from(p.developers),
        tasks: p.tasks,
      }));

      const sameProjectsTested = projectsTestedList.filter((p) => p.count > 1);

      // Distinct developers who sent tasks to this tester
      const allDevs = new Set<string>();
      records.forEach((r: any) => {
        if (r.developer_name && r.developer_name !== "Developer") allDevs.add(r.developer_name);
      });

      // Active tasks currently assigned or in testing for this tester
      const activeForTester = formatted.filter(
        (t: any) => t.status === "Testing" || (t.assigned_to && String(t.assigned_to) === String(tester.id))
      );

      testerSummaries.push({
        id: tester.id,
        name: tester.name,
        email: tester.email,
        role: tester.role,
        active_testing_count: activeForTester.length,
        total_tasks_tested: records.length,
        tested_tasks_count: records.length,
        total_projects_tested: projectsTestedList.length,
        tested_projects_count: projectsTestedList.length,
        developers_involved_count: allDevs.size || 1,
        working_today: todayLogs,
        same_projects_tested: sameProjectsTested,
        completed_projects: projectsTestedList,
        past_tested_tasks: records,
        active_tasks: activeForTester,
      });
    }

    // Group active testing queue by project for "Projects Submitted for Testing"
    const projectQueueMap = new Map<number, any>();
    const allDevsInQueue = new Set<string>();

    for (const task of formatted) {
      const pId = task.project_id || 0;
      const pName = task.project_name || "Standalone / General Tasks";
      if (!projectQueueMap.has(pId)) {
        projectQueueMap.set(pId, {
          project_id: pId,
          project_name: pName,
          project_creator_name: task.project_creator_name || task.creator_name || "Management",
          project_creator_role: task.project_creator_role || task.creator_role || "PM",
          total_queue_tasks: 0,
          ready_count: 0,
          testing_count: 0,
          developers_set: new Set<string>(),
          tasks: [],
        });
      }
      const pGrp = projectQueueMap.get(pId)!;
      pGrp.total_queue_tasks++;
      if (task.status === "Ready for Testing") pGrp.ready_count++;
      if (task.status === "Testing") pGrp.testing_count++;

      if (task.developer_name && task.developer_name !== "Developer") {
        pGrp.developers_set.add(task.developer_name);
        allDevsInQueue.add(task.developer_name);
      }
      pGrp.tasks.push(task);
    }

    const projectQueueList = Array.from(projectQueueMap.values()).map((p) => ({
      project_id: p.project_id,
      project_name: p.project_name,
      project_creator_name: p.project_creator_name,
      project_creator_role: p.project_creator_role,
      total_queue_tasks: p.total_queue_tasks,
      ready_count: p.ready_count,
      testing_count: p.testing_count,
      developers: Array.from(p.developers_set),
      developers_count: p.developers_set.size || (p.tasks[0]?.developer_name ? 1 : 0),
      tasks: p.tasks,
    }));

    const projectsSubmittedSummary = {
      total_projects_count: projectQueueList.length,
      total_tasks_count: formatted.length,
      total_developers_count: allDevsInQueue.size || (formatted.length > 0 ? 1 : 0),
      developer_names: Array.from(allDevsInQueue),
      projects: projectQueueList,
    };

    return NextResponse.json({
      success: true,
      tasks: formatted,
      testers: testerSummaries,
      project_queue: projectQueueList,
      projects_submitted: projectsSubmittedSummary,
    });
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

    if (["Tested (PASS)", "Ready for Demo"].includes(newStatus)) {
      await pool.query(
        `UPDATE task_time_logs 
         SET ended_at = CURRENT_TIMESTAMP, 
             duration_minutes = GREATEST(1, ROUND(TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP) / 60)), 
             session_summary = IFNULL(session_summary, CONCAT('QA verified: ', ?)), 
             is_active = 0 
         WHERE task_id = ? AND is_active = 1`,
        [newStatus, task_id]
      );
    }

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
