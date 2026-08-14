const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Running migration for project creators and developer task links...');

  try {
    await connection.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS created_by INT NULL,
      ADD CONSTRAINT fk_projects_created_by FOREIGN KEY IF NOT EXISTS (created_by) REFERENCES users(id) ON DELETE SET NULL;
    `);
    console.log('Projects table updated with created_by.');
  } catch (err) {
    // If syntax for IF NOT EXISTS constraint fails on older MySQL, try standard column add
    try {
      await connection.query('ALTER TABLE projects ADD COLUMN created_by INT NULL');
      console.log('Projects column created_by added.');
    } catch (e) {
      console.log('created_by column already exists or handled:', e.message);
    }
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN task_link TEXT NULL');
    console.log('Tasks column task_link added.');
  } catch (e) {
    console.log('task_link column already exists or handled:', e.message);
  }

  try {
    await connection.query('ALTER TABLE tasks ADD COLUMN target_date DATE NULL');
    console.log('Tasks column target_date added.');
  } catch (e) {
    console.log('target_date column already exists or handled:', e.message);
  }

  console.log('Database migration complete!');
  await connection.end();
}

migrate().catch(console.error);
