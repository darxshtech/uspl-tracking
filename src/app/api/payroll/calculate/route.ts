import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getAllPolicies } from "@/lib/settings";

// Helper to get total days in a month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// GET /api/payroll/calculate?month=08&year=2026
// Computes monthly salary payout recommendation (Full Salary vs Deduct X Days) without storing/displaying currency amounts
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: "Unauthorized: PM, CEO or Admin role required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const todayIST = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });
    const [currYear, currMonth] = todayIST.split("-");

    const monthParam = searchParams.get("month") || currMonth;
    const yearParam = searchParams.get("year") || currYear;
    const monthNum = parseInt(monthParam, 10);
    const yearNum = parseInt(yearParam, 10);

    const monthFormatted = String(monthParam).padStart(2, "0");
    const monthPrefix = `${yearParam}-${monthFormatted}-`;
    const monthYearKey = `${yearParam}-${monthFormatted}`;

    const totalDaysInMonth = getDaysInMonth(yearNum, monthNum);
    const policies = await getAllPolicies();
    const halfDaysRatio = policies.half_days_for_one_leave || 3;

    // Fetch staff users (Exclude Admin and CEO)
    const [users]: any = await pool.query(`
      SELECT id, name, email, role, total_leaves_allowed, leaves_carried_forward, is_active
      FROM users 
      WHERE role NOT IN ('Admin', 'CEO') AND is_active = 1
      ORDER BY role ASC, name ASC
    `);

    // Fetch attendance records for the month
    const [attendanceRows]: any = await pool.query(
      `SELECT id, user_id, date, status, total_hours 
       FROM attendance 
       WHERE date LIKE ?`,
      [`${monthPrefix}%`]
    );

    // Fetch payroll waivers / overrides for this month
    const [waiverRows]: any = await pool.query(
      `SELECT user_id, waive_deduction, notes, updated_by 
       FROM payroll_waivers 
       WHERE month_year = ?`,
      [monthYearKey]
    );
    const waiverMap = new Map<number, any>();
    waiverRows.forEach((w: any) => {
      waiverMap.set(w.user_id, w);
    });

    let fullSalaryCount = 0;
    let deductionPendingCount = 0;
    let waivedCount = 0;
    let totalCompanyLWPDays = 0;

    const payrollList = users.map((user: any) => {
      const userRecords = attendanceRows.filter((r: any) => r.user_id === user.id);
      const monthlyQuota = user.total_leaves_allowed !== null ? Number(user.total_leaves_allowed) : policies.total_leaves_allowed;
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

      // Half days deduction (e.g. 3:1)
      const halfDaysDeducted = Math.floor(halfDaysCount / halfDaysRatio);
      const leftoverHalfDays = halfDaysCount % halfDaysRatio;
      const totalPaidLeavesDeducted = paidLeavesCount + halfDaysDeducted;
      const remainingPaidBalance = Math.max(0, Number((availableQuota - totalPaidLeavesDeducted).toFixed(2)));

      // Excess paid leaves/half-days beyond available quota converts to LWP
      const excessLWPFromQuota = Math.max(0, totalPaidLeavesDeducted - availableQuota);
      const totalLWPDays = Number((unpaidLeavesCount + excessLWPFromQuota).toFixed(1));

      // Check for waiver
      const waiver = waiverMap.get(user.id);
      const isWaived = waiver?.waive_deduction === 1 || waiver?.waive_deduction === true;

      // Payout Decision
      let payoutDecision: "PAY_FULL" | "DEDUCT_SALARY" = "PAY_FULL";
      let deductionDays = 0;
      let payoutLabel = "Pay Full Salary (100%)";

      if (totalLWPDays > 0) {
        if (isWaived) {
          payoutDecision = "PAY_FULL";
          deductionDays = 0;
          payoutLabel = `Pay Full Salary (Waived off ${totalLWPDays}d LWP)`;
          waivedCount += 1;
          fullSalaryCount += 1;
        } else {
          payoutDecision = "DEDUCT_SALARY";
          deductionDays = totalLWPDays;
          payoutLabel = `Deduct ${totalLWPDays} Day${totalLWPDays === 1 ? "" : "s"} Salary`;
          deductionPendingCount += 1;
        }
      } else {
        payoutDecision = "PAY_FULL";
        deductionDays = 0;
        payoutLabel = "Pay Full Salary (100%)";
        fullSalaryCount += 1;
      }

      totalCompanyLWPDays += totalLWPDays;

      return {
        user_id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        total_days_in_month: totalDaysInMonth,
        presents_count: presentsCount,
        holidays_count: holidaysCount,
        paid_leaves_taken: paidLeavesCount,
        half_days_taken: halfDaysCount,
        half_days_deducted: halfDaysDeducted,
        leftover_half_days: leftoverHalfDays,
        monthly_quota: monthlyQuota,
        carried_forward: carriedForward,
        remaining_paid_balance: remainingPaidBalance,
        total_lwp_days: totalLWPDays,
        deduction_days: deductionDays,
        payout_decision: payoutDecision,
        payout_label: payoutLabel,
        is_waived: isWaived,
        notes: waiver?.notes || "",
        updated_by: waiver?.updated_by || null,
      };
    });

    return NextResponse.json({
      success: true,
      month_year: monthYearKey,
      month: monthFormatted,
      year: yearParam,
      total_days_in_month: totalDaysInMonth,
      summary: {
        total_employees: users.length,
        full_salary_count: fullSalaryCount,
        deduction_pending_count: deductionPendingCount,
        waived_count: waivedCount,
        total_lwp_days: totalCompanyLWPDays,
      },
      payroll: payrollList,
    });
  } catch (error: any) {
    console.error("Error computing payroll payout status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/payroll/calculate
// Save salary deduction waiver toggle
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["Admin", "CEO", "PM"].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: "Unauthorized: PM, CEO or Admin role required" }, { status: 403 });
  }

  const managerName = (session.user as any)?.name || (session.user as any)?.role || "Management";

  try {
    const body = await req.json();
    const { user_id, month_year, waive_deduction, notes } = body;

    if (!user_id || !month_year) {
      return NextResponse.json({ error: "user_id and month_year are required" }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO payroll_waivers (user_id, month_year, waive_deduction, notes, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         waive_deduction = VALUES(waive_deduction),
         notes = VALUES(notes),
         updated_by = VALUES(updated_by)`,
      [
        user_id,
        month_year,
        waive_deduction ? 1 : 0,
        notes || null,
        managerName,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Salary deduction status updated successfully.",
    });
  } catch (error: any) {
    console.error("Error saving salary waiver:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
