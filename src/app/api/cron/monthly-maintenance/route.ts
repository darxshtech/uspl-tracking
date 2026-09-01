import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getAllPolicies } from "@/lib/settings";

// This endpoint is triggered on the 1st day of every month at 07:30 AM IST (02:00 UTC)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const isManagerSession = session && ["Admin", "CEO", "PM"].includes(userRole);

  const authHeader = req.headers.get("authorization");
  const isSecretMatch = authHeader === `Bearer ${process.env.CRON_SECRET || 'secret'}`;

  if (!isSecretMatch && !isManagerSession && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const policies = await getAllPolicies();
    const globalLeavesAllowed = policies.total_leaves_allowed;
    const halfDaysRatio = policies.half_days_for_one_leave || 3;

    // Determine current and previous month context
    const now = new Date();
    const isJanuary = now.getMonth() === 0; // Month 0 is January (Year-End Reset)

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonthDate.getFullYear();
    const month = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const prevMonthPrefix = `${year}-${month}-`; // e.g. '2026-07-'

    // Get all staff users (Exclude Admin and CEO)
    const [users]: any = await pool.query(
      "SELECT id, role, leaves_carried_forward, total_leaves_allowed FROM users WHERE role NOT IN ('Admin', 'CEO') AND is_active = 1"
    );

    let processedCount = 0;

    for (const user of users) {
      // Annual Reset Rule: On January 1st, carry forward resets to 0
      if (isJanuary) {
        await pool.query(
          "UPDATE users SET leaves_carried_forward = 0 WHERE id = ?",
          [user.id]
        );
        processedCount++;
        continue;
      }

      const allowed = user.total_leaves_allowed !== null ? Number(user.total_leaves_allowed) : globalLeavesAllowed;
      const carried = parseFloat(user.leaves_carried_forward || "0");

      // Calculate how many leaves & half-days they took last month
      const [attendanceRows]: any = await pool.query(
        "SELECT status FROM attendance WHERE user_id = ? AND date LIKE ?",
        [user.id, `${prevMonthPrefix}%`]
      );

      let fullLeavesTaken = 0;
      let halfDaysTaken = 0;

      for (const row of attendanceRows) {
        if (row.status === "Paid Leave" || row.status === "Leave") {
          fullLeavesTaken += 1;
        } else if (row.status === "Half Day") {
          halfDaysTaken += 1;
        }
      }

      // 3:1 Rule for half days
      const halfDaysDeducted = Math.floor(halfDaysTaken / halfDaysRatio);
      const totalPaidLeavesDeducted = fullLeavesTaken + halfDaysDeducted;

      // Calculate new carry forward
      let available = allowed + carried;
      let newCarryForward = Number((available - totalPaidLeavesDeducted).toFixed(2));
      
      // Prevent negative carry forward (if they took LWP)
      if (newCarryForward < 0) newCarryForward = 0;

      // Update the user
      await pool.query(
        "UPDATE users SET leaves_carried_forward = ? WHERE id = ?",
        [newCarryForward, user.id]
      );
      
      processedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      isAnnualReset: isJanuary,
      message: `Monthly maintenance completed. Processed ${processedCount} staff members.${isJanuary ? " (Annual carry-forward reset executed)" : ""}` 
    });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
