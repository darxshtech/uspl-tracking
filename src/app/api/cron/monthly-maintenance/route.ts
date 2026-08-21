import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getTotalLeavesAllowed } from "@/lib/settings";

// This endpoint should be triggered by an external cron service (like Vercel Cron or a self-hosted cron)
// on the 1st day of every month at 00:01 AM.
export async function GET(req: Request) {
  // Optional: Add a secret key check to prevent unauthorized execution
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'secret'}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const globalLeavesAllowed = await getTotalLeavesAllowed();
    
    // Determine the previous month
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonthDate.getFullYear();
    const month = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const prevMonthPrefix = `${year}-${month}-`; // e.g. '2026-07-'

    // Get all users
    const [users]: any = await pool.query("SELECT id, leaves_carried_forward, total_leaves_allowed FROM users");

    let processedCount = 0;

    for (const user of users) {
      const allowed = user.total_leaves_allowed !== null ? user.total_leaves_allowed : globalLeavesAllowed;
      const carried = user.leaves_carried_forward || 0;

      // Calculate how many leaves they took last month
      const [attendanceRows]: any = await pool.query(
        "SELECT status FROM attendance WHERE user_id = ? AND date LIKE ?",
        [user.id, `${prevMonthPrefix}%`]
      );

      let leavesTaken = 0;
      for (const row of attendanceRows) {
        if (row.status === "Leave") leavesTaken += 1;
        else if (row.status === "Half Day") leavesTaken += 0.5;
      }

      // Calculate new carry forward
      let available = allowed + carried;
      let newCarryForward = available - leavesTaken;
      
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
      message: `Monthly maintenance completed. Processed ${processedCount} users.` 
    });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
