require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
  console.log('Connecting to database for attendance status migration...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_tracking',
  });

  console.log('Altering attendance.status column to VARCHAR(50)...');
  await conn.query(`
    ALTER TABLE attendance 
    MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Present'
  `);

  console.log('✓ Successfully altered attendance.status column to VARCHAR(50)!');
  
  const [cols] = await conn.query("DESCRIBE attendance status");
  console.log('Updated column definition:', cols);

  await conn.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
