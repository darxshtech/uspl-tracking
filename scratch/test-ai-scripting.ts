import { resolveIntent, resolveIntentAsync } from "../src/lib/ai-scripting";

// Mock fetch for testing node environment
(global as any).window = {};
(global as any).fetch = async (url: string) => {
  if (url === "/api/employees") {
    return {
      ok: true,
      json: async () => [
        {
          id: 1,
          name: "Kartik Sharma",
          email: "kartik@example.com",
          role: "Developer",
          phone: "9876543210",
          is_active: 1,
          monthly_salary: 45000,
          total_tasks: 18,
          completed_tasks: 15,
          in_progress_tasks: 3,
          completion_ratio: 83
        },
        {
          id: 2,
          name: "Chaitanya Patel",
          email: "chaitanya@example.com",
          role: "Developer",
          phone: "9123456789",
          is_active: 1,
          monthly_salary: 42000,
          total_tasks: 16,
          completed_tasks: 12,
          in_progress_tasks: 4,
          completion_ratio: 75
        },
        {
          id: 3,
          name: "Alex Morgan",
          email: "alex@example.com",
          role: "Senior Developer",
          phone: "9988776655",
          is_active: 1,
          monthly_salary: 55000,
          total_tasks: 20,
          completed_tasks: 18,
          in_progress_tasks: 2,
          completion_ratio: 90
        },
        {
          id: 4,
          name: "Sarah Lee",
          email: "sarah@example.com",
          role: "PM",
          phone: "9112233445",
          is_active: 0,
          monthly_salary: 60000,
          total_tasks: 10,
          completed_tasks: 10,
          in_progress_tasks: 0,
          completion_ratio: 100
        }
      ]
    };
  }
  if (url === "/api/attendance") {
    return {
      ok: true,
      json: async () => ({
        currentDate: "2026-09-09",
        attendance: [
          { id: 101, user_id: 1, employee_name: "Kartik Sharma", date: "2026-09-09", status: "Present", login_time: "09:30 AM" },
          { id: 102, user_id: 2, employee_name: "Chaitanya Patel", date: "2026-09-09", status: "Present", login_time: "09:45 AM" }
        ]
      })
    };
  }
  if (url === "/api/warnings") {
    return {
      ok: true,
      json: async () => ({
        warnings: [
          { id: 201, user_id: 2, employee_name: "Chaitanya Patel", reason: "Late Arrival (15 mins)" }
        ]
      })
    };
  }
  if (url === "/api/projects") {
    return {
      ok: true,
      json: async () => [
        { id: 1, title: "FarmersBag E-commerce", client_name: "FarmersBag", status: "Active", progress: 75, completed_tasks: 15, total_tasks: 20 },
        { id: 2, title: "USPL Tracking System", client_name: "USPL", status: "In Progress", progress: 90, completed_tasks: 45, total_tasks: 50 }
      ]
    };
  }
  if (url === "/api/tasks") {
    return {
      ok: true,
      json: async () => [
        { id: 10, title: "Implement Voice Assistant Card UI", assignee_name: "Kartik Sharma", status: "In Progress", priority: "High", project_name: "USPL Tracking System" },
        { id: 11, title: "Fix Notifications 500 Route", assignee_name: "Chaitanya Patel", status: "Completed", priority: "Urgent", project_name: "USPL Tracking System" }
      ]
    };
  }
  if (url === "/api/testing") {
    return {
      ok: true,
      json: async () => [
        { id: 50, title: "QA Check Voice Intent Dispatcher", project_name: "USPL Tracking", status: "Ready for QA" }
      ]
    };
  }
  if (url === "/api/credentials") {
    return {
      ok: true,
      json: async () => [
        { id: 1, name: "MySQL DB Production", environment: "Production" }
      ]
    };
  }
  if (url === "/api/third-party-credentials") {
    return {
      ok: true,
      json: async () => [
        { id: 1, name: "Stripe API Key", environment: "Live" },
        { id: 2, name: "Firebase Service Key", environment: "Production" }
      ]
    };
  }
  if (url === "/api/documents") {
    return {
      ok: true,
      json: async () => [
        { id: 1, title: "Employee Handbook 2026.pdf", category: "Policies", access_role: "All" }
      ]
    };
  }
  if (url === "/api/holidays") {
    return {
      ok: true,
      json: async () => [
        { id: 1, name: "Diwali Official Holiday", date: "2026-11-01" }
      ]
    };
  }
  if (url === "/api/cron/delayed-tasks") {
    return {
      ok: true,
      json: async () => [
        { id: 99, name: "Daily Attendance Sync Cron", status: "Success" }
      ]
    };
  }
  return { ok: false, status: 404 };
};

