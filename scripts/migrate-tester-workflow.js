const mysql = require('mysql2/promise');

async function migrateTesterWorkflow() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Running migration for multi-links and tester check-in/out audit...');

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN task_links JSON NULL');
    console.log('Added task_links column.');
  } catch (e) {
    console.log('task_links:', e.message);
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN testing_started_at TIMESTAMP NULL');
    console.log('Added testing_started_at column.');
  } catch (e) {
    console.log('testing_started_at:', e.message);
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN testing_ended_at TIMESTAMP NULL');
    console.log('Added testing_ended_at column.');
  } catch (e) {
    console.log('testing_ended_at:', e.message);
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN issues_count INT DEFAULT 0');
    console.log('Added issues_count column.');
  } catch (e) {
    console.log('issues_count:', e.message);
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN test_sheet_link TEXT NULL');
    console.log('Added test_sheet_link column.');
  } catch (e) {
    console.log('test_sheet_link:', e.message);
  }

  console.log('Tester workflow migration complete!');
  await connection.end();
}

migrateTesterWorkflow().catch(console.error);
