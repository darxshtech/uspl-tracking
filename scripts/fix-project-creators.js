const mysql = require('mysql2/promise');

async function fixProjectCreators() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Finding PM and CEO users...');
  const [users] = await connection.query("SELECT id, name, email, role FROM users WHERE role IN ('CEO', 'PM')");
  console.log('Management users:', users);

  const defaultCreator = users.find(u => u.role === 'PM') || users.find(u => u.role === 'CEO') || users[0];

  if (defaultCreator) {
    console.log(`Updating NULL created_by projects to ID: ${defaultCreator.id} (${defaultCreator.name} - ${defaultCreator.role})`);
    await connection.query("UPDATE projects SET created_by = ? WHERE created_by IS NULL", [defaultCreator.id]);
  }

  const [projects] = await connection.query(`
    SELECT p.id, p.name, p.created_by, u.name as creator_name, u.role as creator_role 
    FROM projects p 
    LEFT JOIN users u ON p.created_by = u.id
  `);
  console.log('Updated Projects:', projects);

  await connection.end();
}

fixProjectCreators().catch(console.error);
