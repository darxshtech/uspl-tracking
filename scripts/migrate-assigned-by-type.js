const mysql = require('mysql2/promise');

async function migrateAssignedByType() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Adding assigned_by_type column to tasks table...');

  try {
    await connection.query("ALTER TABLE tasks ADD COLUMN assigned_by_type VARCHAR(50) DEFAULT 'Self Tested'");
    console.log('Added assigned_by_type column.');
  } catch (e) {
    console.log('assigned_by_type:', e.message);
  }

  console.log('Migration complete!');
  await connection.end();
}

migrateAssignedByType().catch(console.error);
