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

    // Fetch reminders: Global ones or ones targeting this user, or ones created by this user
    const [rows]: any = await pool.query(
      `SELECT r.*, u.name as creator_name, t.name as target_name 
       FROM reminders r 
       JOIN users u ON r.created_by = u.id 
       LEFT JOIN users t ON r.target_user_id = t.id
       WHERE r.is_global = 1 OR r.target_user_id = ? OR r.created_by = ?
       ORDER BY r.target_date ASC, r.target_time ASC`,
      [userId, userId]
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const role = (session.user as any).role;
  if (!["Admin", "CEO", "PM"].includes(role)) {
    return NextResponse.json({ error: "Only PM, CEO or Admin can create reminders." }, { status: 403 });
  }

  try {
    const userId = (session.user as any).id;
    const { title, message, target_date, target_time, is_global, target_user_id } = await req.json();

    if (!title || !target_date || !target_time) {
      return NextResponse.json({ error: "Title, date, and time are required." }, { status: 400 });
    }

    await pool.query(
      "INSERT INTO reminders (created_by, title, message, target_date, target_time, is_global, target_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, title, message, target_date, target_time, is_global ? 1 : 0, is_global ? null : target_user_id || null]
    );

    return NextResponse.json({ success: true, message: "Reminder added successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const userId = (session.user as any).id;
    const role = (session.user as any).role;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (["Admin", "CEO"].includes(role)) {
      await pool.query("DELETE FROM reminders WHERE id = ?", [id]);
    } else {
      await pool.query("DELETE FROM reminders WHERE id = ? AND created_by = ?", [id, userId]);
    }

    return NextResponse.json({ success: true, message: "Reminder deleted successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
