const mysql = require('mysql2/promise');

async function createHolidaysTable() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Creating holidays table...');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      date DATE NOT NULL UNIQUE,
      description TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  console.log('✓ holidays table created');

  // Insert standard upcoming initial public holidays
  const defaultHolidays = [
    ['Independence Day', '2026-08-15', 'National Holiday - 79th Independence Day of India'],
    ['Ganesh Chaturthi', '2026-09-14', 'Festival Holiday'],
    ['Gandhi Jayanti', '2026-10-02', 'National Holiday - Birthday of Mahatma Gandhi'],
    ['Dussehra (Vijayadashami)', '2026-10-20', 'Festival Holiday'],
    ['Diwali (Deepavali)', '2026-11-08', 'Festival of Lights'],
    ['Christmas Day', '2026-12-25', 'Christmas Celebration'],
    ['New Year Day', '2027-01-01', 'New Year Celebration'],
    ['Republic Day', '2027-01-26', 'National Holiday - Republic Day of India']
  ];

  for (const [name, date, desc] of defaultHolidays) {
    await connection.query(
      'INSERT IGNORE INTO holidays (name, date, description) VALUES (?, ?, ?)',
      [name, date, desc]
    );
  }

  console.log('✓ Initial 2026-2027 holidays seeded');
  await connection.end();
}

createHolidaysTable().catch(console.error);
