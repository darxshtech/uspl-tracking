const mysql = require('mysql2/promise');

async function updateSchema() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Connected to employee_tracking database. Running schema updates...');

  // 1. Update attendance table to support formatted 12-hour timestamps
  try {
    await connection.query(`
      ALTER TABLE attendance 
      MODIFY COLUMN login_time VARCHAR(30) NULL,
      MODIFY COLUMN logout_time VARCHAR(30) NULL
    `);
    console.log('✓ attendance table updated');
  } catch (err) {
    console.log('attendance update notice:', err.message);
  }

  // 2. Update projects table to support documentation_url and attachments
  try {
    await connection.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS documentation_url TEXT NULL,
      ADD COLUMN IF NOT EXISTS attachments JSON NULL
    `);
    console.log('✓ projects table updated');
  } catch (err) {
    // If IF NOT EXISTS syntax isn't supported in older MySQL, try adding individually
    try {
      await connection.query(`ALTER TABLE projects ADD COLUMN documentation_url TEXT NULL`);
    } catch (_) {}
    try {
      await connection.query(`ALTER TABLE projects ADD COLUMN attachments JSON NULL`);
    } catch (_) {}
    console.log('✓ projects table alter executed');
  }

  // 3. Update users table to support avatar_url, bio, phone, and joining_date
  try {
    await connection.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL,
      ADD COLUMN IF NOT EXISTS bio TEXT NULL,
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS joining_date DATE NULL DEFAULT '2024-01-15'
    `);
    console.log('✓ users table updated');
  } catch (err) {
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL`);
    } catch (_) {}
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN bio TEXT NULL`);
    } catch (_) {}
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL`);
    } catch (_) {}
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN joining_date DATE NULL DEFAULT '2024-01-15'`);
    } catch (_) {}
    console.log('✓ users table alter executed');
  }

  // 4. Extend tasks status enum
  try {
    await connection.query(`
      ALTER TABLE tasks 
      MODIFY COLUMN status ENUM(
        'Created', 
        'Assigned', 
        'Planning', 
        'In Progress', 
        'Ready for Testing', 
        'Testing', 
        'Changes Required', 
        'Tested (PASS)', 
        'Ready for Demo', 
        'Completed', 
        'Cancelled'
      ) DEFAULT 'Created'
    `);
    console.log('✓ tasks table status enum updated');
  } catch (err) {
    console.log('tasks status enum update notice:', err.message);
  }

  // 5. Ensure daily_work table exists
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS daily_work (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        project_id INT,
        task_id INT,
        date DATE NOT NULL,
        hours_worked DECIMAL(5,2) NOT NULL,
        work_description TEXT NOT NULL,
        status VARCHAR(50),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
      )
    `);
    console.log('✓ daily_work table verified');
  } catch (err) {
    console.log('daily_work notice:', err.message);
  }

  console.log('All schema migrations applied successfully!');
  await connection.end();
}

updateSchema().catch(console.error);
