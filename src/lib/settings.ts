import pool from "@/lib/db";

let cachedFullDayHours: number | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // Cache for 10 seconds for performance

/**
 * Ensures system_settings table exists and default values are populated.
 */
export async function ensureSettingsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Insert default full_day_hours = 9 if not present
    await pool.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value) 
      VALUES ('full_day_hours', '9'), ('total_leaves_allowed', '2')
    `);
  } catch (err) {
    console.error("Failed to ensure system_settings table:", err);
  }
}

/**
 * Retrieves the configured full-day working hours requirement (e.g., 9 or 8).
 * Defaults to 9.0 hours.
 */
export async function getFullDayHours(): Promise<number> {
  const now = Date.now();
  if (cachedFullDayHours !== null && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedFullDayHours;
  }

  try {
    await ensureSettingsTable();
    const [rows]: any = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'full_day_hours' LIMIT 1"
    );

    if (rows && rows.length > 0) {
      const val = parseFloat(rows[0].setting_value);
      if (!isNaN(val) && val > 0) {
        cachedFullDayHours = val;
        lastCacheTime = now;
        return val;
      }
    }
  } catch (err) {
    console.error("Error fetching full_day_hours setting:", err);
  }

  cachedFullDayHours = 9.0;
  lastCacheTime = now;
  return 9.0;
}

/**
 * Updates the configured full-day working hours requirement.
 */
export async function setFullDayHours(hours: number): Promise<boolean> {
  if (isNaN(hours) || hours <= 0 || hours > 24) {
    throw new Error("Invalid hours value. Must be between 1 and 24 hours.");
  }

  await ensureSettingsTable();
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value) 
     VALUES ('full_day_hours', ?) 
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [hours.toString()]
  );

  cachedFullDayHours = hours;
  lastCacheTime = Date.now();
  return true;
}

let cachedTotalLeaves: number | null = null;
let lastTotalLeavesCacheTime = 0;

export async function getTotalLeavesAllowed(): Promise<number> {
  const now = Date.now();
  if (cachedTotalLeaves !== null && now - lastTotalLeavesCacheTime < CACHE_TTL_MS) {
    return cachedTotalLeaves;
  }

  try {
    await ensureSettingsTable();
    const [rows]: any = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'total_leaves_allowed' LIMIT 1"
    );

    if (rows && rows.length > 0) {
      const val = parseInt(rows[0].setting_value, 10);
      if (!isNaN(val) && val >= 0) {
        cachedTotalLeaves = val;
        lastTotalLeavesCacheTime = now;
        return val;
      }
    }
  } catch (err) {
    console.error("Error fetching total_leaves_allowed setting:", err);
  }

  cachedTotalLeaves = 2;
  lastTotalLeavesCacheTime = now;
  return 2;
}

export async function getAllPolicies() {
  await ensureSettingsTable();
  const [rows]: any = await pool.query("SELECT setting_key, setting_value FROM system_settings");
  
  const settingsMap: Record<string, string> = {};
  rows.forEach((r: any) => {
    settingsMap[r.setting_key] = r.setting_value;
  });

  const fullDayHours = parseFloat(settingsMap["full_day_hours"] || "9");
  const halfDayMinHours = parseFloat(settingsMap["half_day_min_hours"] || (fullDayHours / 2).toString());
  const totalLeavesAllowed = parseInt(settingsMap["total_leaves_allowed"] || "2", 10);
  const halfDaysForOneLeave = parseInt(settingsMap["half_days_for_one_leave"] || "3", 10);
  const carryForwardLeaves = settingsMap["carry_forward_leaves"] !== "0";
  const carryForwardHalfDays = settingsMap["carry_forward_half_days"] !== "0";
  const carryForwardResetMonth = parseInt(settingsMap["carry_forward_reset_month"] || "1", 10); // 1 = January
  const payrollCalculationBasis = settingsMap["payroll_calculation_basis"] || "calendar_days"; // calendar_days vs working_days

  const policyRulesText = settingsMap["policy_rules_text"] || `1. Shift Working Hours: A standard full-day shift requires ${fullDayHours} hours of active work.
2. Absent Threshold: If an employee logs out before completing half of the shift (< ${halfDayMinHours} hours), it will be automatically recorded as a FULL DAY ABSENT.
3. Half Day Policy: Working between ${halfDayMinHours} hours and ${fullDayHours} hours will be recorded as a HALF DAY.
4. Monthly Paid Leaves: Every staff employee has an assigned monthly paid quota (e.g. 1 or 2 days/month).
5. Leave Carry Forward: Unused paid leaves roll over month-to-month until Year-End (Dec 31st), resetting on Jan 1st.
6. Half Days Ratio: Every ${halfDaysForOneLeave} half days count as 1 full day paid leave deduction. If paid quota is 0, converts to 1 Unpaid Leave (LWP).
7. Holidays & Weekly Offs: Sundays (weekly offs) and company holidays scheduled by Management are not deducted as paid leaves.
8. Salary Deduction: Unpaid leaves (LWP) are deducted from monthly salary based on daily rate (Base Salary / Total Month Days).`;

  return {
    full_day_hours: isNaN(fullDayHours) ? 9 : fullDayHours,
    half_day_min_hours: isNaN(halfDayMinHours) ? 4.5 : halfDayMinHours,
    total_leaves_allowed: isNaN(totalLeavesAllowed) ? 2 : totalLeavesAllowed,
    half_days_for_one_leave: isNaN(halfDaysForOneLeave) ? 3 : halfDaysForOneLeave,
    carry_forward_leaves: carryForwardLeaves,
    carry_forward_half_days: carryForwardHalfDays,
    carry_forward_reset_month: carryForwardResetMonth,
    payroll_calculation_basis: payrollCalculationBasis,
    policy_rules_text: policyRulesText,
  };
}

export async function updatePolicies(updates: {
  full_day_hours?: number;
  half_day_min_hours?: number;
  total_leaves_allowed?: number;
  half_days_for_one_leave?: number;
  carry_forward_leaves?: boolean;
  carry_forward_half_days?: boolean;
  carry_forward_reset_month?: number;
  payroll_calculation_basis?: string;
  policy_rules_text?: string;
}) {
  await ensureSettingsTable();

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      let strVal = typeof value === "boolean" ? (value ? "1" : "0") : value.toString();
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, strVal]
      );
    }
  }

  // Clear cache
  cachedFullDayHours = null;
  cachedTotalLeaves = null;
  return getAllPolicies();
}
