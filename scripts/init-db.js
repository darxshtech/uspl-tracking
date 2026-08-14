const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function initDb() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
  });

  await connection.query('CREATE DATABASE IF NOT EXISTS employee_tracking');
  await connection.query('USE employee_tracking');

  console.log('Database connected');

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('CEO', 'PM', 'Developer', 'Tester') NOT NULL,
      is_active BOOLEAN DEFAULT true,
      avatar_url VARCHAR(500) NULL,
      bio TEXT NULL,
      phone VARCHAR(50) NULL,
      joining_date DATE NULL DEFAULT '2024-01-15',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createProjectsTable = `
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      start_date DATE,
      target_date DATE,
      status ENUM('Planning', 'Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled') DEFAULT 'Planning',
      documentation_url TEXT NULL,
      attachments JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createProjectMembersTable = `
    CREATE TABLE IF NOT EXISTS project_members (
      project_id INT,
      user_id INT,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  const createTasksTable = `
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      project_id INT,
      created_by INT,
      assigned_to INT,
      priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
      due_date DATE,
      estimated_hours DECIMAL(5,2),
      status ENUM('Created', 'Assigned', 'Planning', 'In Progress', 'Ready for Testing', 'Testing', 'Changes Required', 'Tested (PASS)', 'Ready for Demo', 'Completed', 'Cancelled') DEFAULT 'Created',
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
    )
  `;

  const createTaskChecklistsTable = `
    CREATE TABLE IF NOT EXISTS task_checklists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      item_text VARCHAR(255) NOT NULL,
      is_completed BOOLEAN DEFAULT false,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `;

  const createDailyWorkTable = `
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
  `;

  const createAttendanceTable = `
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      date DATE NOT NULL,
      status ENUM('Present', 'Absent', 'Half Day', 'Leave') NOT NULL,
      login_time VARCHAR(30) NULL,
      logout_time VARCHAR(30) NULL,
      total_hours DECIMAL(5,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_date (user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  const createTestingRecordsTable = `
    CREATE TABLE IF NOT EXISTS testing_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      tester_id INT NOT NULL,
      test_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      result ENUM('PASS', 'FAIL') NOT NULL,
      remarks TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (tester_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  const createNotificationsTable = `
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      target_role ENUM('CEO', 'PM', 'Developer', 'Tester') NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await connection.query(createUsersTable);
  await connection.query(createProjectsTable);
  await connection.query(createProjectMembersTable);
  await connection.query(createTasksTable);
  await connection.query(createTaskChecklistsTable);
  await connection.query(createDailyWorkTable);
  await connection.query(createAttendanceTable);
  await connection.query(createTestingRecordsTable);
  await connection.query(createNotificationsTable);
  
  console.log('All tables created including notifications');

  const defaultPassword = await bcrypt.hash('password123', 10);
  
  // Seed initial role users for easy end-to-end testing
  const initialUsers = [
    ['Unitglo CEO', 'ceo@unitglo.com', defaultPassword, 'CEO'],
    ['Unitglo PM', 'pm@unitglo.com', defaultPassword, 'PM'],
    ['Alex Developer', 'dev@unitglo.com', defaultPassword, 'Developer'],
    ['Sarah Tester', 'tester@unitglo.com', defaultPassword, 'Tester']
  ];

  for (const [name, email, pwd, role] of initialUsers) {
    await connection.query(
      'INSERT IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, pwd, role]
    );
  }

  console.log('Initial accounts created for Unitglo Solutions');
  await connection.end();
}

initDb().catch(console.error);
