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

    let query = `
      SELECT dw.*, 
        u.name as employee_name, 
        u.role as employee_role,
        p.name as project_name,
        t.title as task_title
      FROM daily_work dw
      JOIN users u ON dw.user_id = u.id
      LEFT JOIN projects p ON dw.project_id = p.id
      LEFT JOIN tasks t ON dw.task_id = t.id
    `;
    let params: any[] = [];

    // Developers only see their own work, unless CEO/PM
    if (role === "Developer" || role === "Tester") {
      query += " WHERE dw.user_id = ?";
      params.push(userId);
    } else {
      let conditions = [];
      if (employeeId && employeeId !== "ALL") {
        conditions.push("dw.user_id = ?");
        params.push(employeeId);
      }
      if (projectId && projectId !== "ALL") {
        conditions.push("dw.project_id = ?");
        params.push(projectId);
      }
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
    }

    query += " ORDER BY dw.date DESC, dw.id DESC LIMIT 100";

    const [rows] = await pool.query(query, params);
    return NextResponse.json(rows);
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
