# Attendance Timer Consistency, Leave Approval Workflow & Task Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full live check-in/out timers on the Attendance page identical to the header widget, fix Select component infinite render loop, build employee leave request and management approval workflow, integrate developer self-testing QA verification logging, enable fast-track direct submission to PM/CEO, and prefill task details with PM selection by name.

**Architecture:** 
- Fix React state loop in `select.tsx` via memoized label registration.
- Unify `/dashboard/attendance` shift timer with manual check-in/out time dialogs, live running timer, and previous-shift alerts.
- Add `POST /api/attendance` for leave requests, real-time PM/CEO/Admin notifications, and 1-click Approve/Reject controls in `PMAttendanceManager`.
- Add developer self-testing verification field and fast-track submission to PM/CEO (`Ready for Demo`) in `tasks/page.tsx` and `api/tasks/route.ts`.
- Expand task assignment by PM name and ensure complete form prefilling in `tasks/page.tsx`.

**Tech Stack:** Next.js 16 (Turbopack, App Router), React 19, MySQL (`mysql2/promise`), Tailwind CSS, Lucide Icons.

---

### Task 1: Fix Select Component Infinite Loop (`Maximum update depth exceeded`)

**Files:**
- Modify: `src/components/ui/select.tsx:30-65`, `src/components/ui/select.tsx:165-175`

- [ ] **Step 1: Memoize `registerLabel` and update `SelectItem` effect**
  - In `src/components/ui/select.tsx`, wrap `registerLabel` with `useCallback`.
  - Ensure `SelectItem` calls `registerLabel` with stable string content without triggering infinite re-renders.
- [ ] **Step 2: Verify in browser console**
  - Confirm `Maximum update depth exceeded` error is eliminated on all pages.

---

### Task 2: Attendance Page Check-In/Out Modals & Live Running Shift Timer

**Files:**
- Modify: `src/app/dashboard/attendance/page.tsx`

- [ ] **Step 1: Add time picker dialogs and live shift timer**
  - Add Check-In modal with manual IST time input, date indicator, and previous shift half-day warning alert.
  - Add Check-Out modal with manual IST time input, overnight shift toggle, and < 9-hour early checkout warning alert.
  - Add Live Running Timer displaying `⏱️ In Shift (Checked in: HH:MM:SS AM/PM)` with elapsed hours and overnight moon icon (`🌙`).
  - Add Shift Done badge with completed hours.
- [ ] **Step 2: Sync offline punches to `localStorage`**
  - Match offline queuing logic with `AttendanceWidget`.

---

### Task 3: Employee Leave Application & Management Approval Flow (Fix 405 Error)

**Files:**
- Modify: `src/app/api/attendance/route.ts`
- Modify: `src/components/PMAttendanceManager.tsx`
- Modify: `src/app/dashboard/attendance/page.tsx`

- [ ] **Step 1: Add `POST` handler to `/api/attendance`**
  - Accept leave application from employees: `start_date`, `end_date`, `status`, `reason`.
  - Insert attendance records with `status = 'Leave (Pending)'` and save reason in remarks.
  - Insert notification for PMs, CEOs, and Admins (`role IN ('PM', 'CEO', 'Admin')`):
    `🏖️ Leave Request from [Employee Name]: [Leave Type] for [Dates]. Reason: [Reason]`
- [ ] **Step 2: Add Approve & Reject actions in `PMAttendanceManager.tsx`**
  - Display pending leave requests card.
  - Provide 1-click **Approve (✓)** (`status = 'Leave'`) and **Reject (✕)** (`status = 'Rejected'`) buttons.
  - Notify employee upon management decision.

---

### Task 4: Developer Self-Testing QA Handoff Log & Badges

**Files:**
- Modify: `src/app/dashboard/tasks/page.tsx`
- Modify: `src/app/dashboard/testing/page.tsx`
- Modify: `src/app/api/tasks/route.ts`

- [ ] **Step 1: Add self-test question in "Send to QA Testing" modal**
  - Add checkbox / radio: `Did you self-test this task before handing off to QA? (Yes / No)`.
  - Pass `is_developer_tested` to `PATCH /api/tasks` with `action: "send_to_testing"`.
- [ ] **Step 2: Store and render developer tested badge**
  - Store `is_developer_tested` on task record.
  - Display `🧪 QA Queue (Developer Tested: Yes ✓)` on task cards and inside `QA Testing Verification Station`.

---

### Task 5: Fast-Track Direct Submit Option to PM/CEO

**Files:**
- Modify: `src/app/dashboard/tasks/page.tsx`
- Modify: `src/app/api/tasks/route.ts`

- [ ] **Step 1: Add Direct Submit action button**
  - On Developer in-progress task cards, add button: `⚡ Direct Submit to PM/CEO`.
  - Add hover title: `"for fastest development project which tester doesn't know about so developer can submit them as fast as soon to their PM and CEO"`.
  - Submits task with `action: "direct_submit"` or `status: "Ready for Demo"`, bypassing QA testing queue and sending notification directly to PM and CEO.

---

### Task 6: Assign By Specific PM Name & Task Edit Prefilling

**Files:**
- Modify: `src/app/dashboard/tasks/page.tsx`
- Modify: `src/app/api/tasks/route.ts`

- [ ] **Step 1: Select PM by Name in "Assigned By"**
  - In Create Task & Edit Task modals, when PM is chosen, provide selection of active PMs (`PM: [Name]`).
  - Display assigned PM's name on task cards.
- [ ] **Step 2: Prefill all task details in Edit Task modal**
  - Populate all existing values: title, description, project, assignee, priority, status, target date, assigned by PM name, progress %, hours spent, blockers, remarks.
