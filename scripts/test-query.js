const mysql = require('mysql2/promise');

async function test() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'employee_tracking'
  });

  console.log('Testing clean projects query...');
  const [projects] = await connection.query('SELECT * FROM projects ORDER BY created_at DESC');
  const [members] = await connection.query(`
    SELECT pm.project_id, u.id, u.name, u.role 
    FROM project_members pm 
    JOIN users u ON pm.user_id = u.id
  `);

  const memberMap = {};
  members.forEach(m => {
    if (!memberMap[m.project_id]) memberMap[m.project_id] = [];
    memberMap[m.project_id].push({ id: m.id, name: m.name, role: m.role });
  });

  const fullProjects = projects.map(p => ({
    ...p,
    members: memberMap[p.id] || [],
    attachments: p.attachments ? (typeof p.attachments === 'string' ? JSON.parse(p.attachments) : p.attachments) : []
  }));

  console.log('Clean projects OK! Count:', fullProjects.length);

  console.log('Testing clean tasks query...');
  const [tasks] = await connection.query(`
    SELECT t.*, 
      p.name as project_name, 
      u1.name as assignee_name, 
      u2.name as creator_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u1 ON t.assigned_to = u1.id
    LEFT JOIN users u2 ON t.created_by = u2.id
    ORDER BY t.created_at DESC
  `);

  const [checklists] = await connection.query('SELECT * FROM task_checklists');
  const checklistMap = {};
  checklists.forEach(c => {
    if (!checklistMap[c.task_id]) checklistMap[c.task_id] = [];
    checklistMap[c.task_id].push(c);
  });

  const fullTasks = tasks.map(t => ({
    ...t,
    checklists: checklistMap[t.id] || []
  }));

  console.log('Clean tasks OK! Count:', fullTasks.length);

  await connection.end();
}

test().catch(console.error);
