require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Testing MySQL Database Connection...');
  console.log({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
  });

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'employee_tracking',
      connectTimeout: 10000,
    });

    console.log('✓ Successfully connected to MySQL server!');

    const [tables] = await connection.query('SHOW TABLES');
    console.log('Found tables in database:', tables.map(r => Object.values(r)[0]));

    const [userRows] = await connection.query('SELECT id, name, email, role FROM users LIMIT 5');
    console.log('Sample users count:', userRows.length);
    console.table(userRows);

    await connection.end();
    console.log('✓ DB Connection test completed successfully with 0 errors.');
  } catch (err) {
    console.error('❌ DB Connection Error:', err.message);
    process.exit(1);
  }
}

testConnection();
