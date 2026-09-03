# Leave Cancellation & Half Day Application Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow employees to directly cancel unapproved leave applications, fix half day leave submissions so they properly notify and appear for PM/Admin/CEO with 1-click approvals, and allow employees to raise cancellation requests for approved leaves with management review.

**Architecture:** Extend `attendance.status` in MySQL to `VARCHAR(50)`, handle `Half Day (Pending)` and cancellation request states, provide dedicated API routes for employee cancellations and cancel requests, update notification dispatches, and equip the attendance UI with interactive cancellation buttons and management action controls.

**Tech Stack:** Next.js 16 (App Router), TypeScript, React 19, MySQL2, Tailwind CSS 4, SweetAlert2, Lucide React.

## Global Constraints
- Target database: MySQL (`attendance`, `notifications`, `users`).
- Maintain existing 12-Hour IST formatting and date utils.
- Preserve backward compatibility with active shift check-ins and payroll quota calculations.
- Clean code without placeholders or mock data.

---

### Task 1: Database Migration for Attendance Status Column

**Files:**
- Create: `scripts/migrate-attendance-status.js`
- Test: Run script against DB

- [ ] **Step 1: Create migration script**

```javascript
// scripts/migrate-attendance-status.js
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
  console.log('Connecting to database for attendance status migration...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_tracking',
  });

  console.log('Altering attendance.status column to VARCHAR(50)...');
  await conn.query(`
    ALTER TABLE attendance 
    MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Present'
  `);

  console.log('✓ Successfully altered attendance.status column to VARCHAR(50)!');
  await conn.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run migration script**

Run: `node scripts/migrate-attendance-status.js`
Expected output: `✓ Successfully altered attendance.status column to VARCHAR(50)!`

- [ ] **Step 3: Commit migration script**

```powershell
git add scripts/migrate-attendance-status.js; git commit -m "chore: add and run migration for attendance status column"
```

---

### Task 2: Backend API for Leave Application & Notifications

**Files:**
- Modify: `src/app/api/attendance/route.ts`

- [ ] **Step 1: Update `POST /api/attendance`**
- Check if requested `status === 'Half Day'`.
- For non-management, store status as `'Half Day (Pending)'` if requested status is "Half Day", else `'Leave (Pending)'`.
- Store notes with prefix `PENDING_HALF_DAY:` or `PENDING_LEAVE:`.
- Dispatch notifications to PM, Admin, CEO users in the `notifications` table:
  - Query active users with `role IN ('PM', 'Admin', 'CEO')`.
  - Batch insert notifications with title: `🌓 New Half Day Leave Application` (or `🏖️ New Leave Application`), and message including employee name and date.

- [ ] **Step 2: Update `GET /api/attendance/route.ts`**
- Ensure `pendingLeaves` query for employees includes both `'Leave (Pending)'` and `'Half Day (Pending)'`, as well as `'Leave (Cancel Requested)'` and `'Half Day (Cancel Requested)'`:
  `WHERE user_id = ? AND date > ? AND (status LIKE '%Pending%' OR status LIKE '%Cancel Requested%')`

- [ ] **Step 3: Test leave application via test script**
- Run a node test script creating a half-day leave and verifying DB row and notification creation.

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/attendance/route.ts; git commit -m "feat: record half-day pending leave and notify PM Admin CEO"
```

---

### Task 3: Backend APIs for Employee Leave Cancellation

**Files:**
- Create: `src/app/api/attendance/leave-cancel/route.ts`
- Create: `src/app/api/attendance/leave-cancel-request/route.ts`

- [ ] **Step 1: Implement `POST /api/attendance/leave-cancel`**
- Accepts `{ id: number }`.
- Verifies session and ownership (`user_id === session.user.id` or management).
- Verifies status contains `'Pending'`.
- Deletes record from `attendance` table.
- Inserts notification for PM, Admin, CEO: `🚫 Leave Application Cancelled by ${userName} for ${date}`.
- Returns `{ success: true, message: "Leave application cancelled successfully" }`.

- [ ] **Step 2: Implement `POST /api/attendance/leave-cancel-request`**
- Accepts `{ id: number, reason: string }`.
- Verifies session and ownership.
- Verifies record status is approved leave (`status IN ('Leave', 'Half Day', 'Sick Leave', 'Paid Leave')` or does not contain `Pending`/`Rejected`).
- Verifies date is `>= todayIST`.
- Sets status: if current status is `'Half Day'` -> `'Half Day (Cancel Requested)'`, else `'Leave (Cancel Requested)'`.
- Appends `[CANCEL_REQUEST: ${reason}]` to `notes`.
- Inserts notification for PM, Admin, CEO: `⚠️ Leave Cancellation Request from ${userName} for ${date}. Reason: ${reason}`.
- Returns `{ success: true, message: "Cancellation request submitted to management" }`.

