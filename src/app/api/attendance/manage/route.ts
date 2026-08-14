import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { calculateHoursDifference } from "@/lib/timeUtils";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employee_id");
    const month = searchParams.get("month"); // '01' to '12'
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    let query = `
      SELECT a.*, u.name as employee_name, u.email as employee_email, u.role as employee_role
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE u.role != 'CEO'
    `;
    let params: any[] = [];

    if (employeeId && employeeId !== "ALL") {
      query += " AND a.user_id = ?";
      params.push(employeeId);
    }

    if (month && month !== "ALL") {
      query += " AND DATE_FORMAT(a.date, '%m') = ?";
      params.push(month);
    }

    if (year) {
      query += " AND DATE_FORMAT(a.date, '%Y') = ?";
      params.push(year);
    }

    query += " ORDER BY a.date DESC, u.name ASC";

    const [rows] = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["CEO", "PM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized: PM or CEO role required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, login_time, logout_time, status, total_hours: manualHours } = body;

    if (!id) {
      return NextResponse.json({ error: "Attendance record ID is required" }, { status: 400 });
    }

    // Auto-calculate total hours if both login and logout time are provided, or use override
    let finalHours = manualHours !== undefined && manualHours !== "" ? parseFloat(manualHours) : null;

    if (finalHours === null && login_time && logout_time) {
      finalHours = calculateHoursDifference(login_time, logout_time);
    }

    await pool.query(
      `UPDATE attendance 
       SET login_time = ?, logout_time = ?, status = ?, total_hours = ?
       WHERE id = ?`,
      [login_time || null, logout_time || null, status || "Present", finalHours, id]
    );

    // Get user ID and date for notification
    const [attRows]: any = await pool.query(
      "SELECT a.user_id, a.date, u.name as employee_name FROM attendance a JOIN users u ON a.user_id = u.id WHERE a.id = ?",
      [id]
    );

    if (attRows.length > 0) {
      const record = attRows[0];
      const recordDate = new Date(record.date).toLocaleDateString();

      await pool.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
        [
          record.user_id,
          "Attendance Record Updated by PM",
          `Your attendance for ${recordDate} was updated by Project Management (${status}, ${finalHours || 0} hrs).`
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Attendance updated successfully",
      total_hours: finalHours,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
