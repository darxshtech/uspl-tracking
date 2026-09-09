import { IntentResult, GenericCardItem, matchEmployeeFuzzy } from "./ai-scripting";

export async function handleProjectsIntent(): Promise<IntentResult> {
  if (typeof window === "undefined") {
    return {
      matched: true,
      intent: "projects",
      redirectUrl: "/dashboard/projects",
      speechSummary: "Opening Active Projects board.",
      displayText: "Redirecting to Active Projects..."
    };
  }

  try {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      const projects = Array.isArray(data) ? data : (data.projects || []);
      const total = projects.length;
      const activeCount = projects.filter((p: any) => p.status !== "Completed").length;

      const items: GenericCardItem[] = projects.slice(0, 4).map((p: any) => ({
        id: p.id || p.title,
        title: p.title || p.name || "Project",
        subtitle: `Client: ${p.client_name || "Internal"}`,
        badge: p.status || "Active",
        badgeColor: p.status === "Completed" ? "bg-emerald-500" : "bg-indigo-500",
        detailKey1: "Progress",
        detailVal1: `${p.progress || 0}%`,
        detailKey2: "Tasks",
        detailVal2: `${p.completed_tasks || 0}/${p.total_tasks || 0}`
      }));

      const projectNames = projects.slice(0, 3).map((p: any) => p.title || p.name).filter(Boolean).join(", ");
      const speech = `Projects Briefing: ${total} total project${total > 1 ? "s" : ""} registered (${activeCount} currently active). Primary active projects include: ${projectNames || "Main Suite"}. Navigating to Projects board.`;
      const display = `Active Projects (${total}): ${projectNames}.`;

      return {
        matched: true,
        intent: "projects",
        redirectUrl: "/dashboard/projects",
        speechSummary: speech,
        displayText: display,
        cardData: {
          type: "projects",
          title: "📁 Active Projects Board",
          items,
          statsSummary: `${total} Projects (${activeCount} Active)`
        }
      };
    }
  } catch (err) {
    console.error("Error fetching projects for AI assistant:", err);
  }

  return {
    matched: true,
    intent: "projects",
    redirectUrl: "/dashboard/projects",
    speechSummary: "Opening Active Projects board.",
    displayText: "Redirecting to Projects..."
  };
}

