# Design Specification: Attendance Timer Consistency, Leave Approval Workflow, QA Self-Testing & Task Enhancements

**Date**: 2026-08-21  
**Status**: Approved / Ready for Implementation  
**Topic**: Attendance Timer & Leave Management, Task Prefilling, PM Assignment by Name, Developer QA Self-Test Logging & Fast-Track Direct Submission to PM/CEO

---

## 1. Executive Summary & Goals

This specification defines 7 integrated features and bug fixes across the tracking portal:
1. **Attendance Page Timer & Consistency**: Bring identical check-in/out modal dialogs, real-time live running timer, overnight support, and half-day previous shift warnings from the header `AttendanceWidget` to the Attendance page (`/dashboard/attendance`).
2. **Select Component Infinite Loop Fix**: Fix the `Maximum update depth exceeded` error in `src/components/ui/select.tsx` by memoizing `registerLabel` and stabilizing `SelectItem` callbacks.
3. **Leave Management & Approval Workflow**: Fix the `405 Method Not Allowed` on `/api/attendance` by implementing employee leave request submissions with pending status, automatic notifications to PMs, CEOs, and Admins, and 1-click Approve/Reject actions in `PMAttendanceManager`.
4. **Developer Self-Testing QA Log**: In the "Send to QA Testing" modal, prompt whether the developer self-tested the task, store `is_developer_tested` (Yes/No), and display this log badge on task cards and in the QA Testing Station.
5. **Fast-Track Direct Submit to PM/CEO**: Provide a direct submit option to set task status directly to `Ready for Demo`, bypassing QA with the specific hover title for fast-paced development.
6. **Assign By PM Name in Daily Tasks**: Allow selecting a specific Project Manager by name when assigning tasks in create and edit modals.
7. **Task Edit Modal Prefilling**: Ensure all task fields (title, description, project, assignee, priority, status, target date, assigned by PM, hours spent, progress %, blockers, remarks) are completely prefilled when opened.

---

## 2. Detailed Technical Architecture

### 2.1 UI Select Component Fix (`src/components/ui/select.tsx`)
- Wrap `registerLabel` in `useCallback(..., [])` to avoid reference churn.
- Optimize `useEffect` inside `SelectItem` with stable references so re-renders don't trigger cascading state updates.

### 2.2 Attendance Page & Timer Consistency (`src/app/dashboard/attendance/page.tsx`)
- Replace simple punch buttons with:
  - **Check-In Modal**: Custom IST time picker, required shift hours calculation, and yesterday's half-day alert.
  - **Live Running Timer Badge**: Real-time timer showing `⏱️ In Shift (Checked in: HH:MM:SS AM/PM)` with elapsed hours and overnight moon icon (`🌙`).
  - **Check-Out Modal**: Custom time picker, overnight shift toggle, < 9-hour early checkout warning alert, and calculated total hours.
  - **Shift Done Badge**: Finalized total shift hours badge when checked out.
- Ensure consistent offline sync with `localStorage` matching `AttendanceWidget`.

### 2.3 Leave Request & Management Approval Flow (`/api/attendance`, `PMAttendanceManager.tsx`)
- Add `POST` handler to `/api/attendance`:
  - When employee applies for leave, insert attendance record(s) with `status = 'Leave (Pending)'` and save reason.
  - Insert notification for PMs, CEOs, and Admins (`role IN ('PM', 'CEO', 'Admin')` or target_role) indicating employee name, dates, leave type, and reason.
- In `PMAttendanceManager.tsx`:
  - Display pending leave requests clearly in a dedicated approval section/card.
  - Provide 1-click **Approve** (`status = 'Leave'`) and **Reject** (`status = 'Absent'` or deleted) actions.
  - Send feedback notification to the employee upon decision.

### 2.4 Developer Self-Testing QA Handoff Log (`tasks/page.tsx`, `testing/page.tsx`, `/api/tasks`)
- Add `is_developer_tested` (`TINYINT(1)`) support in `tasks` table / migration.
- In `testingModalOpen` (Send to QA Testing modal):
  - Add radio / checkbox selection: `Did you self-test and verify this task before handing off? (Yes / No)`.
  - Send `is_developer_tested` to `PATCH /api/tasks` with `action: "send_to_testing"`.
- Display badge on task cards and in `src/app/dashboard/testing/page.tsx`:
  - `Developer Tested: Yes ✓` (Emerald) or `Developer Tested: No ⚠️` (Amber).

### 2.5 Fast-Track Direct Submit to PM/CEO (`tasks/page.tsx`, `/api/tasks`)
- Add "Fast-Track Direct Submit" action button for developers on in-progress tasks.
- Hover title: `"for fastest development project which tester doesn't know about so developer can submit them as fast as soon to their PM and CEO"`.
- Sets task status directly to **`Ready for Demo`**, progress to `100%`, sets `direct_submitted = 1`, and creates notifications for the PM and CEO.

### 2.6 Daily Tasks: Assign By Specific PM by Name
- In Create Task & Edit Task modals:
  - When "PM" is chosen under "Task Assigned By", render a sub-select or dynamic list of all Project Managers fetched from `/api/employees` (filtered by role === 'PM').
  - Store as `assigned_by_type = 'PM: [PM Name]'` or `assigned_by_name = '[PM Name]'`.
  - Display assigned PM name on task cards and in task detail views.

### 2.7 Prefill Task Details in Edit Modal
- In `openEditTaskModal(task)`:
  - Populate all existing values: `title`, `description`, `project_id`, `assigned_to`, `priority`, `status`, `target_date`, `assigned_by_type`, `progress_percentage`, `hours_spent`, `blockers`, `remarks`.
  - Ensure custom dropdown values align cleanly with `Select` components.

---

## 3. Database Schema Updates
- Ensure `tasks` table includes:
  - `is_developer_tested TINYINT(1) DEFAULT 0`
  - `direct_submitted TINYINT(1) DEFAULT 0`
  - `assigned_by_name VARCHAR(100) DEFAULT NULL`

---

## 4. Verification & Testing Plan
1. **Console Error Verification**: Check browser console on `/dashboard/attendance` to verify zero `Maximum update depth exceeded` errors.
2. **Attendance Timer Verification**: Perform Check-In on `/dashboard/attendance`, verify live running timer appears and matches header `AttendanceWidget`. Verify Check-Out modal works with time picker.
3. **Leave Application Verification**: Apply for leave as an employee, verify no 405 error, check PM/CEO notifications, and verify Approve/Reject in `PMAttendanceManager`.
4. **Self-Testing QA Log Verification**: Send task to QA with "Self Tested = Yes", verify badge on task card and in QA testing queue station.
5. **Fast-Track Direct Submit Verification**: Click fast-track direct submit, verify hover title, verify status changes to `Ready for Demo` without tester queue.
6. **PM Assignment & Edit Modal Verification**: Create task assigned by specific PM name, open edit modal and verify all fields are prefilled.
