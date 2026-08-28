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
    const [rows]: any = await pool.query(
      "SELECT id, name, email, role, phone, bio, is_active, joining_date, created_at FROM users WHERE is_active = 1 ORDER BY id ASC"
    );

    // Fetch task metrics across all active users
    const [tasks]: any = await pool.query(
      "SELECT id, assigned_to, status FROM tasks"
    );
    const [taskAssignees]: any = await pool.query(
      "SELECT task_id, user_id FROM task_assignees"
    );

    const isTaskCompleted = (status: string) => {
      return ["Completed", "Tested (PASS)", "Ready for Demo"].includes(status);
    };

    const formatted = rows.map((user: any) => {
      const userTasks = tasks.filter((t: any) => 
        t.assigned_to === user.id || taskAssignees.some((ta: any) => ta.task_id === t.id && ta.user_id === user.id)
      );
      const totalTasks = userTasks.length;
      const completedTasks = userTasks.filter((t: any) => isTaskCompleted(t.status)).length;
      const inProgressTasks = userTasks.filter((t: any) => t.status === "In Progress" || t.status === "Planning").length;
      const completionRatio = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...user,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: inProgressTasks,
        completion_ratio: completionRatio,
      };
    });

    return NextResponse.json(formatted);
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
    const { id, name, email, role, phone, bio, is_active, password } = body;

    if (!id) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    // Only Admin & CEO can update or assign executive management roles (Admin, CEO, PM)
    if (role && ["Admin", "CEO", "PM"].includes(role) && !["Admin", "CEO"].includes(currentRole)) {
      return NextResponse.json(
        { error: "Only Admin or CEO can assign executive management roles (CEO, PM, Admin)." },
        { status: 403 }
      );
    }

    // Build dynamic UPDATE query
    let query = "UPDATE users SET ";
    const params: any[] = [];
    const fields: string[] = [];

    if (name !== undefined) {
      fields.push("name = ?");
      params.push(name);
    }
    if (email !== undefined) {
      fields.push("email = ?");
      params.push(email);
    }
    if (role !== undefined) {
      fields.push("role = ?");
      params.push(role);
    }
    if (phone !== undefined) {
      fields.push("phone = ?");
      params.push(phone);
    }
    if (bio !== undefined) {
      fields.push("bio = ?");
      params.push(bio);
    }
    if (is_active !== undefined) {
      fields.push("is_active = ?");
      params.push(is_active ? 1 : 0);
    }
    if (password && password.trim().length > 0) {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      fields.push("password_hash = ?");
      params.push(passwordHash);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
    }

    query += fields.join(", ") + " WHERE id = ?";
    params.push(id);

    await pool.query(query, params);

    return NextResponse.json({ success: true, message: "Employee updated successfully" });
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

  // Only Admin or CEO can delete employees permanently
  if (!session || !["Admin", "CEO"].includes(currentRole)) {
    return NextResponse.json(
      { error: "Unauthorized: Admin or CEO role required to delete employees" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    const employeeId = parseInt(id, 10);

    // Prevent deleting self
    if (employeeId === currentUserId) {
      return NextResponse.json(
        { error: "Cannot delete your own logged-in account" },
        { status: 400 }
      );
    }

    // Clean up memberships, assignees, and mark inactive or delete
    await pool.query("DELETE FROM project_members WHERE user_id = ?", [employeeId]);
    await pool.query("DELETE FROM task_assignees WHERE user_id = ?", [employeeId]);
    await pool.query("DELETE FROM document_access WHERE user_id = ?", [employeeId]);
    await pool.query("UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?", [employeeId]);
    await pool.query("DELETE FROM users WHERE id = ?", [employeeId]);

    return NextResponse.json({ success: true, message: "Employee deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