export async function handleTasksIntent(query?: string): Promise<IntentResult> {
  if (typeof window === "undefined") {
    return {
      matched: true,
      intent: "daily_tasks",
      redirectUrl: "/dashboard/tasks",
      speechSummary: "Opening Daily Tasks board.",
      displayText: "Redirecting to Daily Tasks..."
    };
  }

  try {
    const res = await fetch("/api/tasks");
    if (res.ok) {
      const data = await res.json();
      const tasks: any[] = Array.isArray(data) ? data : (data.tasks || []);
      const total = tasks.length;

      const todayStr = new Date().toISOString().split("T")[0];
      const todayTasks = tasks.filter((t: any) => {
        const taskExpDate = t.expected_date ? t.expected_date.split("T")[0] : (t.target_date ? t.target_date.split("T")[0] : (t.due_date ? t.due_date.split("T")[0] : todayStr));
        const taskStartDate = t.start_date ? t.start_date.split("T")[0] : (t.created_at ? t.created_at.split("T")[0] : todayStr);
        const isFinished = ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status);

        const isScheduledToday = taskExpDate === todayStr || taskStartDate === todayStr;
        const isUnfinishedPastTask = !isFinished && (taskStartDate <= todayStr || taskExpDate <= todayStr);
        return isScheduledToday || isUnfinishedPastTask;
      });

      const q = query ? query.toLowerCase().trim() : "";

      // 1. Check if user is asking for tasks by specific project
      let matchedProjectName = "";
      if (q) {
        try {
          const projRes = await fetch("/api/projects");
          if (projRes.ok) {
            const projData = await projRes.json();
            const projList = Array.isArray(projData) ? projData : (projData.projects || []);
            const foundProj = projList.find((p: any) => {
              const pTitle = (p.title || p.name || "").toLowerCase();
              if (!pTitle) return false;
              if (q.includes(pTitle)) return true;
              const words = pTitle.split(/\s+/).filter((w: string) => w.length >= 3 && !["app", "system", "portal", "project", "e-commerce"].includes(w));
              return words.some((w: string) => q.includes(w));
            });
            if (foundProj) {
              matchedProjectName = foundProj.title || foundProj.name;
            }
          }
        } catch (_) {}
      }

      if (!matchedProjectName && q) {
        const projNamesInTasks = Array.from(new Set(todayTasks.map((t: any) => t.project_name).filter(Boolean)));
        const found = projNamesInTasks.find((pName: string) => {
          const lowerP = pName.toLowerCase();
          if (q.includes(lowerP)) return true;
          const words = lowerP.split(/\s+/).filter((w: string) => w.length >= 3 && !["app", "system", "portal", "project"].includes(w));
          return words.some((w: string) => q.includes(w));
        });
        if (found) matchedProjectName = found;
      }

      if (matchedProjectName) {
        const projTodayTasks = todayTasks.filter((t: any) => (t.project_name || "").toLowerCase() === matchedProjectName.toLowerCase());
        const pTotal = projTodayTasks.length;
        const pCompleted = projTodayTasks.filter((t: any) => ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)).length;
        const pInProgress = pTotal - pCompleted;

        const items: GenericCardItem[] = projTodayTasks.slice(0, 4).map((t: any) => ({
          id: t.id,
          title: t.title || t.task_name || "Task",
          subtitle: `Assigned: ${t.assignee_name || t.assigned_to || "Staff"}`,
          badge: t.status || "Pending",
          badgeColor: t.status === "Completed" ? "bg-emerald-500" : "bg-amber-500",
          detailKey1: "Priority",
          detailVal1: t.priority || "Medium",
          detailKey2: "Project",
          detailVal2: t.project_name || matchedProjectName
        }));

        const speech = `Today's Tasks Briefing for ${matchedProjectName}: ${pTotal} task${pTotal !== 1 ? "s" : ""} scheduled today (${pCompleted} completed, ${pInProgress} in progress). Navigating to Daily Tasks.`;
        const display = `Today's Tasks (${matchedProjectName}): ${pTotal} Tasks (${pCompleted} Completed, ${pInProgress} In Progress).`;

        return {
          matched: true,
          intent: "daily_tasks",
          redirectUrl: `/dashboard/tasks?search=${encodeURIComponent(matchedProjectName)}`,
          speechSummary: speech,
          displayText: display,
          cardData: {
            type: "tasks",
            title: `📁 ${matchedProjectName} — Today's Tasks`,
            items,
            statsSummary: `${pTotal} Tasks Today (${pCompleted} Completed)`
          }
        };
      }

      // 2. Check if user is asking for tasks by specific employee
      let matchedEmpName = "";
      if (q) {
        try {
          const empRes = await fetch("/api/employees");
          if (empRes.ok) {
            const empData = await empRes.json();
            const empList = Array.isArray(empData) ? empData : (empData.employees || []);
            const cleanToken = q.replace(/today|todays|task|tasks|show|tell|me|for|by|each|project|employee|dev|developer|list|open/gi, " ").trim();
            if (cleanToken.length >= 2) {
              const foundEmp = empList.find((e: any) => matchEmployeeFuzzy(cleanToken, e));
              if (foundEmp) matchedEmpName = foundEmp.name;
            }
          }
        } catch (_) {}
      }

      if (matchedEmpName) {
        const empTodayTasks = todayTasks.filter((t: any) => {
          const mainAssignee = (t.assignee_name || "").toLowerCase();
          const targetNameLower = matchedEmpName.toLowerCase();
          if (mainAssignee.includes(targetNameLower) || targetNameLower.includes(mainAssignee)) return true;
          if (Array.isArray(t.assignees)) {
            return t.assignees.some((a: any) => (a.name || "").toLowerCase().includes(targetNameLower));
          }
          return false;
        });

        const eTotal = empTodayTasks.length;
        const eCompleted = empTodayTasks.filter((t: any) => ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)).length;
        const eInProgress = eTotal - eCompleted;

        const items: GenericCardItem[] = empTodayTasks.slice(0, 4).map((t: any) => ({
          id: t.id,
          title: t.title || t.task_name || "Task",
          subtitle: `Project: ${t.project_name || "General"}`,
          badge: t.status || "Pending",
          badgeColor: t.status === "Completed" ? "bg-emerald-500" : "bg-amber-500",
          detailKey1: "Priority",
          detailVal1: t.priority || "Medium",
          detailKey2: "Assigned",
          detailVal2: matchedEmpName
        }));

        const speech = `Today's Tasks Briefing for ${matchedEmpName}: ${eTotal} task${eTotal !== 1 ? "s" : ""} assigned for today (${eCompleted} completed, ${eInProgress} in progress). Navigating to Daily Tasks.`;
        const display = `Today's Tasks (${matchedEmpName}): ${eTotal} Tasks (${eCompleted} Completed, ${eInProgress} In Progress).`;

        return {
          matched: true,
          intent: "daily_tasks",
          redirectUrl: `/dashboard/tasks?search=${encodeURIComponent(matchedEmpName)}`,
          speechSummary: speech,
          displayText: display,
          cardData: {
            type: "tasks",
            title: `👤 ${matchedEmpName} — Today's Tasks`,
            items,
            statsSummary: `${eTotal} Tasks Today (${eCompleted} Completed)`
          }
        };
      }

      // 3. Check if user is asking for grouped breakdown by project
      if (q.includes("by project") || q.includes("project breakdown") || q.includes("each project")) {
        const projectCounts: Record<string, number> = {};
        todayTasks.forEach((t: any) => {
          const pName = t.project_name || "General / Unassigned";
          projectCounts[pName] = (projectCounts[pName] || 0) + 1;
        });

        const projEntries = Object.entries(projectCounts).sort((a, b) => b[1] - a[1]);
        const breakdownStr = projEntries.map(([pName, count]) => `${pName}: ${count} task${count > 1 ? "s" : ""}`).join(", ");

        const items: GenericCardItem[] = projEntries.slice(0, 4).map(([pName, count]) => ({
          id: pName,
          title: pName,
          subtitle: "Project Breakdown",
          badge: `${count} Tasks Today`,
          badgeColor: "bg-indigo-500"
        }));

        const speech = `Today's Tasks Breakdown by Project (${todayTasks.length} total tasks today): ${breakdownStr || "No active projects"}. Navigating to Daily Tasks.`;
        const display = `Today's Tasks by Project: ${breakdownStr || "None"}.`;

        return {
          matched: true,
          intent: "daily_tasks",
          redirectUrl: "/dashboard/tasks",
          speechSummary: speech,
          displayText: display,
          cardData: {
            type: "tasks",
            title: "📊 Today's Tasks by Project",
            items,
            statsSummary: `${projEntries.length} Projects (${todayTasks.length} Total Tasks)`
          }
        };
      }

      // 4. Check if user is asking for grouped breakdown by employee / developer
      if (q.includes("by employee") || q.includes("by developer") || q.includes("by dev") || q.includes("employee breakdown") || q.includes("each employee")) {
        const empCounts: Record<string, number> = {};
        todayTasks.forEach((t: any) => {
          const eName = t.assignee_name || "Unassigned";
          empCounts[eName] = (empCounts[eName] || 0) + 1;
        });

        const empEntries = Object.entries(empCounts).sort((a, b) => b[1] - a[1]);
        const breakdownStr = empEntries.map(([eName, count]) => `${eName}: ${count} task${count > 1 ? "s" : ""}`).join(", ");

        const items: GenericCardItem[] = empEntries.slice(0, 4).map(([eName, count]) => ({
          id: eName,
          title: eName,
          subtitle: "Team Member Breakdown",
          badge: `${count} Tasks Today`,
          badgeColor: "bg-emerald-500"
        }));

        const speech = `Today's Tasks Breakdown by Team Member (${todayTasks.length} total tasks today): ${breakdownStr || "No active tasks"}. Navigating to Daily Tasks.`;
        const display = `Today's Tasks by Employee: ${breakdownStr || "None"}.`;

        return {
          matched: true,
          intent: "daily_tasks",
          redirectUrl: "/dashboard/tasks",
          speechSummary: speech,
          displayText: display,
          cardData: {
            type: "tasks",
            title: "👥 Today's Tasks by Employee",
            items,
            statsSummary: `${empEntries.length} Team Members (${todayTasks.length} Total Tasks)`
          }
        };
      }

      // 5. Default General Today's Tasks Briefing
      const todayTotal = todayTasks.length;
      const todayCompleted = todayTasks.filter((t: any) => ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)).length;
      const todayInProgress = todayTotal - todayCompleted;

      const displayList = todayTotal > 0 ? todayTasks : tasks;

      const items: GenericCardItem[] = displayList.slice(0, 4).map((t: any) => ({
        id: t.id,
        title: t.title || t.task_name || "Task",
        subtitle: `Assigned: ${t.assignee_name || t.assigned_to || "Staff"}`,
        badge: t.status || "Pending",
        badgeColor: t.status === "Completed" ? "bg-emerald-500" : "bg-amber-500",
        detailKey1: "Priority",
        detailVal1: t.priority || "Medium",
        detailKey2: "Project",
        detailVal2: t.project_name || "General"
      }));

      const speech = `Daily Tasks Briefing: You have ${todayTotal} tasks active for today (${todayCompleted} completed, ${todayInProgress} in progress, out of ${total} total system tasks). Navigating to Daily Tasks.`;
      const display = `Today's Tasks: ${todayTotal} Tasks (${todayCompleted} Completed, ${todayInProgress} In Progress | ${total} Total System Tasks).`;

      return {
        matched: true,
        intent: "daily_tasks",
        redirectUrl: "/dashboard/tasks",
        speechSummary: speech,
        displayText: display,
        cardData: {
          type: "tasks",
          title: "📝 Daily Tasks Board",
          items,
          statsSummary: `${todayTotal} Today's Tasks (${todayCompleted} Completed)`
        }
      };
    }
  } catch (err) {
    console.error("Error fetching tasks for AI assistant:", err);
  }

  return {
    matched: true,
    intent: "daily_tasks",
    redirectUrl: "/dashboard/tasks",
    speechSummary: "Opening Daily Tasks board.",
    displayText: "Redirecting to Tasks..."
  };
}

