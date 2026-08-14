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
      SELECT p.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name, 'role', u.role))
         FROM project_members pm
         JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = p.id) AS members
      FROM projects p
    `;
    let params: any[] = [];
    
    // Developer and Tester should only see assigned projects
    if (role === "Developer" || role === "Tester") {
      query += `
        WHERE p.id IN (
          SELECT project_id FROM project_members WHERE user_id = ?
        )
      `;
      params = [userId];
    }

    query += " ORDER BY p.created_at DESC";

    const [rows]: any = await pool.query(query, params);

    // Format attachments & members if stored as JSON strings
    const formatted = rows.map((r: any) => {
      let attachments = [];
      if (typeof r.attachments === "string") {
        try { attachments = JSON.parse(r.attachments); } catch (_) {}
      } else if (Array.isArray(r.attachments)) {
        attachments = r.attachments;
      }

      let members = [];
      if (typeof r.members === "string") {
        try { members = JSON.parse(r.members); } catch (_) {}
      } else if (Array.isArray(r.members)) {
        members = r.members;
      }

      return {
        ...r,
        attachments,
        members: members || [],
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, description, start_date, target_date, status, documentation_url, attachments, members } = body;

    if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

    const connection: any = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const attachmentsJson = attachments ? JSON.stringify(attachments) : JSON.stringify([]);

      const [result]: any = await connection.query(
        `INSERT INTO projects (name, description, start_date, target_date, status, documentation_url, attachments) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          description || null,
          start_date || null,
          target_date || null,
          status || "Planning",
          documentation_url || null,
          attachmentsJson,
        ]
      );

      const projectId = result.insertId;

      if (members && Array.isArray(members) && members.length > 0) {
        const memberValues = members.map((memberId: any) => [projectId, parseInt(memberId)]);
        await connection.query(
          "INSERT INTO project_members (project_id, user_id) VALUES ?",
          [memberValues]
        );

        // Dispatch instant alert notifications to assigned team members
        for (const memberId of members) {
          await connection.query(
            `INSERT INTO notifications (user_id, title, message, type) 
             VALUES (?, ?, ?, 'info')`,
            [
              memberId,
              `Assigned to Project: ${name}`,
              `You have been added to project "${name}". You can now access its specifications, documentation, and tasks.`,
            ]
          );
        }
      }

      await connection.commit();
      connection.release();

      return NextResponse.json({ id: projectId, name, description, documentation_url, attachments }, { status: 201 });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, description, start_date, target_date, status, documentation_url, attachments, members } = body;

    if (!id || !name) return NextResponse.json({ error: "Project ID and name are required" }, { status: 400 });

    const connection: any = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const attachmentsJson = attachments ? JSON.stringify(attachments) : JSON.stringify([]);

      await connection.query(
        `UPDATE projects 
         SET name = ?, description = ?, start_date = ?, target_date = ?, status = ?, documentation_url = ?, attachments = ?
         WHERE id = ?`,
        [
          name,
          description || null,
          start_date || null,
          target_date || null,
          status || "Planning",
          documentation_url || null,
          attachmentsJson,
          id,
        ]
      );

      if (members && Array.isArray(members)) {
        // Sync project members
        await connection.query("DELETE FROM project_members WHERE project_id = ?", [id]);
        if (members.length > 0) {
          const memberValues = members.map((memberId: any) => [id, parseInt(memberId)]);
          await connection.query(
            "INSERT INTO project_members (project_id, user_id) VALUES ?",
            [memberValues]
          );

          // Alert newly assigned members
          for (const memberId of members) {
            await connection.query(
              `INSERT INTO notifications (user_id, title, message, type) 
               VALUES (?, ?, ?, 'info')`,
              [
                memberId,
                `Project Update: ${name}`,
                `You are assigned to "${name}". Project documentation and tasks are now updated on your dashboard.`,
              ]
            );
          }
        }
      }

      await connection.commit();
      connection.release();

      return NextResponse.json({ success: true, message: "Project updated successfully" });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
