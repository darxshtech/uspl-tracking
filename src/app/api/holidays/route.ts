import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    let query = "SELECT * FROM holidays";
    let params: any[] = [];

    if (year) {
      query += " WHERE DATE_FORMAT(date, '%Y') = ?";
      params.push(year);
    }

    query += " ORDER BY date ASC";

    const [rows] = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: PM or CEO role required to add holidays" }, { status: 403 });
  }

  try {
    const userId = (session.user as any).id;
    const body = await req.json();
    const { name, date, description } = body;

    if (!name || !date) {
      return NextResponse.json({ error: "Holiday name and date are required" }, { status: 400 });
    }

    const [result]: any = await pool.query(
      `INSERT INTO holidays (name, date, description, created_by) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
      [name, date, description || null, userId]
    );

    // Notify all employees about the upcoming holiday
    await pool.query(
      `INSERT INTO notifications (title, message, type) 
       VALUES (?, ?, 'info')`,
      [
        `📅 Upcoming Holiday: ${name}`,
        `A company holiday has been scheduled on ${new Date(date).toLocaleDateString()} for "${name}". Attendance is not required on this date.`,
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.insertId,
      name,
      date,
      message: `Holiday "${name}" added successfully on ${date}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Holiday ID required" }, { status: 400 });
    }

    await pool.query("DELETE FROM holidays WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Holiday removed successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
