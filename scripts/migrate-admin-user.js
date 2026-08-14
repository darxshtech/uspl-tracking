const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
let adminEmail = 'admin@unitglo.com';
let adminPass = 'AdminPassword123!';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (key === 'ADMIN_EMAIL') adminEmail = val;
        if (key === 'ADMIN_PASSWORD') adminPass = val;
      }
    }
  });
}

async function migrateAdmin() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Modifying users table role ENUM to include Admin...');
  try {
    await connection.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('Admin', 'CEO', 'PM', 'Developer', 'Tester') NOT NULL
    `);
    console.log('Users role ENUM updated successfully.');
  } catch (err) {
    console.error('Error modifying role ENUM:', err.message);
  }

  const hash = await bcrypt.hash(adminPass, 10);
  const [existing] = await connection.query('SELECT * FROM users WHERE email = ?', [adminEmail]);

  if (existing.length === 0) {
    console.log(`Creating Master Admin account: ${adminEmail}`);
    await connection.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, bio, phone, joining_date)
       VALUES (?, ?, ?, 'Admin', true, 'Master System Administrator', '+91 99999 00000', '2024-01-01')`,
      ['System Administrator', adminEmail, hash]
    );
  } else {
    console.log(`Updating existing Admin account: ${adminEmail}`);
    await connection.query(
      `UPDATE users SET password_hash = ?, role = 'Admin', is_active = true WHERE email = ?`,
      [hash, adminEmail]
    );
  }

  console.log('Admin account ready!');
  await connection.end();
}

migrateAdmin().catch(console.error);
