require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrateTaskTimer() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_tracking',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  console.log('Connecting to database and creating task_time_logs table...');

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS task_time_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        started_at DATETIME NOT NULL,
        ended_at DATETIME NULL,
        duration_minutes INT DEFAULT 0,
        session_summary TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_active_user (user_id, is_active),
        INDEX idx_task_sessions (task_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('task_time_logs table created successfully!');
  } catch (e) {
    console.error('Error creating task_time_logs table:', e.message);
  }

  await connection.end();
  console.log('Task timer migration complete!');
}

migrateTaskTimer().catch(console.error);
