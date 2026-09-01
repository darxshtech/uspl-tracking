import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { getTotalLeavesAllowed } from "@/lib/settings";
import { logCronExecution } from "@/lib/cronLogger";

export const maxDuration = 60; // Max allowed serverless duration for Vercel functions
export const dynamic = "force-dynamic";

interface AttendanceRecord {
  id: number;
  user_id: number;
  date: string;
  login_time: string | null;
  logout_time: string | null;
  total_hours: number | string | null;
  status: string;
  notes: string | null;
}

interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  leaves_carried_forward?: number;
  total_leaves_allowed?: number;
}

// Helper to chunk arrays for controlled parallel dispatch
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Generate the responsive HTML email template
function buildAttendanceEmailHtml(
  user: UserRecord,
  type: "weekly" | "monthly" | "custom",
  startDate: Date,
  endDate: Date,
  records: AttendanceRecord[]
): string {
  let presents = 0;
  let halfDays = 0;
  let absences = 0;
  let paidLeaves = 0;
  let unpaidLeaves = 0;
  let holidays = 0;
  let totalHoursSum = 0;

  const dateOptions: Intl.DateTimeFormatOptions = { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  };
  const startStr = startDate.toLocaleDateString("en-US", dateOptions);
  const endStr = endDate.toLocaleDateString("en-US", dateOptions);
  const periodTitle = type === "monthly" 
    ? "Monthly Attendance Report" 
    : type === "weekly" 
    ? "Weekly Attendance Report" 
    : "Attendance Performance Report";
  const periodBadge = `${startStr} — ${endStr}`;

  let tableRows = "";

  records.forEach((rec) => {
    const hoursNum = parseFloat(String(rec.total_hours || "0")) || 0;
    totalHoursSum += hoursNum;

    let badgeBg = "#f1f5f9";
    let badgeColor = "#475569";

    if (rec.status === "Present" || rec.status === "Present (Overtime)") {
      presents++;
      badgeBg = "#dcfce7";
      badgeColor = "#15803d";
    } else if (rec.status === "Half Day") {
      halfDays++;
      badgeBg = "#fef3c7";
      badgeColor = "#b45309";
    } else if (rec.status === "Absent") {
      absences++;
      unpaidLeaves++;
      badgeBg = "#fee2e2";
      badgeColor = "#b91c1c";
    } else if (rec.status === "Unpaid Leave" || rec.status === "Leave (Rejected)") {
      unpaidLeaves++;
      badgeBg = "#fee2e2";
      badgeColor = "#b91c1c";
    } else if (rec.status === "Holiday") {
      holidays++;
      badgeBg = "#dbeafe";
      badgeColor = "#1d4ed8";
    } else if (rec.status === "Paid Leave" || rec.status === "Leave" || rec.status === "Leave (Pending)") {
      paidLeaves++;
      badgeBg = "#f3e8ff";
      badgeColor = "#7e22ce";
    }

    const recordDate = new Date(rec.date);
    const formattedDate = recordDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    tableRows += `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 14px; font-size: 13px; color: #1e293b; font-weight: 500;">${formattedDate}</td>
        <td style="padding: 12px 14px; font-size: 13px; color: #475569;">${rec.login_time || "—"}</td>
        <td style="padding: 12px 14px; font-size: 13px; color: #475569;">${rec.logout_time || "—"}</td>
        <td style="padding: 12px 14px; font-size: 13px; color: #0f172a; font-weight: 600;">${hoursNum > 0 ? hoursNum.toFixed(2) + " hrs" : "—"}</td>
        <td style="padding: 12px 14px; font-size: 12px;">
          <span style="background-color: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 9999px; font-weight: 600; display: inline-block;">
            ${rec.status}
          </span>
        </td>
      </tr>
    `;
  });

  // Leave calculations
  const monthlyQuota = user.total_leaves_allowed !== undefined && user.total_leaves_allowed !== null ? Number(user.total_leaves_allowed) : 2;
  const carriedForward = parseFloat(String(user.leaves_carried_forward || "0"));
  const availableQuota = Number((monthlyQuota + carriedForward).toFixed(2));
  const halfDaysDeducted = Math.floor(halfDays / 3);
  const totalPaidLeavesDeducted = paidLeaves + halfDaysDeducted;
  const remainingPaidBalance = Math.max(0, Number((availableQuota - totalPaidLeavesDeducted).toFixed(2)));
  const totalUnpaidLWP = unpaidLeaves + Math.max(0, totalPaidLeavesDeducted - availableQuota);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${periodTitle}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Top Gradient Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding: 28px 24px; color: #ffffff; text-align: left;">
      <div style="display: inline-block; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px;">
        Unitglo Tracking System
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
        ${periodTitle}
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #cbd5e1;">
        Period: <strong style="color: #ffffff;">${periodBadge}</strong>
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.5;">
        Hello <strong>${user.name}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
        Here is your official attendance and work-hours summary for the period of <strong>${periodBadge}</strong>.
      </p>

      <!-- KPI Summary Cards Grid -->
      <div style="margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: separate; border-spacing: 8px;">
          <tr>
            <td style="width: 33.33%; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 10px; text-align: center;">
              <div style="font-size: 20px; font-weight: 700; color: #15803d;">${presents}</div>
              <div style="font-size: 11px; font-weight: 600; color: #166534; text-transform: uppercase; margin-top: 2px;">Presents</div>
            </td>
            <td style="width: 33.33%; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 10px; padding: 14px 10px; text-align: center;">
              <div style="font-size: 20px; font-weight: 700; color: #a16207;">${halfDays}</div>
              <div style="font-size: 11px; font-weight: 600; color: #854d0e; text-transform: uppercase; margin-top: 2px;">Half Days</div>
            </td>
            <td style="width: 33.33%; background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 14px 10px; text-align: center;">
              <div style="font-size: 20px; font-weight: 700; color: #7e22ce;">${paidLeaves}</div>
              <div style="font-size: 11px; font-weight: 600; color: #6b21a8; text-transform: uppercase; margin-top: 2px;">Paid Leaves</div>
            </td>
          </tr>
          <tr>
            <td style="width: 33.33%; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 10px; text-align: center;">
              <div style="font-size: 20px; font-weight: 700; color: #1d4ed8;">${holidays}</div>
              <div style="font-size: 11px; font-weight: 600; color: #1e40af; text-transform: uppercase; margin-top: 2px;">Holidays</div>
            </td>
            <td style="width: 33.33%; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 10px; text-align: center;">
              <div style="font-size: 20px; font-weight: 700; color: #b91c1c;">${totalUnpaidLWP}</div>
              <div style="font-size: 11px; font-weight: 600; color: #991b1b; text-transform: uppercase; margin-top: 2px;">Unpaid (LWP)</div>
            </td>
            <td style="width: 33.33%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 10px; text-align: center;">
              <div style="font-size: 20px; font-weight: 700; color: #0f172a;">${totalHoursSum.toFixed(1)}h</div>
              <div style="font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; margin-top: 2px;">Total Hours</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Paid Leave Quota Ledger Card -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #86efac; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.04em;">
          🌴 Monthly Paid Leave Balance Summary
        </h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #1e293b;">
          <tr>
            <td style="padding: 4px 0; color: #475569;">Monthly Quota:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700;">${monthlyQuota.toFixed(1)} days</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #475569;">Carried from Previous Month:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700;">${carriedForward.toFixed(1)} days</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #475569;">Total Paid Leaves Used (incl. 3:1 half-day ratio):</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #b91c1c;">-${totalPaidLeavesDeducted.toFixed(1)} days</td>
          </tr>
          <tr style="border-top: 1px solid #bbf7d0;">
            <td style="padding: 8px 0 0 0; font-weight: 700; color: #15803d; font-size: 13px;">Remaining Balance Carried Forward:</td>
            <td style="padding: 8px 0 0 0; text-align: right; font-weight: 800; color: #15803d; font-size: 14px;">${remainingPaidBalance.toFixed(1)} days</td>
          </tr>
        </table>
      </div>

      <!-- Breakdown Table Header -->
      <h3 style="margin: 20px 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">
        Daily Breakdown
      </h3>

      <!-- Attendance Table -->
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <th style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Date</th>
              <th style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Check In</th>
              <th style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Check Out</th>
              <th style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Hours</th>
              <th style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No attendance records found for this period.</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Notice Box -->
      <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 16px; margin-top: 20px;">
        <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
          <strong>Discrepancy Notice:</strong> If you notice any missing entries or discrepancies in your attendance logs, please contact the Project Management Office or your Team Lead promptly.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">
        This is an automated notification from Unitglo Solutions Employee Tracking System.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// Monthly leave maintenance processor
async function runMonthlyLeaveMaintenance() {
  try {
    const globalLeavesAllowed = await getTotalLeavesAllowed();
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonthDate.getFullYear();
    const month = String(prevMonthDate.getMonth() + 1).padStart(2, "0");
    const prevMonthPrefix = `${year}-${month}-`;

    const [users]: any = await pool.query(
      "SELECT id, leaves_carried_forward, total_leaves_allowed FROM users WHERE is_active = 1"
    );

    let processedCount = 0;

    for (const user of users) {
      const allowed = user.total_leaves_allowed !== null ? user.total_leaves_allowed : globalLeavesAllowed;
      const carried = user.leaves_carried_forward || 0;

      const [attendanceRows]: any = await pool.query(
        "SELECT status FROM attendance WHERE user_id = ? AND date LIKE ?",
        [user.id, `${prevMonthPrefix}%`]
      );

      let leavesTaken = 0;
      for (const row of attendanceRows) {
        if (row.status === "Leave") leavesTaken += 1;
        else if (row.status === "Half Day") leavesTaken += 0.5;
      }

      let available = allowed + carried;
      let newCarryForward = available - leavesTaken;
      if (newCarryForward < 0) newCarryForward = 0;

      await pool.query(
        "UPDATE users SET leaves_carried_forward = ? WHERE id = ?",
        [newCarryForward, user.id]
      );
      processedCount++;
    }

    return { success: true, processedUsers: processedCount };
  } catch (err: any) {
    console.error("[Cron Maintenance Error]:", err);
    return { success: false, error: err.message };
  }
}

// Attendance email batch processor
async function processAttendanceEmails(
  type: "weekly" | "monthly" | "custom",
  testEmail?: string | null,
  dryRun?: boolean,
  customStart?: string | null,
  customEnd?: string | null
) {
  // Query active employees (excluding CEO and Admin)
  const [users]: any = await pool.query(
    "SELECT id, name, email, role FROM users WHERE is_active = 1 AND role NOT IN ('CEO', 'Admin')"
  );

  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let startStr: string;
  let endStr: string;

  if (customStart && customEnd) {
    startStr = customStart;
    endStr = customEnd;
    startDate = new Date(customStart + "T00:00:00");
    endDate = new Date(customEnd + "T23:59:59");
  } else if (type === "monthly") {
    // Entire preceding month
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
    startStr = startDate.toISOString().split("T")[0];
    endStr = endDate.toISOString().split("T")[0];
  } else {
    // Preceding 7 days (Monday through Sunday)
    endDate = new Date(now);
    endDate.setDate(now.getDate() - 1); // Yesterday (Sunday)
    startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6); // 7 days prior (Monday)
    startStr = startDate.toISOString().split("T")[0];
    endStr = endDate.toISOString().split("T")[0];
  }

  const [attendance]: any = await pool.query(
    "SELECT * FROM attendance WHERE date >= ? AND date <= ? ORDER BY date ASC",
    [startStr, endStr]
  );

  const targetUsers: UserRecord[] = testEmail
    ? [{ id: users[0]?.id || 1, name: "Test Employee", email: testEmail, role: "Developer" }]
    : users;

  const results = {
    total: targetUsers.length,
    sent: 0,
    failed: 0,
    simulated: 0,
    errors: [] as string[],
  };

  // Chunk users into parallel batches of 6 concurrent sends to stay fast and avoid timeouts
  const batches = chunkArray(targetUsers, 6);

  for (const batch of batches) {
    const promises = batch.map(async (user) => {
      if (!user.email) return;

      const userRecords = attendance.filter((a: any) => a.user_id === user.id);
      const emailHtml = buildAttendanceEmailHtml(user, type, startDate, endDate, userRecords);

      if (dryRun) {
        results.sent++;
        return;
      }

      const reportName = type === "monthly" ? "Monthly" : type === "weekly" ? "Weekly" : "Custom";
      const emailSubject = `[Unitglo] Your ${reportName} Attendance Report (${startStr} to ${endStr})`;

      const res = await sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
      });

      if (res.success) {
        results.sent++;
        if (res.simulated) results.simulated++;
      } else {
        results.failed++;
        results.errors.push(`Failed sending to ${user.email}: ${res.error || "Unknown SMTP error"}`);
      }
    });

    await Promise.allSettled(promises);
  }

  return {
    type,
    period: { start: startStr, end: endStr },
    results,
  };
}

