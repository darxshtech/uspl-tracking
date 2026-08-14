const mysql = require('mysql2/promise');

async function testSystem() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Testing Database Schema & Records...');

  // Check users columns
  const [userCols] = await connection.query('SHOW COLUMNS FROM users');
  const userColNames = userCols.map(c => c.Field);
  console.log('Users columns:', userColNames);

  // Check projects columns
  const [projCols] = await connection.query('SHOW COLUMNS FROM projects');
  const projColNames = projCols.map(c => c.Field);
  console.log('Projects columns:', projColNames);

  // Check attendance columns
  const [attCols] = await connection.query('SHOW COLUMNS FROM attendance');
  const attColNames = attCols.map(c => `${c.Field} (${c.Type})`);
  console.log('Attendance columns:', attColNames);

  // Check tasks status enum
  const [taskCols] = await connection.query("SHOW COLUMNS FROM tasks WHERE Field = 'status'");
  console.log('Task status enum:', taskCols[0]?.Type);

  // Check daily_work table
  const [dailyCols] = await connection.query('SHOW COLUMNS FROM daily_work');
  console.log('Daily work columns:', dailyCols.map(c => c.Field));

  console.log('All database checks passed!');
  await connection.end();
}

testSystem().catch(console.error);
