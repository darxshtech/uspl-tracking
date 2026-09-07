# Employee Productivity Analytics & Ideal Tags Design

## 1. Overview & Objective
This specification defines the architecture, scoring algorithm, API, and UI integration for the **Employee Productivity & Utilization Analytics** system. 

Leadership (Admin, CEO, and PM) requires an automated, objective analysis of workforce performance to distinguish between high-contributing ("Ideal") employees, active employees, and under-utilized ("Idle") employees. The evaluation is based on 4 interconnected pillars:
1. **Working Time**: Shift attendance duration (Check-in to Check-out) vs actual Task Timer hours logged.
2. **Task Progress & Output**: Completed vs assigned tasks.
3. **Subtask Checklists**: Subtask checklists completed vs total subtasks.
4. **Project Engagement**: Active contribution across all assigned projects.

The resulting classification tags are displayed exclusively to **Admin, CEO, and PM** across the Executive Dashboard, Attendance Station (both Calendar and Table views), and the Daily Live Team Activity Monitor, with time filters for **Today, This Week, This Month, and This Year**.

---

## 2. Role-Based Access Control & Privacy
* **Authorized Roles**: `Admin`, `CEO`, `PM`.
* **Unauthorized Roles**: `Developer`, `Tester`, `Employee`.
* **Privacy Enforcements**:
  - The backend endpoint `/api/analytics/employee-productivity` strictly rejects requests from unauthorized roles with `403 Forbidden`.
  - Frontend components (`<EmployeeProductivityTag />` and analytics panels) are conditionally unmounted when `!["Admin", "CEO", "PM"].includes(session?.user?.role)`.
  - Normal employees cannot view their own tags or colleagues' tags, avoiding unnecessary workplace friction.

---

## 3. The 4-Pillar Weighted Scoring Engine

Every employee receives a **Productivity Score (0 to 100)** for the selected timeframe based on a weighted composite formula:

$$\text{Final Score} = \text{Score}_{\text{Time}} (40) + \text{Score}_{\text{Tasks}} (25) + \text{Score}_{\text{Subtasks}} (20) + \text{Score}_{\text{Projects}} (15)$$

### Pillar 1: Time Utilization (40% Weight, Max 40 Points)
- Compares total task hours logged via timer sessions against shift attendance hours.
- $\text{Utilization \%} = \min\left(100, \frac{\text{Task Hours Logged}}{\text{Shift Attendance Hours}} \times 100\right)$
- $\text{Score}_{\text{Time}} = \text{Utilization \%} \times 0.40$

### Pillar 2: Task Progress & Output (25% Weight, Max 25 Points)
- Evaluates completion and momentum across tasks assigned in the period.
- Completed statuses include: `Completed`, `Ready for Demo`, `Tested (PASS)`.
- In-progress statuses (`In Progress`, `Testing`, `Ready for Testing`) receive 50% partial credit.
- $\text{Task Rate \%} = \min\left(100, \frac{\text{Completed Tasks} + (0.5 \times \text{In-Progress Tasks})}{\max(1, \text{Total Assigned Tasks})} \times 100\right)$
- $\text{Score}_{\text{Tasks}} = \text{Task Rate \%} \times 0.25$

### Pillar 3: Subtask Execution (20% Weight, Max 20 Points)
- Evaluates granular checklist execution from `task_checklists` where `is_completed = 1`.
- If an employee has tasks with subtasks:
  - $\text{Subtask Rate \%} = \frac{\text{Completed Subtasks}}{\text{Total Subtasks}} \times 100$
  - $\text{Score}_{\text{Subtasks}} = \text{Subtask Rate \%} \times 0.20$
- **Graceful Fallback**: If an assigned task has no subtasks created, it automatically inherits the parent task's completion rate so the employee is not unfairly penalized.

### Pillar 4: Project Engagement (15% Weight, Max 15 Points)
- Evaluates active contributions across assigned projects.
- $\text{Project Rate \%} = \frac{\text{Assigned Projects with Logged Task Hours}}{\max(1, \text{Total Assigned Projects})} \times 100$
- $\text{Score}_{\text{Projects}} = \text{Project Rate \%} \times 0.15$

---

## 4. Performance Tiers & Tags

| Final Score | Tag Key | Visual Badge | Meaning & Criteria |
| :--- | :--- | :--- | :--- |
| **≥ 75** | `ideal` | `🌟 Ideal Employee` | High time efficiency (≥75% utilization), consistent task/subtask completions, active on assigned projects. |
| **50 – 74** | `active` | `🟢 Active / Working` | Steady pace, regular output, standard utilization (50%–74%). |
| **< 50** | `idle` | `🟡 Under-utilized` | Long shift attendance relative to task timer output (<50%), or stalled subtasks/projects. |
| **0 Shift Hrs** | `off` | `⚪ Off / Leave` | Employee was not clocked in or was on scheduled approved leave during the period. |

