const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_tracking'
  });

  console.log('Running migration to add start_date and expected_date to tasks...');

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN start_date DATE NULL DEFAULT NULL AFTER priority');
    console.log('Added start_date column.');
  } catch (e) {
    console.log('start_date column notice:', e.message);
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN expected_date DATE NULL DEFAULT NULL AFTER start_date');
    console.log('Added expected_date column.');
  } catch (e) {
    console.log('expected_date column notice:', e.message);
  }

  try {
    const [res1] = await connection.query('UPDATE tasks SET start_date = COALESCE(DATE(created_at), CURDATE()) WHERE start_date IS NULL');
    console.log('Backfilled start_date on tasks:', res1.affectedRows);
  } catch (e) {
    console.log('start_date backfill notice:', e.message);
  }

  try {
    const [res2] = await connection.query('UPDATE tasks SET expected_date = COALESCE(target_date, due_date, start_date, CURDATE()) WHERE expected_date IS NULL');
    console.log('Backfilled expected_date on tasks:', res2.affectedRows);
  } catch (e) {
    console.log('expected_date backfill notice:', e.message);
  }

  console.log('Task start_date and expected_date migration completed successfully!');
  await connection.end();
}

migrate().catch(console.error);
