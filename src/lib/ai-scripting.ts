export interface EmployeeData {
  id?: number;
  name: string;
  role: string;
  email: string;
  phone?: string;
  monthly_salary?: number;
  total_leaves_allowed?: number;
  totalTasks?: number;
  completedTasks?: number;
  efficiency?: number;
  is_active?: boolean;
}

export interface IntentResult {
  matched: boolean;
  intent: string;
  redirectUrl: string;
  speechSummary: string;
  displayText: string;
  highlightKey?: string;
  employeeData?: EmployeeData;
}

export async function resolveIntentAsync(query: string, role: string): Promise<IntentResult> {
  const q = query.toLowerCase().trim();

  // Check if query is asking for specific employee data
  const isEmployeeDataQuery = 
    q.includes("data of") || 
    q.includes("tell me about") || 
    q.includes("tell me data") || 
    q.includes("info of") || 
    q.includes("details of") || 
    q.includes("report of") || 
    q.includes("report for") || 
    q.includes("salary of") || 
    q.includes("profile of") || 
    q.includes("who is");

  if (isEmployeeDataQuery) {
    let targetName = q
      .replace(/tell me data of|tell me about employee|tell me about|data of employee|data of|info of employee|info of|details of employee|details of|report of employee|report for employee|report for|salary of employee|salary of|profile of employee|profile of|who is employee|who is/g, "")
      .replace(/employee|staff|dev|developer|manager|pm|qa|user/g, "")
      .trim();

    if (targetName.length >= 2 && typeof window !== "undefined") {
      try {
        const res = await fetch("/api/employees");
        if (res.ok) {
          const data = await res.json();
          const employeesList = Array.isArray(data) ? data : (data.employees || []);

          // Match by name or email or role
          const emp = employeesList.find((e: any) => 
            e.name?.toLowerCase().includes(targetName) ||
            e.email?.toLowerCase().includes(targetName) ||
            e.role?.toLowerCase() === targetName
          );

          if (emp) {
            const salaryFormatted = emp.monthly_salary ? `₹${Number(emp.monthly_salary).toLocaleString("en-IN")}` : "Not Disclosed";
            const tasksInfo = (emp.totalTasks !== undefined && emp.totalTasks > 0)
              ? `${emp.completedTasks || 0} of ${emp.totalTasks} tasks completed (${emp.efficiency || 0}% efficiency)`
              : "No tasks assigned currently";

            const speech = `Executive Brief for ${emp.name}: Role is ${emp.role}. Monthly Salary is ${salaryFormatted}. Task Progress: ${tasksInfo}. Status: ${emp.is_active !== false ? "Active Employee" : "Inactive"}.`;
            const display = `Executive Summary for ${emp.name}: Role: ${emp.role} | Salary: ${salaryFormatted} | Tasks: ${emp.completedTasks || 0}/${emp.totalTasks || 0} (${emp.efficiency || 0}% efficiency).`;

            return {
              matched: true,
              intent: "employee_data",
              redirectUrl: `/dashboard/employees?highlight=${encodeURIComponent(emp.name)}`,
              speechSummary: speech,
              displayText: display,
              highlightKey: emp.name,
              employeeData: {
                id: emp.id,
                name: emp.name,
                role: emp.role,
                email: emp.email,
                phone: emp.phone || "N/A",
                monthly_salary: emp.monthly_salary,
                total_leaves_allowed: emp.total_leaves_allowed,
                totalTasks: emp.totalTasks,
                completedTasks: emp.completedTasks,
                efficiency: emp.efficiency,
                is_active: emp.is_active !== false
              }
            };
          } else {
            return {
              matched: true,
              intent: "employee_not_found",
              redirectUrl: `/dashboard/employees?highlight=${encodeURIComponent(targetName)}`,
              speechSummary: `I searched the system records for ${targetName}, but no matching employee record was found. Redirecting to the Employee Directory.`,
              displayText: `No employee matching "${targetName}" found in system records. Opening Employee Directory...`,
              highlightKey: targetName
            };
          }
        }
      } catch (err) {
        console.error("Error fetching employee data for voice assistant:", err);
      }
    }
  }

  // Fallback to static intent resolution
  return resolveIntent(query, role);
}

