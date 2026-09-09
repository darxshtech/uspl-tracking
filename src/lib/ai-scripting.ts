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

export interface ComparativeData {
  emp1: EmployeeData;
  emp2: EmployeeData;
  leaderName?: string;
  efficiencyDiff?: number;
  tasksDiff?: number;
}

export interface IntentResult {
  matched: boolean;
  intent: string;
  redirectUrl: string;
  speechSummary: string;
  displayText: string;
  highlightKey?: string;
  employeeData?: EmployeeData;
  comparativeData?: ComparativeData;
}

function normalizeEmployeeData(emp: any): EmployeeData {
  const completed = Number(emp.completed_tasks ?? emp.completedTasks ?? 0);
  const total = Number(emp.total_tasks ?? emp.totalTasks ?? 0);
  let eff = Number(emp.completion_ratio ?? emp.efficiency ?? 0);
  if (!eff && total > 0) {
    eff = Math.round((completed / total) * 100);
  }

  return {
    id: emp.id,
    name: emp.name || "Employee",
    role: emp.role || "Staff",
    email: emp.email || "",
    phone: emp.phone || "N/A",
    monthly_salary: emp.monthly_salary ? Number(emp.monthly_salary) : undefined,
    total_leaves_allowed: emp.total_leaves_allowed !== undefined && emp.total_leaves_allowed !== null ? Number(emp.total_leaves_allowed) : 2,
    totalTasks: total,
    completedTasks: completed,
    efficiency: eff,
    is_active: emp.is_active !== false && emp.is_active !== 0
  };
}

const cleanPunctuationAndNoise = (str: string) => {
  return str
    .replace(/[^\w\s]/g, " ") // replace punctuation with space
    .replace(/\s+/g, " ") // collapse spaces
    .trim();
};