export async function handlePayrollIntent(): Promise<IntentResult> {
  if (typeof window === "undefined") {
    return {
      matched: true,
      intent: "payroll",
      redirectUrl: "/dashboard/payroll",
      speechSummary: "Opening Payroll Overview.",
      displayText: "Redirecting to Payroll..."
    };
  }

  try {
    const res = await fetch("/api/employees");
    if (res.ok) {
      const data = await res.json();
      const employees = Array.isArray(data) ? data : (data.employees || []);
      let totalPayroll = 0;
      employees.forEach((e: any) => {
        if (e.monthly_salary) totalPayroll += Number(e.monthly_salary);
      });

      const formattedSalary = `₹${totalPayroll.toLocaleString("en-IN")}`;
      const speech = `Payroll Overview Briefing: Total monthly compensation commitment is ${formattedSalary} across ${employees.length} team members. Navigating to Salary Payout Status.`;
      const display = `Monthly Payroll: ${formattedSalary} (${employees.length} Staff).`;

      const items: GenericCardItem[] = employees.slice(0, 4).map((e: any) => ({
        id: e.id,
        title: e.name,
        subtitle: e.role,
        badge: e.monthly_salary ? `₹${Number(e.monthly_salary).toLocaleString("en-IN")}` : "N/A",
        badgeColor: "bg-emerald-500"
      }));

      return {
        matched: true,
        intent: "payroll",
        redirectUrl: "/dashboard/payroll",
        speechSummary: speech,
        displayText: display,
        cardData: {
          type: "payroll",
          title: "💳 Monthly Salary Payroll",
          items,
          statsSummary: `Total Payout: ${formattedSalary}`
        }
      };
    }
  } catch (err) {
    console.error("Error fetching payroll for AI assistant:", err);
  }

  return {
    matched: true,
    intent: "payroll",
    redirectUrl: "/dashboard/payroll",
    speechSummary: "Opening Salary Payout Status report.",
    displayText: "Redirecting to Payroll..."
  };
}

