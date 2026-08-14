const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'employee_tracking',
    port: 3306
  });

  try {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().split(' ')[0];

    // Clean up old attendance for tester (user_id=4) today
    await pool.query('DELETE FROM attendance WHERE user_id = 4 AND date = ?', [today]);
    console.log('[1] Cleaned old attendance for tester today');

    // Simulate check-in
    await pool.query(
      'INSERT INTO attendance (user_id, date, status, login_time) VALUES (4, ?, ?, ?)',
      [today, 'Present', nowTime]
    );
    console.log('[2] Check-in recorded at', nowTime);

    // Simulate immediate check-out (< 9 hours = Half Day)
    const totalHours = 0.01;
    await pool.query(
      'UPDATE attendance SET logout_time = ?, total_hours = ?, status = ? WHERE user_id = 4 AND date = ?',
      [nowTime, totalHours.toFixed(2), 'Half Day', today]
    );
    console.log('[3] Check-out recorded as Half Day');

    // Insert notification for employee (user_id=4)
    await pool.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (4, ?, ?, 'warning')",
      ['Half Day Attendance Warning (<9 Hours)', 'You checked out early after 0.0 hours. Marked as Half Day.']
    );
    console.log('[4] Employee notification inserted OK');

    // Insert CEO notification
    await pool.query(
      "INSERT INTO notifications (target_role, title, message, type) VALUES ('CEO', ?, ?, 'warning')",
      ['Half Day Alert: Sarah Tester', 'Sarah Tester checked out early after 0.0 hours. Marked as Half Day.']
    );
    console.log('[5] CEO notification inserted OK');

    // Insert PM notification
    await pool.query(
      "INSERT INTO notifications (target_role, title, message, type) VALUES ('PM', ?, ?, 'warning')",
      ['Half Day Alert: Sarah Tester', 'Sarah Tester checked out early after 0.0 hours. Marked as Half Day.']
    );
    console.log('[6] PM notification inserted OK');

    // Verify all recent notifications
    const [notifs] = await pool.query(
      'SELECT id, user_id, target_role, title, type, created_at FROM notifications ORDER BY id DESC LIMIT 5'
    );
    console.log('\n[7] Latest notifications:');
    notifs.forEach(n => {
      console.log(`   #${n.id} | role=${n.target_role || 'N/A'} | uid=${n.user_id || 'N/A'} | type=${n.type} | ${n.title}`);
    });

    // Verify attendance
    const [att] = await pool.query(
      'SELECT * FROM attendance WHERE user_id = 4 AND date = ?',
      [today]
    );
    console.log('\n[8] Attendance record:', JSON.stringify(att[0], null, 2));

    console.log('\n✅ ALL SQL QUERIES PASSED - No syntax errors!');
  } catch (e) {
    console.error('\n❌ ERROR:', e.message);
    console.error(e.sql || '');
  }

  await pool.end();
})();