- [ ] **Step 3: Test endpoints with test script**
- Verify validation, authorization, and notification creation.

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/attendance/leave-cancel/route.ts src/app/api/attendance/leave-cancel-request/route.ts; git commit -m "feat: add endpoints for direct cancel and cancel request"
```

---

### Task 4: Backend Management Leave-Action Endpoint Updates

**Files:**
- Modify: `src/app/api/attendance/leave-action/route.ts`

- [ ] **Step 1: Update `GET /api/attendance/leave-action`**
- Query:
  `WHERE a.status LIKE '%Pending%' OR a.status LIKE '%Cancel Requested%'`
- Return enriched rows indicating:
  - `is_half_day`: `status.includes('Half Day') || notes.includes('HALF_DAY')`
  - `is_cancel_request`: `status.includes('Cancel Requested')`
  - `clean_reason`: parsed note without prefix tags.

- [ ] **Step 2: Update `POST /api/attendance/leave-action`**
- Support actions:
  - `approve`: if target is `Half Day (Pending)` or `leave_type === 'Half Day'`, approve as `'Half Day'`; else as requested/`Leave`.
  - `reject`: set `status = 'Leave (Rejected)'`.
  - `approve_cancel`: delete the attendance record (`DELETE FROM attendance WHERE id = ?`), restoring the day as normal workday and returning leave balance. Notify employee that cancellation was approved.
  - `reject_cancel`: revert status back to previous approved type (`Half Day` or `Leave`). Notify employee that cancellation was rejected.

- [ ] **Step 3: Test leave actions with test script**
- Verify approval of half-day leaves, cancellation approvals, and cancellation rejections.

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/attendance/leave-action/route.ts; git commit -m "feat: update leave-action endpoint for half-day and cancel requests"
```

---

### Task 5: Frontend Attendance Page Enhancements

**Files:**
- Modify: `src/app/dashboard/attendance/page.tsx`

- [ ] **Step 1: Update Employee Pending Leaves Banner**
- Display badge indicating `Half Day (Pending)` or `Full Day (Pending)`.
- Add a **"Cancel Application"** button per pending leave with SweetAlert2 confirmation.
- Triggers `POST /api/attendance/leave-cancel` and refreshes attendance.

- [ ] **Step 2: Update Recent Attendance Records Table for Employee**
- In Status column: render badges for `Half Day (Pending)`, `Leave (Pending)`, `Half Day (Cancel Requested)`, and `Leave (Cancel Requested)`.
- In Action column:
  - For pending leaves: show **"Cancel Request"** button.
  - For approved leaves with future/today date: show **"Request Cancellation"** button with reason modal.

- [ ] **Step 3: Add Cancellation Request Modal**
- Modal with text area for "Reason for Cancellation", submitting to `/api/attendance/leave-cancel-request`.

- [ ] **Step 4: Update PM/Admin/CEO Pending Applications Table**
- Display `Leave Type` column with clear badges:
  - `🌓 Half Day (Pending)`
  - `🏖️ Full Day (Pending)`
  - `⚠️ Cancellation Request`
- For pending leaves:
  - **Approve** button (auto-detects Half Day vs Full Day).
  - **Reject** button.
- For cancellation requests:
  - **Approve Cancellation** button (emerald, deletes record & restores balance).
  - **Reject Cancellation** button (red, prompts reason & retains approved leave).

- [ ] **Step 5: Test UI in browser / build check**
- Run `npm run build` to verify zero TypeScript or syntax errors.

- [ ] **Step 6: Commit**

```powershell
git add src/app/dashboard/attendance/page.tsx; git commit -m "feat: complete UI for leave cancellation and half-day management"
```

---

### Task 6: End-to-End Verification & Production Build

**Files:**
- Create: `scripts/test-leave-cancellation-flow.js`

- [ ] **Step 1: Run comprehensive automated integration test**
- Tests full cycle: apply half day -> PM receives notification & views in queue -> PM approves as half day -> employee requests cancellation -> PM approves cancellation -> balance restored.
- Tests direct unapproved cancellation: apply leave -> employee cancels directly -> record removed.

- [ ] **Step 2: Run production Next.js build**
Run: `npm run build`
Expected: Exit code 0, all routes successfully compiled.

- [ ] **Step 3: Final commit**

```powershell
git add .; git commit -m "chore: verify end-to-end leave cancellation and half-day workflow"
```