// MAIN CRON ENDPOINT
export async function GET(req: Request) {
  const startTime = Date.now();
  const url = new URL(req.url);
  const typeParam = (url.searchParams.get("type") || "auto") as any;
  const testEmail = url.searchParams.get("test_email");
  const dryRun = url.searchParams.get("dry_run") === "true";
  const customStart = url.searchParams.get("start_date") || url.searchParams.get("custom_start");
  const customEnd = url.searchParams.get("end_date") || url.searchParams.get("custom_end");

  // Authorization check for production: Allow either CRON_SECRET header or authenticated manager session (Admin, CEO, PM)
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const isManagerSession = session && ["Admin", "CEO", "PM"].includes(userRole);

  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET || "unitglo_tracking_cron_secret_2026";
  const isAuthorizedSecret = authHeader === `Bearer ${expectedSecret}` || (!!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`);
  const isAuthorized = isAuthorizedSecret || isManagerSession;

  if (process.env.NODE_ENV === "production" && !isAuthorized && !testEmail && !dryRun) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const triggerSource = testEmail
    ? "test_email"
    : dryRun
    ? "dry_run"
    : isManagerSession
    ? `manual_${userRole.toLowerCase()}`
    : isAuthorizedSecret
    ? "authorized_cron_trigger"
    : "cron_schedule";

  try {
    // Current IST date context (+05:30)
    const istDateString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istNow = new Date(istDateString);
    const dayOfMonth = istNow.getDate();
    const dayOfWeek = istNow.getDay(); // 0 = Sunday, 1 = Monday

    const isFirstOfMonth = dayOfMonth === 1;
    const isMonday = dayOfWeek === 1;

    const executions: Record<string, any> = {};

    // 1. Determine execution tasks
    let executeMonthlyMaintenance = false;
    let executeMonthlyEmails = false;
    let executeWeeklyEmails = false;
    let executeCustomEmails = false;

    if (typeParam === "custom" || (customStart && customEnd && typeParam !== "monthly" && typeParam !== "weekly")) {
      executeCustomEmails = true;
    } else if (typeParam === "auto") {
      // AUTO MODE (Called daily by Vercel Cron at 02:00 UTC / 07:30 IST)
      if (isFirstOfMonth) {
        executeMonthlyMaintenance = true;
        executeMonthlyEmails = true;
      }
      if (isMonday) {
        executeWeeklyEmails = true;
      }
    } else if (typeParam === "weekly") {
      executeWeeklyEmails = true;
    } else if (typeParam === "monthly") {
      executeMonthlyMaintenance = true;
      executeMonthlyEmails = true;
    } else if (typeParam === "both") {
      executeMonthlyMaintenance = true;
      executeMonthlyEmails = true;
      executeWeeklyEmails = true;
    } else if (typeParam === "maintenance") {
      executeMonthlyMaintenance = true;
    }

    // 2. Execute monthly leave maintenance if applicable
    if (executeMonthlyMaintenance) {
      console.log("[Cron Runner] Executing monthly leave maintenance...");
      executions.maintenance = await runMonthlyLeaveMaintenance();
    }

    // 3. Execute monthly attendance emails if applicable
    if (executeMonthlyEmails) {
      console.log("[Cron Runner] Dispatching monthly attendance emails...");
      executions.monthlyEmails = await processAttendanceEmails("monthly", testEmail, dryRun);
    }

    // 4. Execute weekly attendance emails if applicable
    if (executeWeeklyEmails) {
      console.log("[Cron Runner] Dispatching weekly attendance emails...");
      executions.weeklyEmails = await processAttendanceEmails("weekly", testEmail, dryRun, customStart, customEnd);
    }

    // 5. Execute custom range attendance emails if applicable
    if (executeCustomEmails) {
      console.log(`[Cron Runner] Dispatching custom date attendance emails (${customStart} to ${customEnd})...`);
      executions.customEmails = await processAttendanceEmails("custom", testEmail, dryRun, customStart, customEnd);
    }

    const executedAny = executeMonthlyMaintenance || executeMonthlyEmails || executeWeeklyEmails || executeCustomEmails;
    const executionDuration = Date.now() - startTime;

    // Log the execution to MySQL cron_logs table
    let logStatus: "success" | "partial" | "failed" | "skipped" = "success";
    let totalSent = 0;
    let totalFailed = 0;
    let totalRecipients = 0;

    if (executions.customEmails) {
      totalRecipients += executions.customEmails.results.total;
      totalSent += executions.customEmails.results.sent;
      totalFailed += executions.customEmails.results.failed;
    }
    if (executions.monthlyEmails) {
      totalRecipients += executions.monthlyEmails.results.total;
      totalSent += executions.monthlyEmails.results.sent;
      totalFailed += executions.monthlyEmails.results.failed;
    }
    if (executions.weeklyEmails) {
      totalRecipients += executions.weeklyEmails.results.total;
      totalSent += executions.weeklyEmails.results.sent;
      totalFailed += executions.weeklyEmails.results.failed;
    }

    if (!executedAny) {
      logStatus = "skipped";
    } else if (totalFailed > 0 && totalSent > 0) {
      logStatus = "partial";
    } else if (totalFailed > 0 && totalSent === 0) {
      logStatus = "failed";
    }

    const targetPeriodStr = executions.customEmails?.period 
      ? `${executions.customEmails.period.start} to ${executions.customEmails.period.end}`
      : executions.monthlyEmails?.period 
      ? `${executions.monthlyEmails.period.start} to ${executions.monthlyEmails.period.end}` 
      : executions.weeklyEmails?.period 
      ? `${executions.weeklyEmails.period.start} to ${executions.weeklyEmails.period.end}` 
      : istNow.toDateString();

    const jobTypeStr = typeParam === "auto" 
      ? "auto" 
      : typeParam === "custom" || executeCustomEmails 
      ? "custom_emails" 
      : typeParam === "weekly" 
      ? "weekly_emails" 
      : typeParam === "monthly" 
      ? "monthly_emails" 
      : "combined";

    await logCronExecution({
      job_type: jobTypeStr,
      status: logStatus,
      trigger_source: triggerSource,
      target_period: targetPeriodStr,
      recipients_count: totalRecipients,
      success_count: totalSent,
      failed_count: totalFailed,
      details: {
        actionsTriggered: {
          maintenance: executeMonthlyMaintenance,
          monthlyEmails: executeMonthlyEmails,
          weeklyEmails: executeWeeklyEmails,
          customEmails: executeCustomEmails,
        },
        executions,
      },
      execution_time_ms: executionDuration,
    });

    return NextResponse.json({
      success: true,
      timestamp: istNow.toISOString(),
      istDate: istNow.toDateString(),
      typeExecuted: typeParam,
      actionsTriggered: {
        maintenance: executeMonthlyMaintenance,
        monthlyEmails: executeMonthlyEmails,
        weeklyEmails: executeWeeklyEmails,
        customEmails: executeCustomEmails,
      },
      message: executedAny 
        ? "Attendance email task executed and logged successfully." 
        : "Auto runner completed: No scheduled jobs needed for today.",
      executionDurationMs: executionDuration,
      details: executions,
    });
  } catch (error: any) {
    console.error("[Cron Attendance Route Error]:", error);
    const executionDuration = Date.now() - startTime;

    // Log the error to database
    await logCronExecution({
      job_type: typeParam === "auto" ? "auto" : "combined",
      status: "failed",
      trigger_source: triggerSource,
      error_message: error.message,
      execution_time_ms: executionDuration,
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
