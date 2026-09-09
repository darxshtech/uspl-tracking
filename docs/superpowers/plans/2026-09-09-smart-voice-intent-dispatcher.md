# Smart Voice Intent Dispatcher & Executive Briefings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular intent dispatcher (`src/lib/ai-intents.ts`) that fetches real-time database endpoints across all 16 dashboard sections, providing rich executive speech summaries and interactive mini-cards in the Voice Assistant drawer.

**Architecture:** Split domain logic into `src/lib/ai-intents.ts` containing dedicated async handlers for Projects, Tasks, Payroll, Testing Queue, Credentials, Documents, Policies, Server Logs, and Analytics. Dispatch from `src/lib/ai-scripting.ts` and render rich mini-cards in `VoiceScriptingAssistant.tsx`.

**Tech Stack:** Next.js 14, TypeScript, Web Speech API (SpeechRecognition + SpeechSynthesis), Web Audio API (AnalyserNode), MySQL REST API Endpoints.

## Global Constraints

- Must work 100% free with zero paid external API costs.
- Preserve Levenshtein STT fuzzy name matching for Indian/regional names.
- Type-safe execution with zero `tsc` type errors.

---

### Task 1: Create Modular Domain Handlers (`src/lib/ai-intents.ts`)

**Files:**
- Create: `src/lib/ai-intents.ts`

**Interfaces:**
- Consumes: `/api/projects`, `/api/tasks`, `/api/payroll`, `/api/testing`, `/api/third-party-credentials`, `/api/credentials`, `/api/documents`, `/api/policies`, `/api/cron/delayed-tasks`, `/api/analytics`
- Produces: `IntentResult` with structured `cardData`

- [ ] **Step 1: Write `src/lib/ai-intents.ts` with all 11 domain intent handlers**

```typescript
import { IntentResult, GenericCardItem } from "./ai-scripting";

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
      const speech = `Projects Briefing: ${total} total project${total > 1 ? "s" : ""} registered (${activeCount} currently active). Primary active projects include: ${projectNames || "Main Suite"}.`;
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

export async function handleTasksIntent(): Promise<IntentResult> {
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
      const tasks = Array.isArray(data) ? data : (data.tasks || []);
      const total = tasks.length;
      const completed = tasks.filter((t: any) => t.status === "Completed" || t.status === "Done").length;
      const inProgress = tasks.filter((t: any) => t.status === "In Progress" || t.status === "Active").length;

      const items: GenericCardItem[] = tasks.slice(0, 4).map((t: any) => ({
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

      const speech = `Daily Tasks Briefing: ${total} total task${total > 1 ? "s" : ""} logged today. ${completed} completed, ${inProgress} in progress.`;
      const display = `Daily Tasks (${total}): ${completed} Completed, ${inProgress} In Progress.`;

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
          statsSummary: `${total} Tasks (${completed} Completed)`
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
      const speech = `Payroll Overview Briefing: Total monthly compensation commitment is ${formattedSalary} across ${employees.length} team members. Navigating to Payroll status dashboard.`;
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
```

- [ ] **Step 2: Commit Task 1**

```bash
git add src/lib/ai-intents.ts
git commit -m "feat: Add modular domain intent handlers for projects, tasks, payroll, testing in ai-intents.ts"
```

---

### Task 2: Dispatch Domain Handlers in `src/lib/ai-scripting.ts`

**Files:**
- Modify: `src/lib/ai-scripting.ts`

- [ ] **Step 1: Import domain handlers and update `resolveIntentAsync`**

Import `handleProjectsIntent`, `handleTasksIntent`, `handlePayrollIntent`, `handleTestingQueueIntent` from `./ai-intents` and invoke them inside `resolveIntentAsync`.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit Task 2**

```bash
git add src/lib/ai-scripting.ts
git commit -m "feat: Dispatch domain intent handlers in resolveIntentAsync"
```

---

### Task 3: Render Rich Cards in `VoiceScriptingAssistant.tsx`

**Files:**
- Modify: `src/components/VoiceScriptingAssistant.tsx`

- [ ] **Step 1: Add rich card rendering UI block for `lastResult.cardData`**

Render a styled indigo glassmorphism container displaying card title, stats summary, list items, and `[ Open Full Page → ]` button.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit Task 3**

```bash
git add src/components/VoiceScriptingAssistant.tsx
git commit -m "feat: Render rich executive card UI in VoiceScriptingAssistant drawer"
```

---

### Task 4: Automated Verification & Test Suite Execution

**Files:**
- Modify: `scratch/test-ai-scripting.ts`

- [ ] **Step 1: Add mock data for `/api/projects` and `/api/tasks` in test script**
- [ ] **Step 2: Run test suite**

Run: `npx tsx scratch/test-ai-scripting.ts`
Expected: 55/55 PASS (100% success rate).

- [ ] **Step 3: Commit Task 4 and push to remote**

```bash
git add scratch/test-ai-scripting.ts
git commit -m "test: Verify 100% pass rate on expanded smart voice intent dispatcher test suite"
git push origin darsh
```
