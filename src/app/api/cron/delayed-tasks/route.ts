import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { logCronExecution } from "@/lib/cronLogger";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface DelayedTask {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress_percentage: number;
  hours_spent: number | string | null;
  start_date: string | null;
  expected_date: string | null;
  target_date: string | null;
  days_overdue: number;
  blockers: string | null;
  daily_summary: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  assignee_email: string | null;
  project_id: number | null;
  project_name: string | null;
  pm_id: number | null;
  pm_name: string;
  pm_email: string;
  pm_role: string;
}

// Ensure tracking table exists
async function ensureDelayedAlertsTableExists() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_delayed_alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        pm_id INT DEFAULT NULL,
        pm_email VARCHAR(255) NOT NULL,
        days_overdue INT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('sent', 'failed', 'simulated') DEFAULT 'sent',
        KEY idx_task_sent (task_id, sent_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err: any) {
    console.error("[DelayedTasksCron] Error creating task_delayed_alerts table:", err.message);
  }
}

// Build modern HTML email for the PM
function buildDelayedTasksEmailHtml(
  pmName: string,
  tasks: DelayedTask[],
  dashboardBaseUrl: string
): string {
  const taskCount = tasks.length;
  const criticalCount = tasks.filter((t) => t.days_overdue >= 5 || t.priority === "Urgent" || t.priority === "High").length;

  const taskCardsHtml = tasks
    .map((task, idx) => {
      const expDateStr = task.expected_date
        ? new Date(task.expected_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : task.target_date
        ? new Date(task.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "N/A";

      const startDateStr = task.start_date
        ? new Date(task.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "N/A";

      const priorityColor =
        task.priority === "Urgent"
          ? "#ef4444"
          : task.priority === "High"
          ? "#f97316"
          : task.priority === "Medium"
          ? "#3b82f6"
          : "#64748b";

      const taskLink = `${dashboardBaseUrl}/dashboard/tasks?search=${encodeURIComponent(task.title)}`;

      return `
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header Row -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
            <div>
              <span style="display: inline-block; background-color: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                🚨 ${task.days_overdue} Days Overdue
              </span>
              <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                #${task.id} - ${task.title}
              </h3>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500;">
                Project: <strong style="color: #334155;">${task.project_name || "General"}</strong> &bull; Priority: <span style="color: ${priorityColor}; font-weight: 700;">${task.priority || "Normal"}</span>
              </p>
            </div>
            <div style="text-align: right; min-width: 90px;">
              <span style="display: inline-block; background-color: #f1f5f9; color: #334155; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px;">
                ${task.status || "In Progress"}
              </span>
            </div>
          </div>

          <!-- Key Metrics Grid -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 40%;"><strong>Assigned Developer:</strong></td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">
                ${task.assignee_name || "Unassigned"} (${task.assignee_email || "No Email"})
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Schedule:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">
                Started: <strong>${startDateStr}</strong> &rarr; Expected: <strong style="color: #dc2626;">${expDateStr}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Progress:</strong></td>
              <td style="padding: 6px 0;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="flex-grow: 1; background-color: #e2e8f0; border-radius: 999px; height: 8px; overflow: hidden; width: 120px; display: inline-block;">
                    <div style="background-color: ${task.progress_percentage >= 50 ? "#f59e0b" : "#ef4444"}; width: ${task.progress_percentage}%; height: 100%;"></div>
                  </div>
                  <strong style="color: #0f172a; margin-left: 8px;">${task.progress_percentage}%</strong>
                  ${parseFloat(String(task.hours_spent || "0")) > 0 ? `<span style="color: #64748b; font-size: 11px;">(${task.hours_spent} hrs logged)</span>` : ""}
                </div>
              </td>
            </tr>
          </table>

          <!-- Why Work is Stuck (Blockers / Reasons) Callout -->
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
              ⚠️ Why Work is Stuck (Developer Notes &amp; Blockers):
            </div>
            <p style="margin: 0; font-size: 13px; color: #78350f; font-style: ${task.blockers ? "normal" : "italic"}; line-height: 1.4;">
              ${task.blockers ? task.blockers : "No specific blocker reported by developer yet. Immediate follow-up required."}
            </p>
          </div>

          ${
            task.daily_summary
              ? `
            <div style="font-size: 11px; color: #64748b; margin-bottom: 12px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px dashed #cbd5e1;">
              <strong>Latest Daily Work Summary:</strong> ${task.daily_summary}
            </div>
          `
              : ""
          }

          <!-- Direct CTA Link -->
          <div style="text-align: right; margin-top: 10px;">
            <a href="${taskLink}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 7px 14px; border-radius: 6px;">
              Inspect Task in Dashboard &rarr;
            </a>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Delayed Tasks Escalation Alert</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 32px 28px; text-align: left; color: #ffffff;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="background-color: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em;">
              Action Required &bull; PM Escalation
            </span>
          </div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">
            ⚠️ Tasks Delayed by &ge; 2 Days Alert
          </h1>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #c7d2fe; line-height: 1.5;">
            Automated monitoring detected tasks assigned by you or within your managed projects that have passed their expected completion date by 2+ days and remain incomplete.
          </p>
        </div>

        <!-- Body Content -->
        <div style="padding: 28px;">
          <!-- Salutation & Context -->
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.5;">
            Hello <strong>${pmName}</strong>,
          </p>
          <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b; line-height: 1.6;">
            The following <strong>${taskCount} task${taskCount > 1 ? "s are" : " is"} currently delayed</strong> beyond their committed expected dates. Please review the developer blockers, assess why work is stuck, and provide guidance to unblock delivery.
          </p>

          <!-- KPI Summary Box -->
          <div style="margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: separate; border-spacing: 8px;">
              <tr>
                <td style="width: 50%; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; text-align: center;">
                  <div style="font-size: 24px; font-weight: 800; color: #b91c1c;">${taskCount}</div>
                  <div style="font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase; margin-top: 2px;">Delayed Tasks (&ge; 2 Days)</div>
                </td>
                <td style="width: 50%; background-color: #fff7ed; border: 1px solid #ffedd5; border-radius: 10px; padding: 14px; text-align: center;">
                  <div style="font-size: 24px; font-weight: 800; color: #c2410c;">${criticalCount}</div>
                  <div style="font-size: 11px; font-weight: 700; color: #9a3412; text-transform: uppercase; margin-top: 2px;">High Priority / Critical Overdue</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Section Title -->
          <h2 style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 14px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
            Delayed Tasks &amp; Blockers Detail
          </h2>

          <!-- Task Cards -->
          ${taskCardsHtml}

          <!-- PM Guidance Recommendation -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-top: 20px; font-size: 12px; color: #475569; line-height: 1.5;">
            <strong style="color: #1e293b;">💡 Recommended PM Actions:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Contact the assigned developer to clarify blockers (credentials, design ambiguity, 3rd party API issues).</li>
              <li>Reallocate task resources or adjust expected delivery dates if scope has expanded.</li>
              <li>Encourage the developer to log their progress and daily summary via the Task Timer Check-in.</li>
            </ul>
          </div>

          <!-- Master Action Button -->
          <div style="text-align: center; margin-top: 24px;">
            <a href="${dashboardBaseUrl}/dashboard/tasks" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);">
              Open All Tasks in Project Tracking &rarr;
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #64748b;">
            Unitglo Employee Tracking &bull; Automated Task Escalation Cron System
          </p>
          <p style="margin: 0;">
            This email was automatically generated because one or more tasks assigned by you or under your project exceed their expected date by 2+ days.
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
}

// Core execution handler for delayed tasks cron
async function runDelayedTasksEscalation(options: {
  dryRun?: boolean;
  testEmail?: string | null;
  force?: boolean;
  triggerSource: string;
}) {
  const startTime = Date.now();
  await ensureDelayedAlertsTableExists();

  const dashboardBaseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Query tasks delayed by at least 2 days after expected date
  // Incomplete statuses: NOT in ('Completed', 'Ready for Demo')
  const [tasks]: any = await pool.query(`
    SELECT t.id, t.title, t.description, t.status, t.priority,
           t.progress_percentage, t.hours_spent, t.start_date, t.expected_date, t.target_date,
           DATEDIFF(CURRENT_DATE(), IFNULL(t.expected_date, t.target_date)) as days_overdue,
           t.blockers, t.daily_summary,
           u_assignee.id as assignee_id, u_assignee.name as assignee_name, u_assignee.email as assignee_email,
           t.created_by as task_creator_id, u_tcreator.name as task_creator_name, u_tcreator.email as task_creator_email, u_tcreator.role as task_creator_role,
           p.id as project_id, p.name as project_name, p.created_by as project_pm_id,
           u_ppm.name as project_pm_name, u_ppm.email as project_pm_email, u_ppm.role as project_pm_role
    FROM tasks t
    LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
    LEFT JOIN users u_tcreator ON t.created_by = u_tcreator.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u_ppm ON p.created_by = u_ppm.id
    WHERE t.status NOT IN ('Completed', 'Ready for Demo')
      AND DATEDIFF(CURRENT_DATE(), IFNULL(t.expected_date, t.target_date)) >= 2
    ORDER BY days_overdue DESC, t.priority DESC
  `);

  if (!tasks || tasks.length === 0) {
    const duration = Date.now() - startTime;
    await logCronExecution({
      job_type: "delayed_tasks_pm_alert",
      status: "skipped",
      trigger_source: options.triggerSource,
      target_period: new Date().toDateString(),
      recipients_count: 0,
      success_count: 0,
      failed_count: 0,
      details: { message: "No tasks found delayed by 2 or more days." },
      execution_time_ms: duration,
    });

    return {
      success: true,
      message: "No delayed tasks found (>= 2 days overdue).",
      delayedTasksCount: 0,
      emailsSent: 0,
      executionDurationMs: duration,
    };
  }

  // Check which tasks were already alerted today to prevent spam (unless force=true or testEmail is used)
  let alreadyAlertedTaskIds: Set<number> = new Set();
  if (!options.force && !options.testEmail) {
    try {
      const [recentAlerts]: any = await pool.query(
        "SELECT task_id FROM task_delayed_alerts WHERE DATE(sent_at) = CURRENT_DATE()"
      );
      alreadyAlertedTaskIds = new Set((recentAlerts || []).map((r: any) => r.task_id));
    } catch (checkErr) {
      console.error("[DelayedTasksCron] Error checking task_delayed_alerts:", checkErr);
    }
  }

  // Resolve PM and group tasks by PM Email
  const pmGroups: Map<string, { pmName: string; pmId: number | null; pmRole: string; tasks: DelayedTask[] }> = new Map();

  for (const t of tasks) {
    // If already alerted today and not forced, skip this task
    if (alreadyAlertedTaskIds.has(t.id)) {
      continue;
    }

    // Determine PM who assigned the task or manages the project
    let targetPmEmail: string = "";
    let targetPmName: string = "";
    let targetPmId: number | null = null;
    let targetPmRole: string = "";

    if (t.task_creator_role === "PM" && t.task_creator_email) {
      targetPmEmail = t.task_creator_email;
      targetPmName = t.task_creator_name || "Project Manager";
      targetPmId = t.task_creator_id;
      targetPmRole = "PM";
    } else if (t.project_pm_email && (t.project_pm_role === "PM" || t.project_pm_role === "Admin" || t.project_pm_role === "CEO")) {
      targetPmEmail = t.project_pm_email;
      targetPmName = t.project_pm_name || "Project Manager";
      targetPmId = t.project_pm_id;
      targetPmRole = t.project_pm_role;
    } else if (t.task_creator_email && ["Admin", "CEO"].includes(t.task_creator_role)) {
      targetPmEmail = t.task_creator_email;
      targetPmName = t.task_creator_name || "Management";
      targetPmId = t.task_creator_id;
      targetPmRole = t.task_creator_role;
    } else if (t.project_pm_email) {
      targetPmEmail = t.project_pm_email;
      targetPmName = t.project_pm_name || "Project Manager";
      targetPmId = t.project_pm_id;
      targetPmRole = t.project_pm_role || "PM";
    }

    // If still no PM email, fallback to first active PM in users table
    if (!targetPmEmail) {
      const [fallbackPm]: any = await pool.query(
        "SELECT id, name, email, role FROM users WHERE role = 'PM' LIMIT 1"
      );
      if (fallbackPm && fallbackPm.length > 0) {
        targetPmEmail = fallbackPm[0].email;
        targetPmName = fallbackPm[0].name;
        targetPmId = fallbackPm[0].id;
        targetPmRole = fallbackPm[0].role;
      } else {
        // Fallback to Admin
        targetPmEmail = "admin@unitglo.com";
        targetPmName = "Admin Office";
        targetPmRole = "Admin";
      }
    }

    const taskObj: DelayedTask = {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      progress_percentage: t.progress_percentage || 0,
      hours_spent: t.hours_spent,
      start_date: t.start_date,
      expected_date: t.expected_date,
      target_date: t.target_date,
      days_overdue: t.days_overdue,
      blockers: t.blockers,
      daily_summary: t.daily_summary,
      assignee_id: t.assignee_id,
      assignee_name: t.assignee_name,
      assignee_email: t.assignee_email,
      project_id: t.project_id,
      project_name: t.project_name,
      pm_id: targetPmId,
      pm_name: targetPmName,
      pm_email: targetPmEmail,
      pm_role: targetPmRole,
    };

    if (!pmGroups.has(targetPmEmail)) {
      pmGroups.set(targetPmEmail, {
        pmName: targetPmName,
        pmId: targetPmId,
        pmRole: targetPmRole,
        tasks: [],
      });
    }

    pmGroups.get(targetPmEmail)!.tasks.push(taskObj);
  }

  // If all delayed tasks were already alerted today
  const totalTasksToAlert = Array.from(pmGroups.values()).reduce((sum, g) => sum + g.tasks.length, 0);
  if (totalTasksToAlert === 0) {
    const duration = Date.now() - startTime;
    return {
      success: true,
      message: "All delayed tasks (>= 2 days overdue) have already been alerted today.",
      delayedTasksFound: tasks.length,
      alreadyAlertedToday: alreadyAlertedTaskIds.size,
      emailsSent: 0,
      executionDurationMs: duration,
    };
  }

  const dispatchResults: Array<{
    pmEmail: string;
    pmName: string;
    tasksCount: number;
    success: boolean;
    error?: string;
    simulated?: boolean;
  }> = [];

  for (const [pmEmail, group] of pmGroups.entries()) {
    const destinationEmail = options.testEmail ? options.testEmail : pmEmail;
    const taskCount = group.tasks.length;
    const subject = `🚨 [Task Escalation] ${taskCount} Task${taskCount > 1 ? "s" : ""} Delayed by &ge; 2 Days Alert - Why work is stuck`;
    const emailHtml = buildDelayedTasksEmailHtml(group.pmName, group.tasks, dashboardBaseUrl);

    if (options.dryRun) {
      dispatchResults.push({
        pmEmail: destinationEmail,
        pmName: group.pmName,
        tasksCount: taskCount,
        success: true,
        simulated: true,
      });
      continue;
    }

    try {
      const emailResult = await sendEmail({
        to: destinationEmail,
        subject,
        html: emailHtml,
      });

      dispatchResults.push({
        pmEmail: destinationEmail,
        pmName: group.pmName,
        tasksCount: taskCount,
        success: emailResult.success,
        error: emailResult.error,
        simulated: emailResult.simulated,
      });

      // If email succeeded or simulated, record in task_delayed_alerts and create internal notification
      if (emailResult.success) {
        for (const taskItem of group.tasks) {
          try {
            await pool.query(
              `INSERT INTO task_delayed_alerts (task_id, pm_id, pm_email, days_overdue, status) VALUES (?, ?, ?, ?, ?)`,
              [taskItem.id, group.pmId, pmEmail, taskItem.days_overdue, emailResult.simulated ? "simulated" : "sent"]
            );
          } catch (insertErr) {
            console.error("[DelayedTasksCron] Error recording alert row:", insertErr);
          }
        }

        // Create internal notification for PM
        try {
          await pool.query(
            `INSERT INTO notifications (user_id, target_role, title, message, type) VALUES (?, ?, ?, ?, 'urgent')`,
            [
              group.pmId || null,
              group.pmRole || "PM",
              `🚨 Delayed Tasks Alert: ${taskCount} Task(s) Overdue by &ge; 2 Days`,
              `${taskCount} task(s) assigned by you or under your projects are delayed past expected dates. Check blockers and follow up with developers.`
            ]
          );
        } catch (notifErr) {
          console.error("[DelayedTasksCron] Error creating PM notification:", notifErr);
        }
      }
    } catch (sendErr: any) {
      console.error(`[DelayedTasksCron] Failed sending to ${destinationEmail}:`, sendErr);
      dispatchResults.push({
        pmEmail: destinationEmail,
        pmName: group.pmName,
        tasksCount: taskCount,
        success: false,
        error: sendErr.message,
      });
    }
  }

  const duration = Date.now() - startTime;
  const emailsSent = dispatchResults.filter((r) => r.success).length;
  const emailsFailed = dispatchResults.filter((r) => !r.success).length;

  await logCronExecution({
    job_type: "delayed_tasks_pm_alert",
    status: emailsFailed > 0 && emailsSent === 0 ? "failed" : emailsFailed > 0 ? "partial" : "success",
    trigger_source: options.triggerSource,
    target_period: new Date().toDateString(),
    recipients_count: pmGroups.size,
    success_count: emailsSent,
    failed_count: emailsFailed,
    details: {
      delayedTasksTotal: tasks.length,
      tasksAlerted: totalTasksToAlert,
      pmGroups: Array.from(pmGroups.entries()).map(([email, g]) => ({
        email,
        pmName: g.pmName,
        taskIds: g.tasks.map((t) => t.id),
      })),
      dispatchResults,
    },
    execution_time_ms: duration,
  });

  return {
    success: emailsFailed === 0 || emailsSent > 0,
    message: `Processed delayed tasks escalation. Sent ${emailsSent} alert email(s) across ${totalTasksToAlert} delayed task(s).`,
    delayedTasksFound: tasks.length,
    tasksAlerted: totalTasksToAlert,
    pmEmailsDispatched: emailsSent,
    emailsFailed,
    dispatchResults,
    executionDurationMs: duration,
  };
}

// GET: Supports Vercel Cron schedule, testing, and manual query
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const force = url.searchParams.get("force") === "true";
  const testEmail = url.searchParams.get("test_email");

  // Authorization: CRON_SECRET or authenticated Manager (Admin, CEO, PM)
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const isManagerSession = session && ["Admin", "CEO", "PM"].includes(userRole);

  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET || "unitglo_tracking_cron_secret_2026";
  const isAuthorizedSecret =
    authHeader === `Bearer ${expectedSecret}` ||
    (!!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`);

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
    const result = await runDelayedTasksEscalation({
      dryRun,
      testEmail,
      force,
      triggerSource,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Delayed Tasks Cron Route Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: For manual dashboard execution by PM, CEO, or Admin
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;

  if (!session || !["Admin", "CEO", "PM"].includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { dry_run, test_email, force } = body;
    const result = await runDelayedTasksEscalation({
      dryRun: Boolean(dry_run),
      testEmail: test_email || null,
      force: Boolean(force),
      triggerSource: `manual_${userRole.toLowerCase()}`,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Delayed Tasks Cron POST Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
