import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const role = (session.user as any)?.role || "Developer";
    const userId = (session.user as any)?.id;

    if (!userId) {
      return NextResponse.json([]);
    }

    let rows: any[] = [];
    try {
      const [result]: any = await pool.query(
        "SELECT * FROM notifications WHERE user_id = ? OR target_role = ? OR target_role = 'ALL' ORDER BY created_at DESC LIMIT 30",
        [userId, role]
      );
      rows = result;
    } catch (colErr) {
      try {
        const [result]: any = await pool.query(
          "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
          [userId]
        );
        rows = result;
      } catch (tableErr) {
        console.warn("Notifications table missing or inaccessible:", tableErr);
        rows = [];
      }
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Notifications GET Error:", error);
    return NextResponse.json([]);
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Notification ID required" }, { status: 400 });
    }

    await pool.query("UPDATE notifications SET is_read = true WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