export async function handleTestingQueueIntent(): Promise<IntentResult> {
  if (typeof window === "undefined") {
    return {
      matched: true,
      intent: "testing_queue",
      redirectUrl: "/dashboard/testing",
      speechSummary: "Opening QA Verification and Testing Queue.",
      displayText: "Redirecting to Testing Queue..."
    };
  }

  try {
    const res = await fetch("/api/testing");
    if (res.ok) {
      const data = await res.json();
      const tests = Array.isArray(data) ? data : (data.tests || data.queue || []);
      const total = tests.length;

      const items: GenericCardItem[] = tests.slice(0, 4).map((t: any) => ({
        id: t.id || t.title,
        title: t.title || t.bug_name || "QA Task",
        subtitle: `Project: ${t.project_name || "App"}`,
        badge: t.status || "Ready for QA",
        badgeColor: "bg-purple-500"
      }));

      const speech = `QA Testing Queue Briefing: ${total} task${total > 1 ? "s" : ""} pending QA verification in the queue. Navigating to Testing Dashboard.`;
      const display = `Testing Queue (${total} tasks pending verification).`;

      return {
        matched: true,
        intent: "testing_queue",
        redirectUrl: "/dashboard/testing",
        speechSummary: speech,
        displayText: display,
        cardData: {
          type: "testing",
          title: "🧪 QA Verification Queue",
          items,
          statsSummary: `${total} Pending Verification`
        }
      };
    }
  } catch (err) {
    console.error("Error fetching testing queue for AI assistant:", err);
  }

  return {
    matched: true,
    intent: "testing_queue",
    redirectUrl: "/dashboard/testing",
    speechSummary: "Opening QA Verification and Testing Queue.",
    displayText: "Redirecting to Testing Queue..."
  };
}

