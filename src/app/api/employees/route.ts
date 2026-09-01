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

  const currentRole = (session?.user as any)?.role;
  const isManager = ["Admin", "CEO", "PM"].includes(currentRole);

  try {
    const query = isManager
      ? "SELECT id, name, email, role, phone, bio, is_active, total_leaves_allowed, leaves_carried_forward, monthly_salary, joining_date, created_at FROM users ORDER BY is_active DESC, id ASC"
      : "SELECT id, name, email, role, phone, bio, is_active, total_leaves_allowed, leaves_carried_forward, monthly_salary, joining_date, created_at FROM users WHERE is_active = 1 ORDER BY id ASC";

    const [rows]: any = await pool.query(query);

    const [tasks]: any = await pool.query(
      "SELECT id, assigned_to, status FROM tasks"
    );
    const [taskAssignees]: any = await pool.query(
      "SELECT task_id, user_id FROM task_assignees"
    );

    const isTaskCompleted = (status: string) => {
      return ["Completed", "Tested (PASS)", "Ready for Demo"].includes(status);
    };

    // Pre-index task assignees by task_id -> Set of user_ids
    const taskAssigneesMap = new Map<number, Set<number>>();
    taskAssignees.forEach((ta: any) => {
      if (!taskAssigneesMap.has(ta.task_id)) {
        taskAssigneesMap.set(ta.task_id, new Set());
      }
      taskAssigneesMap.get(ta.task_id)!.add(ta.user_id);
    });

    // Pre-calculate user task metrics in a single pass
    const userMetricsMap = new Map<number, { total: number; completed: number; inProgress: number }>();
    rows.forEach((u: any) => {
      userMetricsMap.set(u.id, { total: 0, completed: 0, inProgress: 0 });
    });

    tasks.forEach((t: any) => {
      const assignedUsers = new Set<number>();
      if (t.assigned_to) assignedUsers.add(t.assigned_to);
      const extra = taskAssigneesMap.get(t.id);
      if (extra) {
        extra.forEach((uid) => assignedUsers.add(uid));
      }

      const completed = isTaskCompleted(t.status);
      const inProgress = t.status === "In Progress" || t.status === "Planning";

      assignedUsers.forEach((uid) => {
        const m = userMetricsMap.get(uid);
        if (m) {
          m.total += 1;
          if (completed) m.completed += 1;
          if (inProgress) m.inProgress += 1;
        }
      });
    });

    const formatted = rows.map((user: any) => {
      const m = userMetricsMap.get(user.id) || { total: 0, completed: 0, inProgress: 0 };
      const completionRatio = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;

      return {
        ...user,
        is_active: user.is_active === 1 || user.is_active === true,
        monthly_salary: parseFloat(user.monthly_salary || "0"),
        total_leaves_allowed: user.total_leaves_allowed !== null ? Number(user.total_leaves_allowed) : 2,
        leaves_carried_forward: parseFloat(user.leaves_carried_forward || "0"),
        total_tasks: m.total,
        completed_tasks: m.completed,
        in_progress_tasks: m.inProgress,
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
    const { name, email, password, role, is_active, phone, bio, total_leaves_allowed, leaves_carried_forward, monthly_salary } = body;

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
      `INSERT INTO users (name, email, password_hash, role, is_active, phone, bio, total_leaves_allowed, leaves_carried_forward, monthly_salary) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        email, 
        passwordHash, 
        role, 
        is_active ?? true, 
        phone || null, 
        bio || null, 
        total_leaves_allowed !== undefined ? total_leaves_allowed : 2,
        leaves_carried_forward !== undefined ? leaves_carried_forward : 0.0,
        monthly_salary !== undefined ? monthly_salary : 0.0
      ]
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
  const currentUserId = (session?.user as any)?.id;

  if (!session || !["Admin", "CEO", "PM"].includes(currentRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, email, role, phone, bio, is_active, password, total_leaves_allowed, leaves_carried_forward, monthly_salary } = body;

    if (!id) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    // Prevent deactivating own account
    if (is_active !== undefined && (is_active === false || is_active === 0) && Number(id) === Number(currentUserId)) {
      return NextResponse.json(
        { error: "Action Prohibited: You cannot deactivate your own logged-in account." },
        { status: 400 }
      );
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
    if (total_leaves_allowed !== undefined) {
      fields.push("total_leaves_allowed = ?");
      params.push(total_leaves_allowed);
    }
    if (leaves_carried_forward !== undefined) {
      fields.push("leaves_carried_forward = ?");
      params.push(leaves_carried_forward);
    }
    if (monthly_salary !== undefined) {
      fields.push("monthly_salary = ?");
      params.push(monthly_salary);
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
