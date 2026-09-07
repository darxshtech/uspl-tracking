# Employee Productivity Analytics & Ideal Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an automated 4-pillar analytics engine that classifies employees into performance tags (🌟 Ideal, 🟢 Active, 🟡 Under-utilized, ⚪ Off) based on working time, tasks, subtasks, and assigned projects, visible exclusively to Admin, CEO, and PM across the Executive Dashboard, Attendance Station, and Live Team Monitor with time filters (Today, Week, Month, Year).

**Architecture:** 
1. Server-side analytics API (`/api/analytics/employee-productivity`) executing optimized SQL aggregations for shift hours, task timer hours, task completion rate, subtask checklists, and project engagement.
2. Lightweight role-guarded badge component (`<EmployeeProductivityTag />`) with a rich hover breakdown tooltip.
3. Integrated into Executive Dashboard (`CEOFilterDashboard.tsx`), Attendance Station (`PMAttendanceManager.tsx` and Calendar View), and Daily Live Team Monitor (`LiveTeamActivityMonitor.tsx`).

**Tech Stack:** Next.js 16 (App Router), TypeScript, React 19, MySQL2, Tailwind CSS 4, Lucide React, NextAuth.

## Global Constraints
- Target database: MySQL (`attendance`, `tasks`, `task_checklists`, `task_timer_sessions`, `projects`, `users`).
- Role isolation: Strictly visible only to `Admin`, `CEO`, and `PM`. Reject unauthorized roles on the backend with 403 Forbidden.
- Follow IST timezone standard for all date comparisons (`Asia/Kolkata`).
- Zero shift hours must output `off` (⚪ Off / On Leave) to prevent false idle penalties.
- Cap utilization at 100% to avoid skewed scores from overlapping sessions.

---

### Task 1: Backend Analytics API Endpoint

**Files:**
- Create: `src/app/api/analytics/employee-productivity/route.ts`

**Interfaces:**
- Input: `GET /api/analytics/employee-productivity?period=today|week|month|year|custom&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&employee_id=N`
- Output: `{ period, date_range, summary: { total_employees, ideal_count, active_count, idle_count, off_count }, employees: [...] }`

- [ ] **Step 1: Implement the analytics API route**
  - Enforce session check: ensure caller role is `Admin`, `CEO`, or `PM`. Return 403 otherwise.
  - Compute start and end timestamps based on `period` (`today`, `week`, `month`, `year`, `custom`) in Asia/Kolkata.
  - Query all active users (`role != 'Client'`).
  - Query attendance duration (sum of completed shift hours plus live elapsed time if checked in today).
  - Query task timer hours logged within the date window.
  - Query tasks assigned within the date window and count completed vs in-progress.
  - Query `task_checklists` to evaluate completed checklists vs total checklists.
  - Query assigned projects and compute active contribution ratio.
  - Calculate 4-pillar score: $\text{Time}(40) + \text{Tasks}(25) + \text{Subtasks}(20) + \text{Projects}(15)$.
  - Assign tag: `ideal` (≥75), `active` (50–74), `idle` (<50), or `off` (0 shift hours).

- [ ] **Step 2: Verify endpoint via curl / node test**
  - Test with mock or real session: verify 403 response for unauthorized role, and 200 with complete JSON metrics for leadership role.

- [ ] **Step 3: Commit backend API route**
  ```powershell
  git add src/app/api/analytics/employee-productivity/route.ts; git commit -m "feat(analytics): add employee productivity calculation API"
  ```

---

### Task 2: Reusable Productivity Tag & Tooltip Component

**Files:**
- Create: `src/components/EmployeeProductivityTag.tsx`

**Interfaces:**
- Props: `{ employeeId?: number, tagData?: EmployeeProductivityItem, score?: number, tag?: string, size?: "sm" | "md", showScore?: boolean }`
- Internal: Uses `useSession()` to unmount completely if `!["Admin", "CEO", "PM"].includes(session?.user?.role)`.

