import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import bcrypt from "bcrypt";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, role, phone, bio, is_active, joining_date, created_at FROM users WHERE is_active = 1 ORDER BY id ASC"
    );
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const currentRole = (session?.user as any)?.role;
  
  if (!session || !["Admin", "CEO", "PM"].includes(currentRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, password, role, is_active, phone, bio } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Only Admin & CEO can create Admin, CEO, or PM roles
    if (["Admin", "CEO", "PM"].includes(role) && !["Admin", "CEO"].includes(currentRole)) {
      return NextResponse.json(
        { error: "Only Admin or CEO can create executive management roles (CEO, PM, Admin)." },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result]: any = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, is_active, phone, bio) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, email, passwordHash, role, is_active ?? true, phone || null, bio || null]
    );

    return NextResponse.json({ id: result.insertId, name, email, role, is_active }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const currentRole = (session?.user as any)?.role;
  
  if (!session || !["Admin", "CEO", "PM"].includes(currentRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, email, role, phone, bio, password, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing employee ID" }, { status: 400 });
    }

    // Quick toggle for is_active status only
    if (name === undefined && is_active !== undefined) {
      await pool.query("UPDATE users SET is_active = ? WHERE id = ?", [is_active, id]);
      return NextResponse.json({ success: true, id, is_active });
    }

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Missing required fields (Name, Email, Role)" }, { status: 400 });
    }

    // Only Admin & CEO can promote or modify executive management roles (CEO, PM, Admin)
    if (["Admin", "CEO", "PM"].includes(role) && !["Admin", "CEO"].includes(currentRole)) {
      return NextResponse.json(
        { error: "Only Admin or CEO can set or modify executive management roles (CEO, PM, Admin)." },
        { status: 403 }
      );
    }

    if (password && password.trim()) {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      await pool.query(
        `UPDATE users 
         SET name = ?, email = ?, role = ?, phone = ?, bio = ?, is_active = ?, password_hash = ?
         WHERE id = ?`,
        [name, email, role, phone || null, bio || null, is_active ?? true, passwordHash, id]
      );
    } else {
      await pool.query(
        `UPDATE users 
         SET name = ?, email = ?, role = ?, phone = ?, bio = ?, is_active = ?
         WHERE id = ?`,
        [name, email, role, phone || null, bio || null, is_active ?? true, id]
      );
    }

    return NextResponse.json({ success: true, id, name, email, role, is_active });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const currentRole = (session?.user as any)?.role;
  const currentUserId = (session?.user as any)?.id;
  
  if (!session || !["Admin", "CEO", "PM"].includes(currentRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing employee ID" }, { status: 400 });
    }

    const empId = parseInt(id);

    if (empId === currentUserId) {
      return NextResponse.json({ error: "You cannot delete your own active account." }, { status: 400 });
    }

    // Clean up relations before deleting user
    await pool.query("DELETE FROM project_members WHERE user_id = ?", [empId]);
    await pool.query("DELETE FROM attendance WHERE user_id = ?", [empId]);
    await pool.query("DELETE FROM notifications WHERE user_id = ?", [empId]);
    await pool.query("UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?", [empId]);
    
    const [delResult]: any = await pool.query("DELETE FROM users WHERE id = ?", [empId]);

    if (delResult.affectedRows === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Employee ID ${empId} deleted successfully.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