async function runHumanVoiceTestSuite() {
  console.log("=== COMPREHENSIVE HUMAN NATURAL SPEECH TEST SUITE ===\n");

  const humanPhrases = [
    // 1. COMPARISON HUMAN SPEECH
    { category: "Comparison", phrase: "compare kartik and chaitanya", expected: "employee_comparison" },
    { category: "Comparison", phrase: "hey can you compare productivity of alex and sarah", expected: "employee_comparison" },
    { category: "Comparison", phrase: "who is performing better between kartik and chaitanya", expected: "employee_comparison" },
    { category: "Comparison", phrase: "alex versus chaitanya comparison please", expected: "employee_comparison" },
    { category: "Comparison", phrase: "check difference in efficiency between kartik with alex", expected: "employee_comparison" },
    { category: "Comparison", phrase: "compare chaitanya with sarah", expected: "employee_comparison" },
    { category: "Comparison", phrase: "who has done more tasks alex or kartik", expected: "employee_comparison" },

    // 2. SINGLE EMPLOYEE DATA HUMAN SPEECH & STT LEVENSHTEIN PHONETIC NOISE
    { category: "Employee Data", phrase: "hey can you tell me the details for alex", expected: "employee_data" },
    { category: "Employee Data", phrase: "what is the monthly salary of kartik", expected: "employee_data" },
    { category: "Employee Data", phrase: "show me sarah's profile", expected: "employee_data" },
    { category: "Employee Data", phrase: "i want to see how chaitanya is doing", expected: "employee_data" },
    { category: "Employee Data", phrase: "who is kartik sharma", expected: "employee_data" },
    { category: "Employee Data", phrase: "how is alex performing", expected: "employee_data" },
    { category: "Employee Data", phrase: "can you give me sarah's salary", expected: "employee_data" },
    { category: "Employee Data", phrase: "what is the role of chaitanya", expected: "employee_data" },

    // STT Phonetic Levenshtein Noise Cases
    { category: "Phonetic Levenshtein STT", phrase: "compare carthick and chaitania", expected: "employee_comparison" },
    { category: "Phonetic Levenshtein STT", phrase: "tell me data of carthick", expected: "employee_data" },
    { category: "Phonetic Levenshtein STT", phrase: "show me sara's profile", expected: "employee_data" },
    { category: "Phonetic Levenshtein STT", phrase: "details for aleks", expected: "employee_data" },

    // 3. TESTING & QA QUEUE HUMAN SPEECH
    { category: "Testing Queue", phrase: "show me the testing queue", expected: "testing_queue" },
    { category: "Testing Queue", phrase: "are there any bugs ready for testing", expected: "testing_queue" },
    { category: "Testing Queue", phrase: "check qa status for car project", expected: "testing_queue" },
    { category: "Testing Queue", phrase: "what tasks are in qa right now", expected: "testing_queue" },
    { category: "Testing Queue", phrase: "is there any bug report pending", expected: "testing_queue" },

    // 4. CREDENTIALS & API KEYS HUMAN SPEECH
    { category: "Credentials", phrase: "open 3rd party credentials", expected: "third_party_credentials" },
    { category: "Credentials", phrase: "where are the cloudinary api keys", expected: "third_party_credentials" },
    { category: "Credentials", phrase: "show me stripe secrets", expected: "third_party_credentials" },
    { category: "Credentials", phrase: "get me the whatsapp api key", expected: "third_party_credentials" },
    { category: "Credentials", phrase: "where can i find firebase secrets", expected: "third_party_credentials" },
    { category: "Credentials", phrase: "open account passwords vault", expected: "credentials" },
    { category: "Credentials", phrase: "where are server passwords stored", expected: "credentials" },

    // 5. ATTENDANCE & SHIFT WARNINGS HUMAN SPEECH
    { category: "Attendance", phrase: "who is present today in the office", expected: "attendance" },
    { category: "Attendance", phrase: "show me attendance records", expected: "attendance" },
    { category: "Attendance", phrase: "who is in the office today", expected: "attendance" },
    { category: "Shift Warnings", phrase: "who was late today", expected: "shift_warnings" },
    { category: "Shift Warnings", phrase: "show shift warnings and tardiness", expected: "shift_warnings" },
    { category: "Shift Warnings", phrase: "who checked in late", expected: "shift_warnings" },

    // 6. PAYROLL, PROJECTS, TASKS & ANALYTICS HUMAN SPEECH
    { category: "Payroll", phrase: "show salary payouts for this month", expected: "payroll" },
    { category: "Payroll", phrase: "show me monthly payroll overview", expected: "payroll" },
    { category: "Projects", phrase: "open active projects board", expected: "projects" },
    { category: "Projects", phrase: "open project list", expected: "projects" },
    { category: "Daily Tasks", phrase: "what are my daily tasks for today", expected: "daily_tasks" },
    { category: "Daily Tasks", phrase: "what are my tasks for today", expected: "daily_tasks" },
    { category: "Analytics", phrase: "show productivity analytics and kpi report", expected: "analytics" },
    { category: "Analytics", phrase: "show developer productivity report", expected: "analytics" },

    // 7. DOCS, POLICIES, CRON LOGS, PROFILE & HOME
    { category: "Documents", phrase: "open document vault", expected: "documents" },
    { category: "Documents", phrase: "take me to documents", expected: "documents" },
    { category: "Policies", phrase: "show company policies and leave rules", expected: "policies" },
    { category: "Policies", phrase: "where are leave rules", expected: "policies" },
    { category: "Cron Logs", phrase: "check email and cron server logs", expected: "cron_logs" },
    { category: "Cron Logs", phrase: "show email logs", expected: "cron_logs" },
    { category: "Profile", phrase: "take me to my account profile", expected: "profile" },
    { category: "Profile", phrase: "open my settings", expected: "profile" },
    { category: "Home", phrase: "take me back to executive home dashboard", expected: "dashboard" },
    { category: "Home", phrase: "go to home", expected: "dashboard" }
  ];

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < humanPhrases.length; i++) {
    const item = humanPhrases[i];
    const num = i + 1;
    try {
      const res = await resolveIntentAsync(item.phrase, "Admin");
      const isSuccess = res.matched && (res.intent === item.expected || (item.expected === "employee_data" && res.intent === "employee_data"));

      if (isSuccess) {
        console.log(`✅ [${num}/${humanPhrases.length}] PASS (${item.category}): "${item.phrase}" -> Intent: ${res.intent}`);
        passed++;
      } else {
        console.log(`❌ [${num}/${humanPhrases.length}] FAIL (${item.category}): "${item.phrase}" -> Expected: ${item.expected}, Got: ${res.intent}`);
        console.log(`   Speech Output: "${res.speechSummary}"`);
        failed++;
      }
    } catch (err: any) {
      console.log(`💥 [${num}/${humanPhrases.length}] EXCEPTION (${item.category}): "${item.phrase}" -> ${err.message}`);
      failed++;
    }
  }

  console.log(`\n==================================================`);
  console.log(`HUMAN VOICE TEST RESULTS: ${passed}/${humanPhrases.length} PASSED (${failed} FAILED)`);
  console.log(`==================================================\n`);

  const attendanceTest = await resolveIntentAsync("who is present today in the office", "Admin");
  console.log("🔊 Live Attendance Speech Output:");
  console.log(`   "${attendanceTest.speechSummary}"\n`);

  const lateTest = await resolveIntentAsync("who checked in late", "Admin");
  console.log("🔊 Live Shift Warnings Speech Output:");
  console.log(`   "${lateTest.speechSummary}"\n`);

  // Domain Card Data Verification
  console.log("🎴 Verifying Domain Card Data Generation:");
  const projectTest = await resolveIntentAsync("open active projects board", "Admin");
  console.log(`   Projects Card Data: ${projectTest.cardData ? "✅ PRESENT (" + projectTest.cardData.title + ")" : "❌ MISSING"}`);

  const taskTest = await resolveIntentAsync("what are my daily tasks for today", "Admin");
  console.log(`   Tasks Card Data: ${taskTest.cardData ? "✅ PRESENT (" + taskTest.cardData.title + ")" : "❌ MISSING"}`);

  // Project & Employee specific task queries
  console.log("\n🎯 Verifying Project & Employee Today's Tasks Filtering:");
  const projTasksTest = await resolveIntentAsync("what are today's tasks for FarmersBag", "Admin");
  console.log(`   FarmersBag Tasks: "${projTasksTest.speechSummary}"`);

  const empTasksTest = await resolveIntentAsync("show today's tasks for Kartik", "Admin");
  console.log(`   Kartik Tasks: "${empTasksTest.speechSummary}"`);

  const breakdownProjTest = await resolveIntentAsync("show today's tasks by project", "Admin");
  console.log(`   Project Breakdown: "${breakdownProjTest.speechSummary}"`);

  const breakdownEmpTest = await resolveIntentAsync("show today's tasks by employee", "Admin");
  console.log(`   Employee Breakdown: "${breakdownEmpTest.speechSummary}"`);
}

runHumanVoiceTestSuite();
