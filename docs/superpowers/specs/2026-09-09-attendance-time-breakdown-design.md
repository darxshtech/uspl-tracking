# Design Spec: Attendance Time Breakdown
Date: 2026-09-09
Feature: Office Hours, Net Work Time, Task Hours & Break Detail — Table + Calendar View

## 1. Problem Statement

The attendance table and calendar show employees shift hours as a single number — it does not distinguish:
- The Office Hours window (when did they arrive / leave)
- Gross shift time (raw duration from check-in to check-out)
- Net work time (gross minus all break time)
- Task hours (time logged against specific tasks)
- Break detail (each break session: when it started, ended, how long)

## 2. Data Sources

All data is already in the database — no schema changes needed:

| Data | Table/Field |
|---|---|
| Office Hours window | attendance.login_time to attendance.logout_time |
| Gross shift hours | attendance.total_hours |
| Total break minutes | SUM(attendance_breaks.duration_minutes) where break_end IS NOT NULL |
| Per-break sessions | attendance_breaks (break_start, break_end, duration_minutes, paused_task_id) |
| Task hours worked | task_time_logs (duration_minutes, task_id to task.title) grouped by DATE |

Net Work Time formula:
  net_minutes = (total_hours x 60) - total_break_minutes

## 3. Design: Table View — 3 New Columns

Replace current Total Shift Hours + Break Time columns with:
1. Office Hours — check-in arrow check-out (e.g. 09:30 AM to 06:30 PM)
2. Net Work — Gross minus Breaks. Color-coded green/amber/red
3. Break — total break time or On Break badge (unchanged)

Color coding for Net Work Time:
- Green (>= full_day_hours, default 9h)
- Amber (>= half_day_min_hours, < full_day)
- Red (< half_day_min_hours)

## 4. Design: View Detail Modal (Enhanced)

Sections:
1. Office Hours block — Check-In, Check-Out, Total Shift Duration
2. Time Breakdown block — Gross Shift | Break Time | Net Work | Task Hours
3. Break Sessions list — Each break: start time, end time, duration, paused task name
4. Tasks Worked Today list — Task title + hours from task_time_logs

Loading: Modal opens with static data immediately. A secondary fetch hits
/api/attendance/record-detail?attendance_id=X and populates break sessions + task list.

## 5. New API Endpoint

GET /api/attendance/record-detail?attendance_id=123

Authorization:
- Management: can fetch any record
- Developer/Tester: can only fetch their own records

Response shape:
{
  breaks: [{ id, break_start_formatted, break_end_formatted, duration_minutes, paused_task_title }],
  total_break_minutes: 45,
  task_logs: [{ task_id, task_title, project_name, total_minutes }],
  total_task_minutes: 390
}

## 6. Design: Calendar View Enrichment

Calendar day cell currently shows: Employee name | hours | check-in to check-out

Enhanced cell adds (computed client-side from existing data):
- Net Work: net_min = total_hours*60 - total_break_minutes displayed as Xh XXm
- Break icon: coffee icon + Xm if breaks > 0
- Clickable: clicking employee pill opens the same View Detail Modal

No extra API calls needed for calendar enrichment — total_break_minutes already returned
by the attendance API in the attendanceRecords array.

## 7. Files Changed

NEW:
- src/app/api/attendance/record-detail/route.ts

MODIFIED:
- src/app/dashboard/attendance/page.tsx (table columns + modal + secondary fetch)
- src/components/AttendanceCalendarView.tsx (enriched cell + click-to-detail modal)

## 8. Success Criteria

1. Management sees break-by-break timeline and task log in View modal
2. Employees see their own daily breakdown
3. Calendar cell shows net work + break icon inline
4. No regression in leave management, edit, or override flows
5. Active shift shows live net work time
