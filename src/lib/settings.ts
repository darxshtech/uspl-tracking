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
      VALUES ('full_day_hours', '9')
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
