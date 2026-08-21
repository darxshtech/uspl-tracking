import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    const isExecutive = ["Admin", "CEO", "PM"].includes(role);

    let query = `
      SELECT c.*, p.name as project_title, u.name as user_name 
      FROM credentials c 
      LEFT JOIN projects p ON c.project_id = p.id 
      JOIN users u ON c.user_id = u.id 
    `;
    let params: any[] = [];

    if (!isExecutive) {
      query += " WHERE c.user_id = ?";
      params = [userId];
    }
    
    query += " ORDER BY c.created_at DESC";

    const [rows]: any = await pool.query(query, params);

    // Group rows by project + credentials_text + links so multi-assigned credentials show as one card
    const groupMap = new Map<string, any>();
    for (const row of rows) {
      const groupKey = `${row.project_id || 'none'}_${row.credentials_text || ''}_${row.live_link || ''}_${row.demo_link || ''}`;
      if (groupMap.has(groupKey)) {
        const existing = groupMap.get(groupKey);
        existing.assigned_users.push({ id: row.user_id, name: row.user_name, credential_id: row.id });
        existing.all_ids.push(row.id);
      } else {
        groupMap.set(groupKey, {
          ...row,
          assigned_users: [{ id: row.user_id, name: row.user_name, credential_id: row.id }],
          all_ids: [row.id],
        });
      }
    }

    return NextResponse.json(Array.from(groupMap.values()));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const currentUserId = (session.user as any).id;
    const currentUserRole = (session.user as any).role;
    const { project_id, user_id, user_ids, role, live_link, demo_link, credentials_text } = await req.json();

    const isExecutive = ["Admin", "CEO", "PM"].includes(currentUserRole);

    let targetUserIds: number[] = [];
    if (isExecutive && Array.isArray(user_ids) && user_ids.length > 0) {
      targetUserIds = user_ids.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
    } else if (isExecutive && user_id) {
      targetUserIds = [parseInt(user_id, 10)];
    } else {
      targetUserIds = [currentUserId];
    }

    for (const uId of targetUserIds) {
      const [uRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [uId]);
      const targetRole = uRows?.[0]?.role || role || currentUserRole;
      await pool.query(
        "INSERT INTO credentials (project_id, user_id, role, live_link, demo_link, credentials_text) VALUES (?, ?, ?, ?, ?, ?)",
        [project_id || null, uId, targetRole, live_link || null, demo_link || null, credentials_text || null]
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: `Credentials successfully assigned to ${targetUserIds.length} team member(s).` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const currentUserId = (session.user as any).id;
    const role = (session.user as any).role;
    const url = new URL(req.url);
    const idParam = url.searchParams.get("id");

    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Support comma-separated IDs for grouped deletion
    const ids = idParam.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (ids.length === 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const placeholders = ids.map(() => "?").join(",");

    if (["Admin", "CEO", "PM"].includes(role)) {
      await pool.query(`DELETE FROM credentials WHERE id IN (${placeholders})`, ids);
    } else {
      await pool.query(`DELETE FROM credentials WHERE id IN (${placeholders}) AND user_id = ?`, [...ids, currentUserId]);
    }

    return NextResponse.json({ success: true, message: "Credentials deleted successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