export function resolveIntent(query: string, role: string): IntentResult {
  const q = query.toLowerCase().trim();
  if (!q) {
    return {
      matched: false,
      intent: "empty",
      redirectUrl: "",
      speechSummary: "Please state your command or query.",
      displayText: "Please enter or speak a query."
    };
  }

  // Helper to extract specific target search terms
  const extractSearchTerm = (text: string, triggers: string[]) => {
    let cleaned = text;
    triggers.forEach((trig) => {
      cleaned = cleaned.replace(trig, "");
    });
    return cleaned.replace(/for|for project|project|key|keys|task|tasks|show|open|employee|dev|page|screen|view|list/g, "").trim();
  };

  // 1. Productivity Analytics
  if (
    q.includes("analytics") || 
    q.includes("productivity") || 
    q.includes("metrics") || 
    q.includes("kpi") || 
    q.includes("performance report") || 
    q.includes("developer efficiency")
  ) {
    return {
      matched: true,
      intent: "analytics",
      redirectUrl: "/dashboard/analytics",
      speechSummary: "Opening Executive Productivity Analytics dashboard.",
      displayText: "Redirecting to Productivity Analytics..."
    };
  }

  // 2. Employees & Team Management
  if (
    q.includes("employee") || 
    q.includes("staff") || 
    q.includes("team member") || 
    q.includes("user management") || 
    q.includes("developer list") || 
    q.includes("who works here") || 
    q.includes("staff directory")
  ) {
    const term = extractSearchTerm(q, ["employee", "employees", "staff", "team member", "user management", "developer list"]);
    const highlightQuery = term ? `?highlight=${encodeURIComponent(term)}` : "";
    return {
      matched: true,
      intent: "employees",
      redirectUrl: `/dashboard/employees${highlightQuery}`,
      speechSummary: term ? `Opening Employee records for ${term}.` : "Opening Employees and Team Management.",
      displayText: term ? `Redirecting to Employees (Highlighting "${term}")...` : "Redirecting to Employees...",
      highlightKey: term
    };
  }

  // 3. Testing Queue & QA Status
  if (
    q.includes("testing") || 
    q.includes("qa") || 
    q.includes("bug") || 
    q.includes("test sheet") || 
    q.includes("ready for testing") ||
    q.includes("test case") ||
    q.includes("qa status") ||
    q.includes("verification")
  ) {
    const term = extractSearchTerm(q, ["testing queue", "qa queue", "testing", "qa", "ready for testing", "bug reports", "test sheet"]);
    const highlightQuery = term ? `?highlight=${encodeURIComponent(term)}` : "";
    return {
      matched: true,
      intent: "testing_queue",
      redirectUrl: `/dashboard/testing${highlightQuery}`,
      speechSummary: term 
        ? `Opening QA Verification for ${term}.`
        : "Opening QA Verification and Testing Queue.",
      displayText: term 
        ? `Redirecting to QA Queue (Highlighting "${term}")...`
        : "Redirecting to QA Verification & Testing Queue...",
      highlightKey: term
    };
  }

  // 4. 3rd-Party Credentials & API Keys
  if (
    q.includes("3rd party") || 
    q.includes("third party") || 
    q.includes("cloudinary") || 
    q.includes("whatsapp") || 
    q.includes("stripe") || 
    q.includes("firebase") || 
    q.includes("aws") || 
    q.includes("openai") || 
    q.includes("database cred") ||
    q.includes("env import") ||
    q.includes("api key") ||
    q.includes("api secret")
  ) {
    const term = extractSearchTerm(q, ["3rd party", "third party", "credentials", "api key", "secret", "keys"]);
    const highlightQuery = term ? `?highlight=${encodeURIComponent(term)}` : "";
    return {
      matched: true,
      intent: "third_party_credentials",
      redirectUrl: `/dashboard/third-party-credentials${highlightQuery}`,
      speechSummary: term 
        ? `Opening 3rd-Party Credentials for ${term}.`
        : "Opening 3rd-Party Services and API Credentials vault.",
      displayText: term 
        ? `Redirecting to 3rd-Party Credentials (Highlighting "${term}")...`
        : "Redirecting to 3rd-Party Credentials Vault...",
      highlightKey: term
    };
  }

  // 5. Account Credentials & Passwords
  if (
    q.includes("credential") || 
    q.includes("password") || 
    q.includes("login cred") || 
    q.includes("project password") ||
    q.includes("server login") ||
    q.includes("access keys")
  ) {
    const term = extractSearchTerm(q, ["credential", "credentials", "password", "api key", "secret", "login"]);
    const highlightQuery = term ? `?highlight=${encodeURIComponent(term)}` : "";
    return {
      matched: true,
      intent: "credentials",
      redirectUrl: `/dashboard/credentials${highlightQuery}`,
      speechSummary: term 
        ? `Opening Account Credentials for ${term}.`
        : "Navigating to Project Credentials vault.",
      displayText: term 
        ? `Redirecting to Credentials (Highlighting "${term}")...`
        : "Redirecting to Project Credentials Vault...",
      highlightKey: term
    };
  }

  // 6. Projects & Team Assignments
  if (
    q.includes("project") || 
    q.includes("active project") || 
    q.includes("client project") ||
    q.includes("assigned project") ||
    q.includes("project board") ||
    q.includes("new project")
  ) {
    const term = extractSearchTerm(q, ["active project", "client project", "project", "projects"]);
    const highlightQuery = term ? `?highlight=${encodeURIComponent(term)}` : "";
    return {
      matched: true,
      intent: "projects",
      redirectUrl: `/dashboard/projects${highlightQuery}`,
      speechSummary: term ? `Opening Project ${term}.` : "Opening Projects overview board.",
      displayText: term ? `Redirecting to Projects (Highlighting "${term}")...` : "Redirecting to Projects...",
      highlightKey: term
    };
  }

  // 7. Daily Tasks & Developer Board
  if (
    q.includes("daily task") || 
    q.includes("task board") || 
    q.includes("developer task") || 
    q.includes("todo") ||
    q.includes("in progress task") ||
    q.includes("my tasks") ||
    q.includes("tasks")
  ) {
    return {
      matched: true,
      intent: "daily_tasks",
      redirectUrl: "/dashboard/tasks",
      speechSummary: "Opening Daily Tasks board.",
      displayText: "Redirecting to Daily Tasks..."
    };
  }

  // 8. Shift Warnings & Tardiness
  if (
    q.includes("shift warning") || 
    q.includes("warning") || 
    q.includes("late arrival") || 
    q.includes("tardy") ||
    q.includes("shift breach") ||
    q.includes("who was late")
  ) {
    return {
      matched: true,
      intent: "shift_warnings",
      redirectUrl: "/dashboard/warnings",
      speechSummary: "Opening Shift Warnings and tardiness monitoring.",
      displayText: "Redirecting to Shift Warnings..."
    };
  }

  // 9. Attendance & Daily Check-in
  if (
    q.includes("attendance") || 
    q.includes("present") || 
    q.includes("absent") || 
    q.includes("check in") ||
    q.includes("check out") ||
    q.includes("time log") ||
    q.includes("who is present")
  ) {
    return {
      matched: true,
      intent: "attendance",
      redirectUrl: "/dashboard/attendance",
      speechSummary: "Opening Employee Attendance records.",
      displayText: "Redirecting to Attendance Dashboard..."
    };
  }

  // 10. Salary Payout & Payroll Status
  if (
    q.includes("salary") || 
    q.includes("payout") || 
    q.includes("payroll") ||
    q.includes("pay slip") ||
    q.includes("compensation")
  ) {
    return {
      matched: true,
      intent: "payroll",
      redirectUrl: "/dashboard/payroll",
      speechSummary: "Opening Salary Payout Status report.",
      displayText: "Redirecting to Salary Payout Status..."
    };
  }

  // 11. Work Accomplishments & Logged Work
  if (
    q.includes("accomplishment") || 
    q.includes("work log") || 
    q.includes("work history") ||
    q.includes("completed work") ||
    q.includes("logged work")
  ) {
    return {
      matched: true,
      intent: "work_accomplishments",
      redirectUrl: "/dashboard/work",
      speechSummary: "Opening Work Accomplishments history.",
      displayText: "Redirecting to Work Accomplishments..."
    };
  }

  // 12. Document Vault
  if (
    q.includes("document") || 
    q.includes("vault") || 
    q.includes("file storage") ||
    q.includes("contracts") ||
    q.includes("uploaded files")
  ) {
    return {
      matched: true,
      intent: "documents",
      redirectUrl: "/dashboard/documents",
      speechSummary: "Opening Document Vault.",
      displayText: "Redirecting to Document Vault..."
    };
  }

  // 13. Company Policies
  if (
    q.includes("policy") || 
    q.includes("policies") || 
    q.includes("rules") || 
    q.includes("handbook") ||
    q.includes("company policy") ||
    q.includes("leave policy")
  ) {
    return {
      matched: true,
      intent: "policies",
      redirectUrl: "/dashboard/policies",
      speechSummary: "Opening Company Policies.",
      displayText: "Redirecting to Company Policies..."
    };
  }

  // 14. Email & Cron Logs
  if (
    q.includes("cron") || 
    q.includes("email log") || 
    q.includes("mail log") || 
    q.includes("system logs") ||
    q.includes("audit logs") ||
    q.includes("server logs")
  ) {
    return {
      matched: true,
      intent: "cron_logs",
      redirectUrl: "/dashboard/cron-logs",
      speechSummary: "Opening Email and Cron Server Logs.",
      displayText: "Redirecting to Email & Cron Logs..."
    };
  }

  // 15. Profile & Tenure
  if (
    q.includes("profile") || 
    q.includes("tenure") || 
    q.includes("my account") ||
    q.includes("my profile") ||
    q.includes("account settings")
  ) {
    return {
      matched: true,
      intent: "profile",
      redirectUrl: "/dashboard/profile",
      speechSummary: "Opening Profile and Tenure dashboard.",
      displayText: "Redirecting to Profile & Tenure..."
    };
  }

  // 16. Executive Home Dashboard
  if (
    q.includes("home") || 
    q.includes("dashboard") || 
    q.includes("overview") || 
    q.includes("brief") ||
    q.includes("main page") ||
    q.includes("system status")
  ) {
    return {
      matched: true,
      intent: "dashboard",
      redirectUrl: "/dashboard",
      speechSummary: "Opening Executive Dashboard overview.",
      displayText: "Redirecting to Dashboard..."
    };
  }

  // Fallback for unknown intent
  return {
    matched: false,
    intent: "unknown",
    redirectUrl: "",
    speechSummary: "I didn't recognize that command. Try asking about employee data, testing queue, credentials, attendance, or analytics.",
    displayText: "Unrecognized query. Try: \"tell me data of Alex\", \"show testing queue\", \"3rd party credentials\", \"attendance\""
  };
}