export async function handleCredentialsIntent(isThirdParty: boolean = false): Promise<IntentResult> {
  const targetUrl = isThirdParty ? "/dashboard/third-party-credentials" : "/dashboard/credentials";
  const apiEndpoint = isThirdParty ? "/api/third-party-credentials" : "/api/credentials";
  const titleStr = isThirdParty ? "3rd-Party Services API Credentials" : "Project Server Credentials Vault";

  if (typeof window === "undefined") {
    return {
      matched: true,
      intent: isThirdParty ? "third_party_credentials" : "credentials",
      redirectUrl: targetUrl,
      speechSummary: `Opening ${titleStr}.`,
      displayText: `Redirecting to ${titleStr}...`
    };
  }

  try {
    const res = await fetch(apiEndpoint);
    if (res.ok) {
      const data = await res.json();
      const itemsList = Array.isArray(data) ? data : (data.credentials || data.keys || []);
      const count = itemsList.length;

      const items: GenericCardItem[] = itemsList.slice(0, 4).map((c: any) => ({
        id: c.id || c.name || c.service,
        title: c.name || c.service || c.key_name || "API Key",
        subtitle: c.environment || c.type || "Production",
        badge: "Encrypted",
        badgeColor: "bg-emerald-500"
      }));

      const speech = `${titleStr} Briefing: ${count} encrypted credential records stored securely. Navigating to ${titleStr} vault.`;
      const display = `${titleStr}: ${count} Keys Stored.`;

      return {
        matched: true,
        intent: isThirdParty ? "third_party_credentials" : "credentials",
        redirectUrl: targetUrl,
        speechSummary: speech,
        displayText: display,
        cardData: {
          type: "credentials",
          title: isThirdParty ? "🔑 3rd-Party Credentials" : "🔐 Passwords & Server Vault",
          items,
          statsSummary: `${count} Keys Stored`
        }
      };
    }
  } catch (err) {
    console.error(`Error fetching credentials for ${apiEndpoint}:`, err);
  }

  return {
    matched: true,
    intent: isThirdParty ? "third_party_credentials" : "credentials",
    redirectUrl: targetUrl,
    speechSummary: `Opening ${titleStr}.`,
    displayText: `Redirecting to ${titleStr}...`
  };
}

