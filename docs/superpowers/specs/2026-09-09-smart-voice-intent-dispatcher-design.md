# Smart Voice Intent Dispatcher & Executive Briefings Design Spec

**Date:** 2026-09-09  
**System:** USPL Tracking Executive AI Voice Assistant  
**Target Roles:** Admin, CEO, PM  

---

## 1. Executive Summary

This specification defines the architecture for the **Smart Voice Intent Dispatcher** powering the Executive AI Voice Assistant in USPL Tracking. The system enables natural human speech queries across all 16 executive dashboard modules, returning real-time database briefings, rich in-drawer mini-cards, verbal text-to-speech audio outputs, and seamless one-click navigation with query param highlighting.

---

## 2. Architecture & Data Contracts

### 2.1 File Architecture
- `src/lib/ai-intents.ts`: Modular domain handlers for real-time endpoint querying (Projects, Tasks, Payroll, QA Testing, Credentials, Documents, Policies, Server Logs, Analytics).
- `src/lib/ai-scripting.ts`: Intent resolution router, Levenshtein STT fuzzy name matcher, comparative performance engine, attendance engine, and intent fallback logic.
- `src/components/VoiceScriptingAssistant.tsx`: Drawer UI component handling SpeechRecognition, Web Audio API soundwave visualizer, SpeechSynthesis rate control, rich card rendering, and user interactions.

### 2.2 Standardized Intent Result Schema (`IntentResult`)
```typescript
export interface GenericCardItem {
  id: string | number;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  detailKey1?: string;
  detailVal1?: string;
  detailKey2?: string;
  detailVal2?: string;
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
  cardData?: {
    type: "projects" | "tasks" | "payroll" | "testing" | "credentials" | "documents" | "policies" | "cron" | "generic";
    title: string;
    items: GenericCardItem[];
    statsSummary?: string;
  };
}
```

---

## 3. Domain Handlers & Real-Time Endpoint Integration

| Section | Domain Handler | Target API Endpoint | Verbal Speech Briefing Strategy |
| :--- | :--- | :--- | :--- |
| **Active Projects** | `handleProjectsIntent` | `/api/projects` | Counts total active projects, in-progress tasks, and completion ratios. |
| **Daily Tasks** | `handleTasksIntent` | `/api/tasks` | Summarizes assigned tasks, completed count, and in-progress items for today. |
| **Payroll Status** | `handlePayrollIntent` | `/api/payroll` | Aggregates total monthly compensation commitments and payout status. |
| **Testing Queue** | `handleTestingQueueIntent` | `/api/testing` | Reports number of tasks ready for QA verification and open bug counts. |
| **3rd-Party Credentials** | `handleCredentialsIntent` | `/api/third-party-credentials` | Reports total active API keys (Stripe, Cloudinary, WhatsApp, AWS) safely. |
| **Server Credentials** | `handleCredentialsIntent` | `/api/credentials` | Reports number of production server login credentials stored in vault. |
| **Document Vault** | `handleDocumentsIntent` | `/api/documents` | Summarizes total contracts and uploaded files available. |
| **Company Policies** | `handlePoliciesIntent` | `/api/policies` | Outlines monthly paid leave allowances and scheduled holidays. |
| **Cron Logs** | `handleCronLogsIntent` | `/api/cron/delayed-tasks` | Reports system cron server status and background execution logs. |
| **Analytics & KPI** | `handleAnalyticsIntent` | `/api/analytics` | Summarizes overall team efficiency rating and completed task volume. |

---

## 4. UI/UX & Voice Controls

1. **Phonetic Levenshtein STT Engine**: Corrects STT misheard names (e.g., `"carthick"` $\rightarrow$ `"kartik"`, `"chaitania"` $\rightarrow$ `"chaitanya"`).
2. **Web Audio API Soundwave Visualizer**: Dynamic 8-bar real-time audio visualizer displaying mic volume during active listening.
3. **Speech Synthesis Speed Selector**: Rate control toggle ($1.0\times, 1.25\times, 1.5\times, 2.0\times$) stored in `localStorage`.
4. **Rich Mini-Card Component**: Displays structured item lists in drawer with a prominent `[ Open Full Page → ]` button.

---

## 5. Verification & Testing Strategy

- **Automated Test Suite (`scratch/test-ai-scripting.ts`)**: Tests 55+ natural human conversational speech phrases across all 16 dashboard sections.
- **Type Safety**: Zero errors on `npx tsc --noEmit`.
