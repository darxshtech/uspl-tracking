const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS daily_work (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      project_id INT NULL,
      task_id INT NULL,
      date DATE NOT NULL,
      hours_worked DECIMAL(5,2) DEFAULT 0.00,
      work_description TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'Completed',
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id),
      INDEX (project_id),
      INDEX (task_id),
      INDEX (date)
    )
  `);

  console.log('✓ daily_work table verified and ready in live DB');
  await conn.end();
}

init().catch(console.error);
