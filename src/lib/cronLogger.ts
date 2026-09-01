import pool from "@/lib/db";

export interface CronLogEntry {
  job_type: "weekly_emails" | "monthly_emails" | "custom_emails" | "monthly_maintenance" | "auto" | "combined";
  status: "success" | "failed" | "partial" | "skipped";
  trigger_source?: string;
  target_period?: string;
  recipients_count?: number;
  success_count?: number;
  failed_count?: number;
  details?: any;
  error_message?: string | null;
  execution_time_ms?: number;
}

// Ensures cron_logs table exists without throwing errors
export async function ensureCronLogsTableExists() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cron_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_type VARCHAR(50) NOT NULL,
        status ENUM('success', 'failed', 'partial', 'skipped') NOT NULL DEFAULT 'success',
        trigger_source VARCHAR(50) NOT NULL DEFAULT 'vercel_cron',
        target_period VARCHAR(100) DEFAULT NULL,
        recipients_count INT DEFAULT 0,
        success_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        details JSON DEFAULT NULL,
        error_message TEXT DEFAULT NULL,
        execution_time_ms INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err: any) {
    console.error("[CronLogger] Table creation check error:", err.message);
  }
}

// Save an execution log entry to MySQL
export async function logCronExecution(entry: CronLogEntry) {
  try {
    await ensureCronLogsTableExists();

    const query = `
      INSERT INTO cron_logs (
        job_type,
        status,
        trigger_source,
        target_period,
        recipients_count,
        success_count,
        failed_count,
        details,
        error_message,
        execution_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      entry.job_type,
      entry.status,
      entry.trigger_source || "vercel_cron",
      entry.target_period || null,
      entry.recipients_count || 0,
      entry.success_count || 0,
      entry.failed_count || 0,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.error_message || null,
      entry.execution_time_ms || 0,
    ];

    const [res]: any = await pool.query(query, values);
    return res?.insertId || null;
  } catch (err: any) {
    console.error("[CronLogger] Failed to write log:", err.message);
    return null;
  }
}

// Fetch recent cron execution logs
export async function getRecentCronLogs(limit = 50) {
  try {
    await ensureCronLogsTableExists();
    const [rows]: any = await pool.query(
      "SELECT * FROM cron_logs ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
    return rows;
  } catch (err: any) {
    console.error("[CronLogger] Failed to fetch logs:", err.message);
    return [];
  }
}
