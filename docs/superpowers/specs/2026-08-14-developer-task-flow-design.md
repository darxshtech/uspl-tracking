# Developer Task Flow & Testing Handoff Design

## Project Context
The system currently allows PMs/CEOs to create projects and assign them to developers. We need to implement a detailed developer task workflow and a handoff process to QA testers.

## Requirements
1. **Project Assignment Tracking**: Developers need to see *who* assigned a project to them on their dashboard.
2. **Developer Task Creation**: Developers create their own tasks under assigned projects. They cannot create projects.
3. **Today vs Tomorrow Tasks**: When creating a task, developers specify if it's a task for "Today" or "Tomorrow".
4. **Daily Rollover**: When a developer checks in tomorrow, "Tomorrow's" tasks automatically become "Today's" tasks.
5. **Testing Handoff**: When a task is 100% complete, developers can "Send to Testing", providing a "Task Link" (PR or staging URL) for the tester.
6. **Tester Dashboard**: Testers see incoming tasks, including Project Name, PM/CEO who assigned the project, the Developer who completed the task, and the Task Link.

## Proposed Changes

### 1. Database Schema Updates
- **`projects` table**: Add `created_by` (INT) foreign key to track who created/assigned the project.
- **`tasks` table**: Add `task_link` (VARCHAR) to store the URL provided by the developer for testing. Add `target_date` (DATE) to distinguish between "Today" and "Tomorrow" tasks.

### 2. Backend API Updates
- **`POST /api/projects`**: Automatically set `created_by` to the current PM/CEO user ID.
- **`GET /api/projects`**: Join `users` to fetch the `creator_name` (who assigned the project).
- **`POST /api/tasks`**: Allow developers to create tasks. Accept a `target_date` (e.g., today or tomorrow).
- **`PUT /api/tasks/status`**: Add an endpoint for developers to transition a task to `Ready for Testing`, requiring a `task_link` payload.
- **`GET /api/tasks`**: Return tasks filtered by `target_date` for developers (Today vs Tomorrow sections). Include the `task_link` in the response.

### 3. Frontend Updates
- **Developer Dashboard (`/dashboard/projects` & `/dashboard/tasks`)**:
  - Show "Assigned By: [Name]" on project cards.
  - Add "Create Task" button/modal for developers. Modal includes: Project Selection, Task Title, Description, and "Timeline" radio (Today / Tomorrow).
  - Split task view into two sections: "Today's Tasks" and "Tomorrow's Upcoming Tasks".
  - For tasks in "Today", add a "Send to Testing" button (enabled when 100% done / completed). Opens a modal to input `taskLink`.
- **Tester Dashboard (`/dashboard/tasks` for Testers)**:
  - Show tasks in `Ready for Testing`.
  - Display: Project, Assigned By (PM/CEO name), Developer (Assignee name), and a clickable "Task Link".
  - Tester can mark "PASS" or "FAIL" (Changes Required).

## Open Questions / Clarifications Needed
- **Task Rollover**: Is setting a `target_date` sufficient for the "Today vs Tomorrow" logic? If a task is created for "Tomorrow" (e.g., Aug 15), on Aug 15 it naturally becomes "Today's task". If a task from "Today" is incomplete, should it automatically roll over to the next day, or stay overdue?
- **Task Link**: Should the "Task Link" be a mandatory field when sending to testing?

## User Review Required
Please review the proposed flow. If this looks correct, we can proceed with modifying the database schema and implementing the APIs and frontend components.
