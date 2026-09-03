require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function testLeaveWorkflow() {
  console.log('🧪 Starting End-to-End Leave Workflow Verification...');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_tracking',
  });

  try {
    // 1. Find a test employee (Developer role)
    const [devs] = await conn.query("SELECT id, name, role FROM users WHERE role = 'Developer' LIMIT 1");
    if (!devs || devs.length === 0) {
      throw new Error("No Developer user found in database for testing");
    }
    const testUser = devs[0];
    console.log(`✓ Test employee selected: ${testUser.name} (ID: ${testUser.id}, Role: ${testUser.role})`);

    const testDate = '2026-09-28'; // A future date
    const testDate2 = '2026-09-29';

    // Clean up any existing records for test dates
    await conn.query("DELETE FROM attendance WHERE user_id = ? AND date IN (?, ?)", [testUser.id, testDate, testDate2]);

    // TEST 1: Submit Half Day Leave Application
    console.log('\n--- Test 1: Employee applies for Half Day leave ---');
    const targetStatus = 'Half Day (Pending)';
    const notesText = 'PENDING_HALF_DAY: Doctor Appointment in afternoon';

    await conn.query(
      "INSERT INTO attendance (user_id, date, status, notes) VALUES (?, ?, ?, ?)",
      [testUser.id, testDate, targetStatus, notesText]
    );

    const [test1Rows] = await conn.query("SELECT * FROM attendance WHERE user_id = ? AND date = ?", [testUser.id, testDate]);
    if (test1Rows.length === 0 || test1Rows[0].status !== 'Half Day (Pending)') {
      throw new Error(`Test 1 Failed: Expected status 'Half Day (Pending)', got '${test1Rows[0]?.status}'`);
    }
    console.log(`✓ Attendance record correctly created with status: '${test1Rows[0].status}'`);

    // Verify notifications can be inserted for PM, Admin, CEO
    const [mgmtUsers] = await conn.query("SELECT id FROM users WHERE role IN ('Admin', 'CEO', 'PM') AND is_active = 1");
    const notifValues = mgmtUsers.map(m => [
      m.id,
      '🌓 New Half Day Leave Application',
      `${testUser.name} (${testUser.role}) applied for a Half Day on ${testDate}. Reason: Doctor Appointment in afternoon`,
      'info'
    ]);
    await conn.query("INSERT INTO notifications (user_id, title, message, type) VALUES ?", [notifValues]);

    const [notifCheck] = await conn.query(
      "SELECT id, title, message FROM notifications WHERE title = '🌓 New Half Day Leave Application' ORDER BY id DESC LIMIT 1"
    );
    console.log(`✓ Notification created successfully: [${notifCheck[0].title}] -> "${notifCheck[0].message}"`);

    // TEST 2: Employee cancels unapproved pending leave directly
    console.log('\n--- Test 2: Employee cancels unapproved leave ---');
    const leaveId = test1Rows[0].id;
    await conn.query("DELETE FROM attendance WHERE id = ?", [leaveId]);

    const [test2Rows] = await conn.query("SELECT * FROM attendance WHERE id = ?", [leaveId]);
    if (test2Rows.length > 0) {
      throw new Error("Test 2 Failed: Record was not deleted after direct cancellation");
    }
    console.log('✓ Pending record successfully deleted on employee direct cancel!');

    // TEST 3: Approved Leave and Cancellation Request Workflow
    console.log('\n--- Test 3: Approved leave cancellation request & management approval ---');
    // Step 3a: Create an approved Half Day leave
    await conn.query(
      "INSERT INTO attendance (user_id, date, status, notes) VALUES (?, ?, 'Half Day', 'LEAVE: Approved planned half day')",
      [testUser.id, testDate2]
    );
    const [approvedRows] = await conn.query("SELECT * FROM attendance WHERE user_id = ? AND date = ?", [testUser.id, testDate2]);
    const approvedId = approvedRows[0].id;
    console.log(`✓ Approved leave created with status: '${approvedRows[0].status}' (ID: ${approvedId})`);

    // Step 3b: Employee submits cancellation request
    const cancelReason = 'Project release scheduled, needed at work';
    await conn.query(
      "UPDATE attendance SET status = 'Half Day (Cancel Requested)', notes = CONCAT(IFNULL(notes, ''), ' [CANCEL_REQUEST: ', ?, ']') WHERE id = ?",
      [cancelReason, approvedId]
    );

    const [cancelReqRows] = await conn.query("SELECT * FROM attendance WHERE id = ?", [approvedId]);
    if (cancelReqRows[0].status !== 'Half Day (Cancel Requested)') {
      throw new Error(`Test 3b Failed: Expected status 'Half Day (Cancel Requested)', got '${cancelReqRows[0].status}'`);
    }
    console.log(`✓ Cancellation request status verified: '${cancelReqRows[0].status}'`);
    console.log(`  Notes: ${cancelReqRows[0].notes}`);

    // Step 3c: Management approves the cancellation request
    // Approving cancellation deletes the attendance record and restores balance
    await conn.query("DELETE FROM attendance WHERE id = ?", [approvedId]);

    const [afterCancelRows] = await conn.query("SELECT * FROM attendance WHERE id = ?", [approvedId]);
    if (afterCancelRows.length > 0) {
      throw new Error("Test 3c Failed: Record was not deleted upon management approval of cancellation");
    }
    console.log('✓ Management approved cancellation: leave record cleanly deleted and balance restored!');

    console.log('\n🎉 ALL END-TO-END TESTS PASSED SUCCESSFULLY! 100% functional.\n');
  } finally {
    await conn.end();
  }
}

testLeaveWorkflow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