- [ ] **Step 1: Create the `<EmployeeProductivityTag />` component**
  - Style badges:
    - `ideal`: Emerald background with sparkle icon and green border.
    - `active`: Sky blue background with check icon and blue border.
    - `idle`: Amber background with warning icon and amber border.
    - `off`: Slate background with moon icon and gray border.
  - Implement interactive hover popover / tooltip displaying the 4-pillar breakdown:
    - Working Time: Task hours vs Shift hours (Utilization %).
    - Tasks: Completed / Total (Rate %).
    - Subtasks: Checklists done / Total (Rate %).
    - Projects: Active / Assigned count.

- [ ] **Step 2: Commit `<EmployeeProductivityTag />`**
  ```powershell
  git add src/components/EmployeeProductivityTag.tsx; git commit -m "feat(ui): add reusable EmployeeProductivityTag component with hover breakdown"
  ```

---

### Task 3: Executive Dashboard Integration (`CEOFilterDashboard.tsx`)

**Files:**
- Modify: `src/components/CEOFilterDashboard.tsx`

- [ ] **Step 1: Add Productivity Analytics section to Executive Overview**
  - Add state for selected productivity timeframe: `"today" | "week" | "month" | "year"` (default: `"today"`).
  - Fetch `/api/analytics/employee-productivity?period=${period}`.
  - Add time-range toggle buttons on top of the section: `[ Today | This Week | This Month | This Year ]`.
  - Render 4 summary KPI cards:
    - 🌟 **Ideal Employees** (count)
    - 🟢 **Active / Working** (count)
    - 🟡 **Under-utilized** (count)
    - 👥 **Total Evaluated** (count)
  - Add quick-filter click handler: clicking "Ideal" filters the employee list to show only Ideal performers.

- [ ] **Step 2: Integrate `<EmployeeProductivityTag />` in the employee workload table**
  - Place the tag directly beside the employee's name and role in each row.

- [ ] **Step 3: Commit Executive Dashboard updates**
  ```powershell
  git add src/components/CEOFilterDashboard.tsx; git commit -m "feat(dashboard): integrate productivity analytics and filters into CEO dashboard"
  ```

---

### Task 4: Attendance Station Integration (Calendar & Table Views)

**Files:**
- Modify: `src/components/PMAttendanceManager.tsx`
- Modify: `src/app/dashboard/attendance/page.tsx`

- [ ] **Step 1: Connect productivity metrics to Attendance Table / List View**
  - In `PMAttendanceManager.tsx`, fetch or receive productivity tags.
  - Render `<EmployeeProductivityTag />` next to each employee's name in the attendance roster.

- [ ] **Step 2: Connect productivity metrics to Attendance Calendar View**
  - In `src/app/dashboard/attendance/page.tsx`, pass the current month context to the productivity tag so it evaluates the employee's performance for the viewed month.
  - Render the tag badge in employee calendar drawer and monthly headers.

- [ ] **Step 3: Commit Attendance Station updates**
  ```powershell
  git add src/components/PMAttendanceManager.tsx src/app/dashboard/attendance/page.tsx; git commit -m "feat(attendance): display productivity tags in calendar and manager table"
  ```

---

### Task 5: Daily Live Team Activity Monitor Integration

**Files:**
- Modify: `src/components/LiveTeamActivityMonitor.tsx`

- [ ] **Step 1: Add live `today` productivity tag in Live Team Activity Monitor**
  - Fetch or calculate real-time daily productivity score for checked-in team members.
  - Render the `<EmployeeProductivityTag />` badge beside the user's name and current active task in the live activity monitor card.

- [ ] **Step 2: Commit Live Team Monitor updates**
  ```powershell
  git add src/components/LiveTeamActivityMonitor.tsx; git commit -m "feat(monitor): show real-time productivity tag in live team activity monitor"
  ```

---

### Task 6: End-to-End Verification & Production Build

- [ ] **Step 1: Test API RBAC and data accuracy**
  - Confirm non-admin/PM roles receive 403 Forbidden.
  - Verify period filters (`today`, `week`, `month`, `year`) calculate exact dates and hours.

- [ ] **Step 2: Run production build**
  - Execute `npm run build` and ensure 0 TypeScript or lint errors.

- [ ] **Step 3: Commit and push**
  - Push branch to remote `origin main`.
