import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getCurrentISTDate } from "@/lib/timeUtils";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);

    const employeeId = searchParams.get("employee_id");
    const projectId = searchParams.get("project_id");

    // 1. Query records from daily_work
    let dailyWorkQuery = `
      SELECT dw.id,
        dw.user_id,
        dw.project_id,
        dw.task_id,
        dw.date,
        dw.hours_worked,
        dw.work_description,
        dw.status,
        dw.remarks,
        dw.created_at,
        u.name as employee_name, 
        u.role as employee_role,
        p.name as project_name,
        t.title as task_title
      FROM daily_work dw
      JOIN users u ON dw.user_id = u.id
      LEFT JOIN projects p ON dw.project_id = p.id
      LEFT JOIN tasks t ON dw.task_id = t.id
    `;
    let dwConditions: string[] = [];
    let dwParams: any[] = [];

    if (role === "Developer" || role === "Tester") {
      dwConditions.push("dw.user_id = ?");
      dwParams.push(userId);
    } else {
      if (employeeId && employeeId !== "ALL") {
        dwConditions.push("dw.user_id = ?");
        dwParams.push(employeeId);
      }
      if (projectId && projectId !== "ALL") {
        dwConditions.push("dw.project_id = ?");
        dwParams.push(projectId);
      }
    }

    if (dwConditions.length > 0) {
      dailyWorkQuery += " WHERE " + dwConditions.join(" AND ");
    }
    dailyWorkQuery += " ORDER BY dw.date DESC, dw.id DESC LIMIT 100";

    let dailyWorkRows: any[] = [];
    try {
      const [rows]: any = await pool.query(dailyWorkQuery, dwParams);
      if (Array.isArray(rows)) dailyWorkRows = rows;
    } catch (dwErr) {
      console.error("Error querying daily_work:", dwErr);
    }

    // 2. Query completed tasks from tasks table for all employees
    let tasksQuery = `
      SELECT t.id as task_id,
        t.assigned_to as user_id,
        t.project_id,
        COALESCE(t.target_date, DATE(t.updated_at), DATE(t.created_at)) as date,
        COALESCE(t.hours_spent, 1.0) as hours_worked,
        COALESCE(t.daily_summary, t.description, CONCAT('Completed task: ', t.title)) as work_description,
        t.status,
        COALESCE(t.remarks, t.blockers, 'Completed') as remarks,
        t.created_at,
        u.name as employee_name,
        u.role as employee_role,
        p.name as project_name,
        t.title as task_title
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.status IN ('Completed', 'Tested (PASS)', 'Ready for Demo')
    `;
    let taskParams: any[] = [];

    if (role === "Developer" || role === "Tester") {
      tasksQuery += " AND t.assigned_to = ?";
      taskParams.push(userId);
    } else {
      if (employeeId && employeeId !== "ALL") {
        tasksQuery += " AND t.assigned_to = ?";
        taskParams.push(employeeId);
      }
      if (projectId && projectId !== "ALL") {
        tasksQuery += " AND t.project_id = ?";
        taskParams.push(projectId);
      }
    }

    tasksQuery += " ORDER BY t.updated_at DESC, t.id DESC LIMIT 100";

    let taskRows: any[] = [];
    try {
      const [rows]: any = await pool.query(tasksQuery, taskParams);
      if (Array.isArray(rows)) taskRows = rows;
    } catch (taskErr) {
      console.error("Error querying completed tasks for work log:", taskErr);
    }

    // Merge and deduplicate: if a task_id is already in daily_work, prioritize daily_work
    const existingTaskIds = new Set(dailyWorkRows.filter(r => r.task_id).map(r => r.task_id));
    const combined = [...dailyWorkRows];

    for (const tRow of taskRows) {
      if (!existingTaskIds.has(tRow.task_id)) {
        combined.push({
          id: `task_${tRow.task_id}`,
          ...tRow,
        });
      }
    }

    // Sort by date descending
    combined.sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());

    return NextResponse.json(combined);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const userId = (session.user as any).id;
    const body = await req.json();
    const { project_id, task_id, date, hours_worked, work_description, status, remarks } = body;

    if (!work_description || !hours_worked) {
      return NextResponse.json({ error: "Work description and hours worked are required" }, { status: 400 });
    }

    const logDate = date || getCurrentISTDate();

    const [result]: any = await pool.query(
      `INSERT INTO daily_work (user_id, project_id, task_id, date, hours_worked, work_description, status, remarks) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        project_id || null,
        task_id || null,
        logDate,
        parseFloat(hours_worked),
        work_description,
        status || "Completed",
        remarks || null,
      ]
    );

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