---

## 5. Edge-Case Protection Rules
1. **Zero Shift Hours (Leave / Weekend)**:
   - If an employee has 0 shift hours in the selected timeframe, their status is set to `off` (`⚪ Off / On Leave`) instead of `idle`. Employees are never penalized for approved leave or non-working days.
2. **Live Shifts (Today's Real-time Calculation)**:
   - For `period=today`, if an employee is currently checked in without a checkout timestamp, elapsed shift time is calculated dynamically as $\text{Current IST Time} - \text{Check-in Time}$.
3. **Grace Period for Short Shifts**:
   - Shifts under 1 hour in progress are not evaluated for under-utilization to give staff time to set up and start their daily tasks.
4. **Capped Utilization**:
   - Utilization is capped at 100% to prevent timer overlaps or multi-tasking edge cases from skewing the composite score.

---

## 6. Backend API Specification

### `GET /api/analytics/employee-productivity`
* **RBAC Check**: Derives caller identity and role from session token. Throws 403 if role is not Admin, CEO, or PM.
* **Query Parameters**:
  - `period`: `today` | `week` | `month` | `year` | `custom` (default: `today`)
  - `start_date`: `YYYY-MM-DD` (optional, for custom date ranges)
  - `end_date`: `YYYY-MM-DD` (optional, for custom date ranges)
  - `employee_id`: number (optional, for fetching detailed metrics of a specific employee)
* **Response Payload**:
  ```json
  {
    "period": "month",
    "date_range": { "start": "2026-09-01", "end": "2026-09-30" },
    "summary": {
      "total_employees": 16,
      "ideal_count": 6,
      "active_count": 8,
      "idle_count": 2,
      "off_count": 0
    },
    "employees": [
      {
        "id": 10,
        "name": "Alex Dev",
        "email": "alex@example.com",
        "role": "Developer",
        "avatar": null,
        "score": 82,
        "tag": "ideal",
        "tag_label": "🌟 Ideal Employee",
        "metrics": {
          "shift_hours": 38.5,
          "task_hours": 31.2,
          "utilization_rate": 81.0,
          "tasks_completed": 8,
          "tasks_in_progress": 2,
          "tasks_total": 10,
          "task_rate": 80.0,
          "subtasks_completed": 18,
          "subtasks_total": 20,
          "subtask_rate": 90.0,
          "active_projects": 2,
          "total_projects": 2,
          "project_rate": 100.0
        }
      }
    ]
  }
  ```

---

## 7. Frontend Integration Points

### 1. Reusable Badge Component: `<EmployeeProductivityTag />`
* Located in `src/components/EmployeeProductivityTag.tsx`.
* Accepts `employeeId`, `metrics`, `tag`, and optional `size`.
* Encapsulates role check (`["Admin", "CEO", "PM"].includes(session?.user?.role)`).
* Includes rich hover tooltip detailing the 4 metrics (Shift vs Task time, Tasks done, Subtasks done, Projects).

### 2. Attendance Station (`/dashboard/attendance`)
* **Calendar View**: In monthly employee attendance cells or selected date drawer, renders the badge calculated for that month or day.
* **Table / List View**: Renders the badge right beside the employee name in `PMAttendanceManager.tsx`.

### 3. Daily Live Team Activity Monitor (`LiveTeamActivityMonitor.tsx`)
* Displays the live real-time `today` badge beside each active team member's card.

### 4. Executive Dashboard (`CEOFilterDashboard.tsx` on `/dashboard`)
* A dedicated **Workforce Productivity & Utilization** section with timeframe toggles (`Today | This Week | This Month | This Year`).
* Summary KPI cards showing counts of Ideal, Active, and Under-utilized staff with one-click filtering.

---

## 8. Verification Plan
* **API Validation**:
  - Test `/api/analytics/employee-productivity` across `today`, `week`, `month`, and `year`.
  - Verify 403 Forbidden is returned for standard employee roles.
* **Calculation Verification**:
  - Verify score calculations with synthetic attendance records, task timers, subtasks, and projects.
  - Verify 0-shift hours correctly outputs `off` tag.
* **UI Responsiveness & Visual Polish**:
  - Verify badge rendering across desktop, tablet, and mobile breakpoints in Attendance, Daily Monitoring, and Executive Dashboard.
  - Verify tooltips render cleanly without clipping or layout shifts.