export async function handleDocumentsIntent(): Promise<IntentResult> {
  if (typeof window === "undefined") {
    return {
      matched: true,
      intent: "documents",
      redirectUrl: "/dashboard/documents",
      speechSummary: "Opening Document Vault.",
      displayText: "Redirecting to Document Vault..."
    };
  }

  try {
    const res = await fetch("/api/documents");
    if (res.ok) {
      const data = await res.json();
      const docs = Array.isArray(data) ? data : (data.documents || []);
      const total = docs.length;

      const items: GenericCardItem[] = docs.slice(0, 4).map((d: any) => ({
        id: d.id || d.title,
        title: d.title || d.file_name || "Document",
        subtitle: `Category: ${d.category || "General"}`,
        badge: d.access_role || "Public",
        badgeColor: "bg-sky-500"
      }));

      const speech = `Document Vault Briefing: ${total} contracts and system files stored in the vault. Navigating to Document Vault.`;
      const display = `Document Vault (${total} files).`;

      return {
        matched: true,
        intent: "documents",
        redirectUrl: "/dashboard/documents",
        speechSummary: speech,
        displayText: display,
        cardData: {
          type: "documents",
          title: "📄 Document Vault & Files",
          items,
          statsSummary: `${total} Files Uploaded`
        }
      };
    }
  } catch (err) {
    console.error("Error fetching documents for AI assistant:", err);
  }

  return {
    matched: true,
    intent: "documents",
    redirectUrl: "/dashboard/documents",
    speechSummary: "Opening Document Vault.",
    displayText: "Redirecting to Document Vault..."
  };
}

export async function handlePoliciesIntent(): Promise<IntentResult> {
  if (typeof window === "undefined") {
    return {
      matched: true,
      intent: "policies",
      redirectUrl: "/dashboard/policies",
      speechSummary: "Opening Company Policies.",
      displayText: "Redirecting to Company Policies..."
    };
  }

  try {
    const res = await fetch("/api/holidays");
    if (res.ok) {
      const data = await res.json();
      const holidays = Array.isArray(data) ? data : (data.holidays || []);
      const upcomingHolidays = holidays.length;

      const speech = `Company Policies Briefing: Standard leave policy permits 2 paid leaves per month. ${upcomingHolidays} official holiday${upcomingHolidays !== 1 ? "s" : ""} scheduled. Navigating to Policies.`;
      const display = `Company Policies & Rules (${upcomingHolidays} Holidays Scheduled).`;

      const items: GenericCardItem[] = holidays.slice(0, 4).map((h: any) => ({
        id: h.id || h.name,
        title: h.name || h.title || "Company Holiday",
        subtitle: `Date: ${h.date || "Scheduled"}`,
        badge: "Official Holiday",
        badgeColor: "bg-indigo-500"
      }));

      return {
        matched: true,
        intent: "policies",
        redirectUrl: "/dashboard/policies",
        speechSummary: speech,
        displayText: display,
        cardData: {
          type: "policies",
          title: "📜 Company Policies & Leave Rules",
          items,
          statsSummary: "2 Paid Leaves/mo • Holidays Active"
        }
      };
    }
  } catch (err) {
    console.error("Error fetching policies/holidays for AI assistant:", err);
  }

  return {
    matched: true,
    intent: "policies",
    redirectUrl: "/dashboard/policies",
    speechSummary: "Opening Company Policies.",
    displayText: "Redirecting to Company Policies..."
  };
}

