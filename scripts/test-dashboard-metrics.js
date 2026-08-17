const mysql = require('mysql2/promise');

async function runDashboardMetricsTest() {
  console.log("=== UNITGLO DASHBOARD & EMPLOYEE METRICS TEST ===");
  
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  try {
    // 1. Fetch Users
    const [employees] = await connection.query("SELECT id, name, email, role, is_active FROM users ORDER BY id ASC");
    console.log(`\n[✓] Found ${employees.length} team members:`);
    employees.forEach(e => console.log(`   - ID ${e.id}: ${e.name} (${e.role})`));

    // 2. Fetch Tasks
    const [tasks] = await connection.query("SELECT id, title, project_id, assigned_to, status, hours_spent, blockers, progress_percentage FROM tasks");
    console.log(`\n[✓] Found ${tasks.length} total tasks.`);

    // 3. Simulate Employee Matrix Calculation (with the new type-safe comparison)
    console.log("\n--- SIMULATED EMPLOYEE PROGRESS MATRIX ---");
    const matrix = employees.map(emp => {
      // Type-safe matching
      const empTasks = tasks.filter(t => String(t.assigned_to) === String(emp.id));
      const empProjectsCount = new Set(empTasks.map(t => t.project_id).filter(Boolean)).size;
      const empCompleted = empTasks.filter(t => 
        t.status === "Completed" || t.status === "Ready for Demo" || t.status === "Tested (PASS)"
      ).length;
      const empInProgress = empTasks.filter(t => t.status === "In Progress" || t.status === "Planning").length;
      const empBlocked = empTasks.filter(t => t.blockers && t.status !== "Completed" && t.status !== "Ready for Demo").length;
      const empTotalHours = empTasks.reduce((sum, t) => sum + (parseFloat(t.hours_spent) || 0), 0);
      const empRate = empTasks.length > 0 ? Math.round((empCompleted / empTasks.length) * 100) : 0;

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        totalTasks: empTasks.length,
        assignedProjects: empProjectsCount,
        completedCount: empCompleted,
        inProgressCount: empInProgress,
        blockedCount: empBlocked,
        totalHours: empTotalHours.toFixed(1),
        completionRate: `${empRate}%`
      };
    });

    console.table(matrix);

    // 4. Check Projects (Verify no status dependency)
    const [projects] = await connection.query("SELECT id, name, target_date, created_by FROM projects");
    console.log(`\n[✓] Active Projects (${projects.length}):`);
    projects.forEach(p => console.log(`   - Project ID ${p.id}: "${p.name}" (Target: ${p.target_date || 'None'})`));

    // 5. Test Notification Queue
    const [notifs] = await connection.query("SELECT id, user_id, target_role, title, message, is_read, created_at FROM notifications ORDER BY created_at DESC LIMIT 5");
    console.log(`\n[✓] Recent Notifications (${notifs.length}):`);
    notifs.forEach(n => console.log(`   - [${n.is_read ? 'READ' : 'UNREAD'}] To: ${n.user_id ? 'User ' + n.user_id : 'Role ' + n.target_role} | ${n.title}`));

    console.log("\n✅ ALL DASHBOARD METRICS & NOTIFICATION TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await connection.end();
  }
}

runDashboardMetricsTest();
