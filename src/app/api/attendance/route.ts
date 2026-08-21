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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const userId = (session.user as any).id;
    const body = await req.json();
    const { action, start_date, end_date, status, reason } = body;

    if (action === "leave") {
      if (!start_date || !status) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const endDate = end_date || start_date;
      
      const start = new Date(start_date);
      const end = new Date(endDate);
      
      if (start > end) {
        return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
      }

      // Fetch scheduled holidays in this range
      const [holidayRows]: any = await pool.query(
        "SELECT DATE_FORMAT(date, '%Y-%m-%d') as hol_date FROM holidays WHERE date BETWEEN ? AND ?",
        [start_date, endDate]
      );
      const holidayDates = new Set<string>(holidayRows.map((h: any) => h.hol_date));

      // Add a pending leave record for each working day in range (exclude Sunday weekly off and holidays)
      const currentDate = new Date(start);
      let leaveDaysCount = 0;

      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getUTCDay(); // 0 is Sunday

        // Skip Sunday weekly offs and company holidays
        if (dayOfWeek === 0 || holidayDates.has(dateStr)) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        const [existing]: any = await pool.query(
          "SELECT id FROM attendance WHERE user_id = ? AND date = ?",
          [userId, dateStr]
        );

        if (existing.length > 0) {
          await pool.query(
            "UPDATE attendance SET status = 'Leave (Pending)', notes = ? WHERE id = ?",
            [`PENDING_LEAVE: ${reason || ''}`, existing[0].id]
          );
        } else {
          await pool.query(
            "INSERT INTO attendance (user_id, date, status, notes) VALUES (?, ?, 'Leave (Pending)', ?)",
            [userId, dateStr, `PENDING_LEAVE: ${reason || ''}`]
          );
        }
        
        leaveDaysCount++;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return NextResponse.json({ 
        message: `Leave request submitted for ${leaveDaysCount} working day(s) (Sundays and holidays excluded).`,
        days_counted: leaveDaysCount 
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Attendance POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
