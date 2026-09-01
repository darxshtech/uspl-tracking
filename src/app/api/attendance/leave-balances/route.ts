import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getAllPolicies } from "@/lib/settings";

// GET /api/attendance/leave-balances?month=08&year=2026
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any)?.role;
  const currentUserId = (session.user as any)?.id;
  const isManager = ["Admin", "CEO", "PM"].includes(userRole);

  try {
    const { searchParams } = new URL(req.url);
    const todayIST = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });
    const [currYear, currMonth] = todayIST.split("-");

    const monthParam = searchParams.get("month") || currMonth;
    const yearParam = searchParams.get("year") || currYear;
    const monthFormatted = String(monthParam).padStart(2, "0");
    const monthPrefix = `${yearParam}-${monthFormatted}-`;

    const policies = await getAllPolicies();
    const halfDaysRatio = policies.half_days_for_one_leave || 3;

    // Filter staff users (Exclude Admin and CEO)
    let userQuery = `
      SELECT id, name, email, role, total_leaves_allowed, leaves_carried_forward, monthly_salary, is_active
      FROM users 
      WHERE role NOT IN ('Admin', 'CEO') AND is_active = 1
      ORDER BY role ASC, name ASC
    `;
    let queryParams: any[] = [];

    // Non-managers only see their own leave balance
    if (!isManager) {
      userQuery = `
        SELECT id, name, email, role, total_leaves_allowed, leaves_carried_forward, monthly_salary, is_active
        FROM users 
        WHERE id = ? AND is_active = 1
      `;
      queryParams = [currentUserId];
    }

    const [users]: any = await pool.query(userQuery, queryParams);

    // Fetch attendance for the requested month
    const [attendanceRows]: any = await pool.query(
      `SELECT id, user_id, date, status, total_hours, notes 
       FROM attendance 
       WHERE date LIKE ?`,
      [`${monthPrefix}%`]
    );

    const ledger = users.map((user: any) => {
      const userRecords = attendanceRows.filter((r: any) => r.user_id === user.id);

      const monthlyQuota = user.total_leaves_allowed !== null && user.total_leaves_allowed !== undefined
        ? Number(user.total_leaves_allowed)
        : policies.total_leaves_allowed;

      const carriedForward = parseFloat(user.leaves_carried_forward || "0");
      const availableQuota = Number((monthlyQuota + carriedForward).toFixed(2));

      let paidLeavesCount = 0;
      let unpaidLeavesCount = 0;
      let halfDaysCount = 0;
      let presentsCount = 0;
      let holidaysCount = 0;

      userRecords.forEach((rec: any) => {
        const st = rec.status || "";
        if (st === "Paid Leave" || st === "Leave") {
          paidLeavesCount += 1;
        } else if (st === "Unpaid Leave" || st === "Leave (Rejected)" || st === "Absent") {
          unpaidLeavesCount += 1;
        } else if (st === "Half Day") {
          halfDaysCount += 1;
        } else if (st === "Present" || st === "Present (Overtime)") {
          presentsCount += 1;
        } else if (st === "Holiday") {
          holidaysCount += 1;
        }
      });

      // 3:1 Rule: Each N half-days = 1 full paid leave deducted
      const halfDaysDeducted = Math.floor(halfDaysCount / halfDaysRatio);
      const leftoverHalfDays = halfDaysCount % halfDaysRatio;

      const totalPaidLeavesDeducted = paidLeavesCount + halfDaysDeducted;
      const remainingPaidBalance = Math.max(0, Number((availableQuota - totalPaidLeavesDeducted).toFixed(2)));

      // If paid leaves + half-day deductions exceeded available quota, excess is counted as LWP
      const excessLWPFromQuota = Math.max(0, totalPaidLeavesDeducted - availableQuota);
      const totalUnpaidLWP = unpaidLeavesCount + excessLWPFromQuota;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        monthly_quota: monthlyQuota,
        carried_forward: carriedForward,
        available_quota: availableQuota,
        paid_leaves_taken: paidLeavesCount,
        half_days_taken: halfDaysCount,
        half_days_deducted: halfDaysDeducted,
        leftover_half_days: leftoverHalfDays,
        total_paid_leaves_deducted: totalPaidLeavesDeducted,
        remaining_paid_balance: remainingPaidBalance,
        unpaid_leaves_taken: totalUnpaidLWP,
        presents_count: presentsCount,
        holidays_count: holidaysCount,
        monthly_salary: parseFloat(user.monthly_salary || "0"),
      };
    });

    return NextResponse.json({
      success: true,
      month: monthFormatted,
      year: yearParam,
      monthPrefix,
      halfDaysRatio,
      policies,
      ledger,
    });
  } catch (error: any) {
    console.error("Error calculating leave balances:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/attendance/leave-balances
// Batch-update employee opening quotas and carry forward balances
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: "Unauthorized: Management role required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { updates } = body; // Array of { id, monthly_quota, leaves_carried_forward, monthly_salary }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    for (const item of updates) {
      if (!item.id) continue;
      
      const fields: string[] = [];
      const values: any[] = [];

      if (item.monthly_quota !== undefined) {
        fields.push("total_leaves_allowed = ?");
        values.push(item.monthly_quota);
      }
      if (item.leaves_carried_forward !== undefined) {
        fields.push("leaves_carried_forward = ?");
        values.push(item.leaves_carried_forward);
      }
      if (item.monthly_salary !== undefined) {
        fields.push("monthly_salary = ?");
        values.push(item.monthly_salary);
      }

      if (fields.length > 0) {
        values.push(item.id);
        await pool.query(
          `UPDATE users SET ${fields.join(", ")} WHERE id = ? AND role NOT IN ('Admin', 'CEO')`,
          values
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated opening leave balances for ${updates.length} employee(s).`,
    });
  } catch (error: any) {
    console.error("Error updating opening leave balances:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