function stripConversationalFillers(str: string): string {
  return str
    .replace(/hey can you please|hey can you|could you please|could you|can you please|can you tell me|can you|please show me|please tell me|please check|please|i want to see|i want to know|i would like to see|tell me the|tell me|show me|check|what is the|what is|who is|how is|is doing|comparison please|comparison|right now|today|monthly|current|in the office|for me|the details for|details for|the data for|data for|the info for|info for|the report for|report for|salary of|salary for|profile of|profile for|data of|details of|info of|report of|details|data|info|stats|report|productivity|performance/gi, "")
    .replace(/['’]s\s*(?:profile|details|data|salary|tasks|info|stats|performance)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const cleanNameToken = (token: string) => {
  return stripConversationalFillers(token)
    .replace(/employee|employees|staff|dev|developer|manager|pm|qa|person|member/gi, "")
    .trim();
};

export async function resolveIntentAsync(query: string, role: string): Promise<IntentResult> {
  const rawQ = query.toLowerCase().trim();
  const q = cleanPunctuationAndNoise(rawQ);

  if (!q) {
    return {
      matched: false,
      intent: "empty",
      redirectUrl: "",
      speechSummary: "Please state your command or query.",
      displayText: "Please enter or speak a query."
    };
  }

  // 0. PRIORITY 0: Specific attendance / late warning phrase checks BEFORE general "who is" employee queries
  if (
    q.includes("who was late") || 
    q.includes("who is late") || 
    q.includes("who came late") || 
    q.includes("who arrived late") ||
    q.includes("who checked in late") ||
    q.includes("late check in") ||
    q.includes("late arrival")
  ) {
    return resolveIntent("shift_warnings", role);
  }

  if (
    q.includes("who is present") || 
    q.includes("who is checked in") || 
    q.includes("who checked in") || 
    q.includes("who is in the office") ||
    q.includes("who is working today")
  ) {
    return resolveIntent("attendance", role);
  }

  // 1. PRIORITY 1: Check if query is asking for multi-employee comparative speech
  const isComparativeQuery = 
    q.includes("compare") || 
    q.includes("versus") || 
    q.includes(" vs ") || 
    q.includes("difference") ||
    q.includes("between") ||
    q.includes("performing better") ||
    q.includes("efficiency between") ||
    q.includes("more tasks") ||
    q.includes("comparison");

  if (isComparativeQuery && typeof window !== "undefined") {
    let cleanQuery = q
      .replace(/can you please|could you|please|compare productivity of|compare performance of|compare tasks of|compare efficiency of|compare data of|compare|who is performing better between|who has done more tasks|check difference in efficiency between|difference in efficiency between|difference between|comparison please|comparison|right now/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Split names by 'and', 'vs', 'versus', 'with', 'to', 'or'
    const parts = cleanQuery.split(/\s+(?:and|vs|versus|with|to|or)\s+/i);
    if (parts.length >= 2) {
      const targetName1 = cleanNameToken(parts[0]);
      const targetName2 = cleanNameToken(parts[1]);

      if (targetName1.length >= 2 && targetName2.length >= 2) {
        try {
          const res = await fetch("/api/employees");
          if (res.ok) {
            const data = await res.json();
            const employeesList = Array.isArray(data) ? data : (data.employees || []);

            const emp1Raw = employeesList.find((e: any) => 
              e.name?.toLowerCase().includes(targetName1) ||
              e.email?.toLowerCase().includes(targetName1) ||
              e.role?.toLowerCase() === targetName1
            );

            const emp2Raw = employeesList.find((e: any) => 
              e.name?.toLowerCase().includes(targetName2) ||
              e.email?.toLowerCase().includes(targetName2) ||
              e.role?.toLowerCase() === targetName2
            );

            if (emp1Raw && emp2Raw) {
              const mappedEmp1 = normalizeEmployeeData(emp1Raw);
              const mappedEmp2 = normalizeEmployeeData(emp2Raw);

              const eff1 = mappedEmp1.efficiency || 0;
              const eff2 = mappedEmp2.efficiency || 0;
              const comp1 = mappedEmp1.completedTasks || 0;
              const comp2 = mappedEmp2.completedTasks || 0;
              const tot1 = mappedEmp1.totalTasks || 0;
              const tot2 = mappedEmp2.totalTasks || 0;

              let leaderName = "";
              let effDiff = Math.abs(eff1 - eff2);
              if (eff1 > eff2) {
                leaderName = mappedEmp1.name;
              } else if (eff2 > eff1) {
                leaderName = mappedEmp2.name;
              }

              let leadSentence = "";
              if (leaderName) {
                leadSentence = `${leaderName} currently leads in overall efficiency by ${effDiff}%.`;
              } else if (eff1 > 0) {
                leadSentence = `Both ${mappedEmp1.name} and ${mappedEmp2.name} have an identical efficiency rating of ${eff1}%.`;
              } else {
                leadSentence = `Both team members are actively assigned in the system.`;
              }

              const salStr1 = mappedEmp1.monthly_salary ? `Monthly Salary: ₹${mappedEmp1.monthly_salary.toLocaleString("en-IN")}.` : "";
              const salStr2 = mappedEmp2.monthly_salary ? `Monthly Salary: ₹${mappedEmp2.monthly_salary.toLocaleString("en-IN")}.` : "";

              const speech = `Executive Performance Comparison between ${mappedEmp1.name} and ${mappedEmp2.name}: ${mappedEmp1.name} (${mappedEmp1.role}) has completed ${comp1} of ${tot1} assigned tasks with ${eff1}% efficiency rating. ${salStr1} ${mappedEmp2.name} (${mappedEmp2.role}) has completed ${comp2} of ${tot2} assigned tasks with ${eff2}% efficiency rating. ${salStr2} ${leadSentence}`;

              const display = `Executive Comparison: ${mappedEmp1.name} (${eff1}% efficiency, ${comp1}/${tot1} tasks) vs ${mappedEmp2.name} (${eff2}% efficiency, ${comp2}/${tot2} tasks). ${leadSentence}`;

              return {
                matched: true,
                intent: "employee_comparison",
                redirectUrl: `/dashboard/employees`,
                speechSummary: speech,
                displayText: display,
                comparativeData: {
                  emp1: mappedEmp1,
                  emp2: mappedEmp2,
                  leaderName,
                  efficiencyDiff: effDiff,
                  tasksDiff: Math.abs(comp1 - comp2)
                }
              };
            } else if (emp1Raw || emp2Raw) {
              const foundEmp = normalizeEmployeeData(emp1Raw || emp2Raw);
              const missingName = emp1Raw ? targetName2 : targetName1;
              const salStr = foundEmp.monthly_salary ? `Monthly Salary: ₹${foundEmp.monthly_salary.toLocaleString("en-IN")}.` : "";

              const speech = `Executive Brief for ${foundEmp.name}: Role is ${foundEmp.role}, completed ${foundEmp.completedTasks} of ${foundEmp.totalTasks} tasks (${foundEmp.efficiency}% efficiency). ${salStr} Note: I searched system records for ${missingName}, but no matching employee was found.`;

              return {
                matched: true,
                intent: "employee_partial_comparison",
                redirectUrl: `/dashboard/employees?highlight=${encodeURIComponent(foundEmp.name)}`,
                speechSummary: speech,
                displayText: `Found record for ${foundEmp.name} (${foundEmp.efficiency}% efficiency). "${missingName}" was not found in records.`,
                employeeData: foundEmp
              };
            }
          }
        } catch (err) {
          console.error("Error running comparative employee analysis:", err);
        }
      }
    }
  }

  // 2. PRIORITY 2: Check if query is asking for specific single employee data
  const isEmployeeDataQuery = 
    q.includes("data of") || 
    q.includes("data for") ||
    q.includes("tell me about") || 
    q.includes("tell me data") || 
    q.includes("info of") || 
    q.includes("info for") ||
    q.includes("details of") || 
    q.includes("details for") ||
    q.includes("report of") || 
    q.includes("report for") || 
    q.includes("salary of") || 
    q.includes("salary for") ||
    q.includes("profile of") || 
    q.includes("profile for") ||
    q.includes("who is") ||
    q.includes("how is") ||
    q.includes("is doing") ||
    q.includes("'s profile") ||
    q.includes("'s details") ||
    q.includes("'s data") ||
    q.includes("'s salary");

  if ((isEmployeeDataQuery || typeof window !== "undefined") && typeof window !== "undefined") {
    // Try fetching employees to match by name token or by presence of employee name in query
    try {
      const res = await fetch("/api/employees");
      if (res.ok) {
        const data = await res.json();
        const employeesList = Array.isArray(data) ? data : (data.employees || []);

        let targetName = cleanNameToken(q);

        // Find match by name or email or role
        let empRaw = employeesList.find((e: any) => {
          const empFirstName = (e.name || "").split(" ")[0].toLowerCase();
          const empFullName = (e.name || "").toLowerCase();
          return (
            (targetName.length >= 2 && (empFullName.includes(targetName) || e.email?.toLowerCase().includes(targetName) || e.role?.toLowerCase() === targetName)) ||
            (empFirstName.length >= 2 && q.includes(empFirstName)) ||
            (empFullName.length >= 3 && q.includes(empFullName))
          );
        });

        if (empRaw) {
          const empData = normalizeEmployeeData(empRaw);
          const salaryFormatted = empData.monthly_salary ? `₹${empData.monthly_salary.toLocaleString("en-IN")}` : "Not Disclosed";
          const tasksInfo = (empData.totalTasks || 0) > 0
            ? `${empData.completedTasks || 0} of ${empData.totalTasks} tasks completed (${empData.efficiency || 0}% efficiency)`
            : "No tasks assigned currently";

          const speech = `Executive Brief for ${empData.name}: Role is ${empData.role}. Monthly Salary is ${salaryFormatted}. Task Progress: ${tasksInfo}. Status: ${empData.is_active ? "Active Employee" : "Inactive"}.`;
          const display = `Executive Summary for ${empData.name}: Role: ${empData.role} | Salary: ${salaryFormatted} | Tasks: ${empData.completedTasks}/${empData.totalTasks} (${empData.efficiency}% efficiency).`;

          return {
            matched: true,
            intent: "employee_data",
            redirectUrl: `/dashboard/employees?highlight=${encodeURIComponent(empData.name)}`,
            speechSummary: speech,
            displayText: display,
            highlightKey: empData.name,
            employeeData: empData
          };
        } else if (isEmployeeDataQuery && targetName.length >= 2) {
          return {
            matched: true,
            intent: "employee_not_found",
            redirectUrl: `/dashboard/employees?highlight=${encodeURIComponent(targetName)}`,
            speechSummary: `I searched system records for ${targetName}, but no matching employee record was found. Redirecting to the Employee Directory.`,
            displayText: `No employee matching "${targetName}" found in system records. Opening Employee Directory...`,
            highlightKey: targetName
          };
        }
      }
    } catch (err) {
      console.error("Error fetching employee data for voice assistant:", err);
    }
  }

  // Fallback to static intent resolution
  return resolveIntent(rawQ, role);
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
    q.includes("settings") ||
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