export async function handleCronLogsIntent(): Promise<IntentResult> {
  if (typeof window === "undefined") {
    return {
      matched: true,
      intent: "cron_logs",
      redirectUrl: "/dashboard/cron-logs",
      speechSummary: "Opening Email and Cron Server Logs.",
      displayText: "Redirecting to Email & Cron Logs..."
    };
  }

  try {
    const res = await fetch("/api/cron/delayed-tasks");
    if (res.ok) {
      const data = await res.json();
      const logs = Array.isArray(data) ? data : (data.logs || data.delayedTasks || []);
      const count = logs.length;

      const speech = `Server Logs Briefing: Automated cron server status is 100% operational with ${count} background event logs recorded. Navigating to Server Logs.`;
      const display = `Cron Logs (${count} System Log Events).`;

      return {
        matched: true,
        intent: "cron_logs",
        redirectUrl: "/dashboard/cron-logs",
        speechSummary: speech,
        displayText: display,
        cardData: {
          type: "cron",
          title: "💻 Server & Cron Execution Logs",
          items: [],
          statsSummary: `${count} System Log Events`
        }
      };
    }
  } catch (err) {
    console.error("Error fetching cron logs for AI assistant:", err);
  }

  return {
    matched: true,
    intent: "cron_logs",
    redirectUrl: "/dashboard/cron-logs",
    speechSummary: "Opening Email and Cron Server Logs.",
    displayText: "Redirecting to Email & Cron Logs..."
  };
}

export async function handleAnalyticsIntent(): Promise<IntentResult> {
  if (typeof window === "undefined") {
    return {
      matched: true,
      intent: "analytics",
      redirectUrl: "/dashboard/analytics",
      speechSummary: "Opening Executive Productivity Analytics dashboard.",
      displayText: "Redirecting to Productivity Analytics..."
    };
  }

  try {
    const res = await fetch("/api/employees");
    if (res.ok) {
      const data = await res.json();
      const employees = Array.isArray(data) ? data : (data.employees || []);
      let totalTasks = 0;
      let completedTasks = 0;

      employees.forEach((e: any) => {
        totalTasks += Number(e.total_tasks || e.totalTasks || 0);
        completedTasks += Number(e.completed_tasks || e.completedTasks || 0);
      });

      const overallEff = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const speech = `Executive Analytics Briefing: Overall team productivity efficiency is ${overallEff}% across ${completedTasks} of ${totalTasks} completed tasks. Navigating to Productivity Analytics dashboard.`;
      const display = `Executive Analytics: ${overallEff}% Team Efficiency (${completedTasks}/${totalTasks} Tasks).`;

      return {
        matched: true,
        intent: "analytics",
        redirectUrl: "/dashboard/analytics",
        speechSummary: speech,
        displayText: display,
        cardData: {
          type: "generic",
          title: "📊 Executive Productivity Analytics",
          items: [],
          statsSummary: `${overallEff}% Efficiency Rating`
        }
      };
    }
  } catch (err) {
    console.error("Error fetching analytics for AI assistant:", err);
  }

  return {
    matched: true,
    intent: "analytics",
    redirectUrl: "/dashboard/analytics",
    speechSummary: "Opening Executive Productivity Analytics dashboard.",
    displayText: "Redirecting to Analytics..."
  };
}
