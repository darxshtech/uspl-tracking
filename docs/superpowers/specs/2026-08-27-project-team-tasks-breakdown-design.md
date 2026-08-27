# Project Team Tasks & Completion Ratio Breakdown Design

## 1. Purpose & Scope
Provide Project Managers (PM), Administrators, and CEOs with a dedicated, detailed view of all employees assigned to a project, their specific task workloads, completion ratios, active progress percentages, and testing/demo states.

---

## 2. API Architecture

### Endpoint: `GET /api/projects/team-breakdown?projectId={id}`
* **Authorization**: Authenticated session with role `Admin`, `CEO`, or `PM`.
* **Input**: Query parameter `projectId` (integer).
* **Database Operations**:
  1. Retrieve project overview metadata (`id`, `name`, `description`, `is_fast_track`, `target_date`, `created_by`, `creator_name`).
  2. Fetch all assigned members for the project from `project_members` + `users`.
  3. Fetch all tasks for the project and map them to assignees (using both `task_assignees` multi-assignee table and `tasks.assigned_to`).
  4. Aggregate for each employee:
     * `total_tasks`: Count of tasks assigned.
     * `completed_tasks`: Status IN (`'Completed'`, `'Tested (PASS)'`, `'Ready for Demo'`).
     * `in_progress_tasks`: Status = `'In Progress'`.
     * `pending_tasks`: Status = `'Pending'`.
     * `qa_tasks`: Status IN (`'Sent to Testing'`, `'Tested (FAIL)'`).
     * `completion_ratio`: Percentage `(completed_tasks / total_tasks) * 100` (rounded, 0 if 0 tasks).
     * `tasks`: Array of task items (`id`, `title`, `description`, `priority`, `status`, `progress_percentage`, `due_date`, `task_link`, `task_links`, `blockers`).

---

## 3. UI/UX Design

### Location: `src/app/dashboard/projects/page.tsx`
* **Trigger**:
  * New dedicated action button in the project row: `<Button variant="outline" size="sm">👥 Team Breakdown</Button>`
  * Clicking on the "Tasks & Progress" or "Assigned Team" cell also directly opens the modal for quick inspection.
* **Modal Layout (`Dialog` / Slide-in Drawer)**:
  * **Header**: Project Name, Dev Mode badge (`⚡ Fastest Dev` / `Standard QA`), Target Date, and Creator tag.
  * **Top Metrics Bar**:
    * Total Assigned Members
    * Total Project Tasks
    * Completed Tasks & Overall Completion Ratio (%)
    * In Progress / QA counts
  * **Employee Filter & Search**: Search bar to quickly filter by developer/tester name.
  * **Employee Workload Cards (Responsive Grid)**:
    * Avatar, Full Name, and Role badge (`Developer`, `Tester`, `PM`).
    * Large Completion Ratio metric (`85%`) with a dynamic colored progress bar (`emerald-500` for 100%, `sky-500` for >0%, `slate-300` for 0%).
    * Breakdown chips: `✓ Completed: X`, `⚡ Active: Y`, `⏳ Pending: Z`, `🧪 In QA: W`.
    * Collapsible Task List with full details:
      * Priority pill (High / Medium / Low)
      * Task status badge
      * Self-reported progress slider `%`
      * Blocker warning callout if any blocker exists
      * Task specification / PR link
* **Mobile Responsiveness**: Stacks gracefully into single-column cards on smaller viewports with full touch support.

---

## 4. Error Handling & Edge Cases
* **No Members Assigned**: Shows a clean empty state with an invite/assign prompt.
* **Member With 0 Tasks**: Shows `0 Tasks Assigned (0%)` with an encouraging note to assign tasks in Daily Tasks Hub.
* **Permission Rejection**: Returns `403 Forbidden` if a non-manager role attempts direct API access.
