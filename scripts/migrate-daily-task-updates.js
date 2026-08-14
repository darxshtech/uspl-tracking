const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Running migration for Daily Tasks progress, hours, and blocker remarks...');

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN progress_percentage INT DEFAULT 0');
    console.log('Added progress_percentage column.');
  } catch (e) {
    console.log('progress_percentage:', e.message);
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN hours_spent DECIMAL(5,2) DEFAULT 0');
    console.log('Added hours_spent column.');
  } catch (e) {
    console.log('hours_spent:', e.message);
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN blockers TEXT NULL');
    console.log('Added blockers column.');
  } catch (e) {
    console.log('blockers:', e.message);
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN daily_summary TEXT NULL');
    console.log('Added daily_summary column.');
  } catch (e) {
    console.log('daily_summary:', e.message);
  }

  console.log('Migration complete!');
  await connection.end();
}

migrate().catch(console.error);
