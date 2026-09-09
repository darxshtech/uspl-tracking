import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// Ensure project_third_party_credentials table exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_third_party_credentials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      service_name VARCHAR(100) NOT NULL,
      service_category VARCHAR(50) DEFAULT 'API / Service',
      environment VARCHAR(50) DEFAULT 'Production',
      credentials_data JSON NOT NULL,
      notes TEXT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_project_id (project_id),
      INDEX idx_service_category (service_category),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

// GET: Fetch 3rd-party credentials scoped to user's assigned projects
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await ensureTable();

    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    const isExecutive = ["Admin", "CEO", "PM"].includes(role);

    const { searchParams } = new URL(req.url);
    const filterProjectId = searchParams.get("project_id") || searchParams.get("projectId");
    const category = searchParams.get("category");

    let query = `
      SELECT 
        c.*, 
        p.name as project_title,
        p.description as project_description,
        u.name as creator_name,
        u.role as creator_role,
        u.email as creator_email
      FROM project_third_party_credentials c
      JOIN projects p ON c.project_id = p.id
      JOIN users u ON c.created_by = u.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    // STRICT SECURITY: Developers & Testers only see credentials for projects they are assigned to
    if (!isExecutive) {
      conditions.push(`(
        c.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        OR c.project_id IN (
          SELECT project_id FROM tasks 
          WHERE assigned_to = ? OR id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)
        )
      )`);
      params.push(userId, String(userId), userId);
    }

    if (filterProjectId && filterProjectId !== "0" && filterProjectId !== "ALL") {
      conditions.push("c.project_id = ?");
      params.push(parseInt(filterProjectId, 10));
    }

    if (category && category !== "ALL") {
      conditions.push("c.service_category = ?");
      params.push(category);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY c.updated_at DESC, c.id DESC";

    const [rows]: any = await pool.query(query, params);

    // Fetch team members for the projects in the result set
    const projectIds = Array.from(new Set(rows.map((r: any) => r.project_id)));
    let memberMap: Record<number, any[]> = {};
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => "?").join(",");
      const [memberRows]: any = await pool.query(`
        SELECT pm.project_id, u.id, u.name, u.role, u.email
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id IN (${placeholders})
      `, projectIds);

      if (Array.isArray(memberRows)) {
        memberRows.forEach((m: any) => {
          if (!memberMap[m.project_id]) memberMap[m.project_id] = [];
          memberMap[m.project_id].push({
            id: m.id,
            name: m.name,
            role: m.role,
            email: m.email,
          });
        });
      }
    }

    // Format rows safely
    const formatted = rows.map((row: any) => {
      let parsedData: Record<string, any> = {};
      if (typeof row.credentials_data === "string") {
        try {
          parsedData = JSON.parse(row.credentials_data);
        } catch {
          parsedData = {};
        }
      } else if (typeof row.credentials_data === "object" && row.credentials_data !== null) {
        parsedData = row.credentials_data;
      }

      return {
        ...row,
        credentials_data: parsedData,
        team_members: memberMap[row.project_id] || [],
      };
    });

    return NextResponse.json({
      success: true,
      credentials: formatted,
    });
  } catch (error: any) {
    console.error("GET /api/third-party-credentials error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new 3rd-party credential for an assigned project
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await ensureTable();

    const currentUserId = (session.user as any).id;
    const currentUserRole = (session.user as any).role;
    const currentUserName = (session.user as any).name || "Team Member";
    const isExecutive = ["Admin", "CEO", "PM"].includes(currentUserRole);

    const body = await req.json();
    const { project_id, service_name, service_category, environment, credentials_data, notes } = body;

    if (!project_id) {
      return NextResponse.json({ error: "Please select an assigned project." }, { status: 400 });
    }
    if (!service_name || !service_name.trim()) {
      return NextResponse.json({ error: "Service name is required." }, { status: 400 });
    }
    if (!credentials_data || Object.keys(credentials_data).length === 0) {
      return NextResponse.json({ error: "Please enter at least one credential field or key." }, { status: 400 });
    }

    const numericProjectId = parseInt(String(project_id), 10);

    // Verify user has access to this project
    if (!isExecutive) {
      const [assigned]: any = await pool.query(`
        SELECT id FROM project_members WHERE project_id = ? AND user_id = ?
        UNION
        SELECT id FROM tasks WHERE project_id = ? AND (assigned_to = ? OR id IN (SELECT task_id FROM task_assignees WHERE user_id = ?))
      `, [numericProjectId, currentUserId, numericProjectId, String(currentUserId), currentUserId]);

      if (!assigned || assigned.length === 0) {
        return NextResponse.json({ 
          error: "You can only add credentials to projects where you are an assigned team member." 
        }, { status: 403 });
      }
    }

    const [projRows]: any = await pool.query("SELECT name FROM projects WHERE id = ?", [numericProjectId]);
    const projectName = projRows?.[0]?.name || "Project";

    const jsonString = typeof credentials_data === "string" ? credentials_data : JSON.stringify(credentials_data);

    const [result]: any = await pool.query(`
      INSERT INTO project_third_party_credentials 
        (project_id, service_name, service_category, environment, credentials_data, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      numericProjectId,
      service_name.trim(),
      service_category || "API / Service",
      environment || "Production",
      jsonString,
      notes ? notes.trim() : null,
      currentUserId,
    ]);

    // Send notifications to other project members & management
    try {
      const [members]: any = await pool.query(`
        SELECT DISTINCT u.id 
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ? AND u.id != ?
      `, [numericProjectId, currentUserId]);

      if (Array.isArray(members)) {
        for (const m of members) {
          await pool.query(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, 'credential_added')
          `, [
            m.id,
            `🔑 3rd-Party Credentials: ${service_name.trim()}`,
            `${currentUserName} added ${service_name.trim()} (${environment || 'Production'}) credentials for ${projectName}.`,
          ]);
        }
      }
    } catch (notifErr) {
      console.warn("Failed to dispatch credential notification:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `${service_name.trim()} credentials saved for ${projectName}.`,
      id: result.insertId,
    });
  } catch (error: any) {
    console.error("POST /api/third-party-credentials error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update an existing 3rd-party credential
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await ensureTable();

    const currentUserId = (session.user as any).id;
    const currentUserRole = (session.user as any).role;
    const isExecutive = ["Admin", "CEO", "PM"].includes(currentUserRole);

    const body = await req.json();
    const { id, project_id, service_name, service_category, environment, credentials_data, notes } = body;

    if (!id) {
      return NextResponse.json({ error: "Credential ID is required." }, { status: 400 });
    }

    const [existingRows]: any = await pool.query(
      "SELECT * FROM project_third_party_credentials WHERE id = ?",
      [id]
    );
    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json({ error: "Credential record not found." }, { status: 404 });
    }
    const existing = existingRows[0];

    // Check project permission
    if (!isExecutive) {
      const [assigned]: any = await pool.query(`
        SELECT id FROM project_members WHERE project_id = ? AND user_id = ?
        UNION
        SELECT id FROM tasks WHERE project_id = ? AND (assigned_to = ? OR id IN (SELECT task_id FROM task_assignees WHERE user_id = ?))
      `, [existing.project_id, currentUserId, existing.project_id, String(currentUserId), currentUserId]);

      if (!assigned || assigned.length === 0) {
        return NextResponse.json({ error: "You do not have permission to edit credentials for this project." }, { status: 403 });
      }
    }

    const numericProjectId = project_id ? parseInt(String(project_id), 10) : existing.project_id;
    const jsonString = credentials_data 
      ? (typeof credentials_data === "string" ? credentials_data : JSON.stringify(credentials_data))
      : existing.credentials_data;

    await pool.query(`
      UPDATE project_third_party_credentials
      SET project_id = ?,
          service_name = ?,
          service_category = ?,
          environment = ?,
          credentials_data = ?,
          notes = ?
      WHERE id = ?
    `, [
      numericProjectId,
      service_name ? service_name.trim() : existing.service_name,
      service_category || existing.service_category,
      environment || existing.environment,
      jsonString,
      notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
      id
    ]);

    return NextResponse.json({
      success: true,
      message: "3rd-party credential updated successfully.",
    });
  } catch (error: any) {
    console.error("PUT /api/third-party-credentials error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a 3rd-party credential
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await ensureTable();

    const currentUserId = (session.user as any).id;
    const currentUserRole = (session.user as any).role;
    const isExecutive = ["Admin", "CEO", "PM"].includes(currentUserRole);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing credential id" }, { status: 400 });

    const [existingRows]: any = await pool.query(
      "SELECT * FROM project_third_party_credentials WHERE id = ?",
      [id]
    );
    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json({ error: "Credential record not found." }, { status: 404 });
    }
    const existing = existingRows[0];

    // Check permission
    if (!isExecutive) {
      const [assigned]: any = await pool.query(`
        SELECT id FROM project_members WHERE project_id = ? AND user_id = ?
        UNION
        SELECT id FROM tasks WHERE project_id = ? AND (assigned_to = ? OR id IN (SELECT task_id FROM task_assignees WHERE user_id = ?))
      `, [existing.project_id, currentUserId, existing.project_id, String(currentUserId), currentUserId]);

      if ((!assigned || assigned.length === 0) && existing.created_by !== currentUserId) {
        return NextResponse.json({ error: "You do not have permission to delete this credential." }, { status: 403 });
      }
    }

    await pool.query("DELETE FROM project_third_party_credentials WHERE id = ?", [id]);

    return NextResponse.json({
      success: true,
      message: "3rd-party credential deleted successfully.",
    });
  } catch (error: any) {
    console.error("DELETE /api/third-party-credentials error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
