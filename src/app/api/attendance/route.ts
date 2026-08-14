import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getCurrentISTDate, getCurrentISTTime12 } from "@/lib/timeUtils";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    let query = `
      SELECT a.*, u.name as employee_name, u.role as employee_role, u.email as employee_email 
      FROM attendance a 
      JOIN users u ON a.user_id = u.id
      WHERE u.role != 'CEO'
    `;
    let params: any[] = [];

    if (role === "Developer" || role === "Tester") {
      query += " AND a.user_id = ?";
      params = [userId];
    }

    query += " ORDER BY a.date DESC, a.id DESC LIMIT 60";

    const [rows] = await pool.query(query, params);

    return NextResponse.json({
      attendance: rows,
      currentDate: getCurrentISTDate(),
      currentTime: getCurrentISTTime12(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
