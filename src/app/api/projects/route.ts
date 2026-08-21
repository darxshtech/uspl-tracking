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
        u.name AS creator_name, 
        u.role AS creator_role,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status IN ('Completed', 'Tested (PASS)', 'Ready for Demo')) AS completed_tasks
      FROM projects p 
      LEFT JOIN users u ON p.created_by = u.id
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

    // Fetch members for these projects
    const [memberRows]: any = await pool.query(`
      SELECT pm.project_id, u.id, u.name, u.role 
      FROM project_members pm 
      JOIN users u ON pm.user_id = u.id
    `);

    const memberMap: Record<number, any[]> = {};
    memberRows.forEach((m: any) => {
      if (!memberMap[m.project_id]) memberMap[m.project_id] = [];
      memberMap[m.project_id].push({ id: m.id, name: m.name, role: m.role });
    });

    // Format attachments & members safely
    const formatted = rows.map((r: any) => {
      let attachments = [];
      if (typeof r.attachments === "string") {
        try { attachments = JSON.parse(r.attachments); } catch (_) {}
      } else if (Array.isArray(r.attachments)) {
        attachments = r.attachments;
      }

      return {
        ...r,
        attachments: attachments || [],
        members: memberMap[r.id] || [],
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const creatorId = (session.user as any).id;
    const creatorName = session.user?.name || "Management";
    const creatorRole = (session.user as any).role;

    const body = await req.json();
    const { name, description, start_date, target_date, documentation_url, attachments, members, is_fast_track } = body;

    if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

    const connection: any = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const attachmentsJson = attachments ? JSON.stringify(attachments) : JSON.stringify([]);

      const [result]: any = await connection.query(
        `INSERT INTO projects (name, description, start_date, target_date, documentation_url, attachments, created_by, is_fast_track) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          description || null,
          start_date || null,
          target_date || null,
          documentation_url || null,
          attachmentsJson,
          creatorId,
          is_fast_track ? 1 : 0
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
              `New Project Assigned: ${name}`,
              `${creatorName} (${creatorRole}) assigned you to project "${name}". You can now access specifications, documentation, and create daily tasks.`,
            ]
          );
        }
      }

      await connection.commit();
      return NextResponse.json({ id: projectId, name, description, documentation_url, attachments, created_by: creatorId, is_fast_track: Boolean(is_fast_track) }, { status: 201 });
    } catch (err) {
      await connection.rollback().catch(() => {});
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: PM or CEO role required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, is_fast_track } = body;

    if (!id) return NextResponse.json({ error: "Project ID is required" }, { status: 400 });

    await pool.query(
      "UPDATE projects SET is_fast_track = ? WHERE id = ?",
      [is_fast_track ? 1 : 0, id]
    );

    return NextResponse.json({ success: true, id, is_fast_track: Boolean(is_fast_track) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, description, start_date, target_date, documentation_url, attachments, members, is_fast_track } = body;

    if (!id || !name) return NextResponse.json({ error: "Project ID and name are required" }, { status: 400 });

    const connection: any = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const attachmentsJson = attachments ? JSON.stringify(attachments) : JSON.stringify([]);

      await connection.query(
        `UPDATE projects 
         SET name = ?, description = ?, start_date = ?, target_date = ?, documentation_url = ?, attachments = ?, is_fast_track = IFNULL(?, is_fast_track)
         WHERE id = ?`,
        [
          name,
          description || null,
          start_date || null,
          target_date || null,
          documentation_url || null,
          attachmentsJson,
          is_fast_track !== undefined ? (is_fast_track ? 1 : 0) : null,
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
      return NextResponse.json({ success: true, message: "Project updated successfully" });
    } catch (err) {
      await connection.rollback().catch(() => {});
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: PM or CEO role required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const connection: any = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("DELETE FROM daily_work WHERE project_id = ?", [id]);
      await connection.query("DELETE FROM task_checklists WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)", [id]);
      await connection.query("DELETE FROM tasks WHERE project_id = ?", [id]);
      await connection.query("DELETE FROM project_members WHERE project_id = ?", [id]);
      await connection.query("DELETE FROM projects WHERE id = ?", [id]);

      await connection.commit();
      return NextResponse.json({ success: true, message: "Project deleted successfully" });
    } catch (err) {
      await connection.rollback().catch(() => {});
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
