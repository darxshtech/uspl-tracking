# System Enhancements Design Specification: Attendance, Cloudinary Docs, Daily Work, Task Lifecycle (Plan/Work/Test/Demo), Project Assignments & Profiles

**Date**: 2026-08-14  
**Author**: Antigravity AI  
**Status**: Approved & Updated  

---

## 1. Overview
This specification details the comprehensive enhancements across the Unitglo Employee Tracking System:
1. **Attendance Engine Overhaul**: CEO attendance exemption, removal of legacy Wi-Fi constraints, 12h India Time (IST AM/PM) timestamps, strict single-day validation with PM security alerts.
2. **PM Attendance Management & Reporting**: Employee-wise monthly logs, manual time/hour editing with audit notices, and monthly Excel (.xlsx) / PDF exports with direct email delivery from PM to employee.
3. **UI Dropdown & Select Rendering Fix (Images 1 & 2)**:
   - Fix transparent background and layering conflict.
   - Fix Select component so the selected Project Name and Developer Name display cleanly in the trigger input instead of numeric IDs (`1`, `7`, etc.).
4. **Cloudinary Project Documentation & Attachments**: Upload and store PDFs, Excel sheets, and docs links to Cloudinary; grant access to assigned team members.
5. **Project Assignment & Real-Time Alerts**:
   - When PM/CEO assigns a project to a Developer/Tester, an instant alert notification is triggered.
   - The project immediately appears in the Developer's dashboard and project list.
6. **Developer Task Lifecycle & Sub-tasks Flow**:
   - **Start Plan**: Mark task as planned with checklist / plan milestones.
   - **Start Work**: Move to active execution, log progress and sub-tasks completed (e.g. `3/5 sub-tasks completed (60%)`).
   - **Daily Tasks & Work Logging**: Developer logs daily progress against project tasks.
   - **Send for Testing**: Once completed, developer submits task for QA audit.
7. **Tester QA Audit & "Submit to Demo" Alert**:
   - Tester marks task as PASS or FAIL with observations.
   - If PASS, it activates the **"Submit to Demo"** action flag.
   - Clicking "Submit to Demo" immediately fires a high-priority alert to **PM and CEO** ("Project Demo Ready").
8. **User Profile & Tenure Management**: Dedicated `/dashboard/profile` page allowing employees and managers to update their avatar photos (Cloudinary), bio/activities, view joining date/year, and see automatically calculated company tenure (e.g. "2 Years, 4 Months").

---

## 2. Component Design & Task State Machine

### 2.1 Task Status State Machine
```
[Created / Assigned] 
       ↓ (Developer clicks "Start Plan")
   [Planning]
       ↓ (Developer clicks "Start Work")
  [In Progress] (Sub-tasks creation & progress % completion)
       ↓ (Developer clicks "Send for Testing")
[Ready for Testing]
       ↓ (Tester audits)
   [Testing] → (FAIL: "Changes Required" → back to Developer)
       ↓ (PASS)
   [Tested / PASS]
       ↓ (Click "Submit to Demo")
 [Ready for Demo] → (Instant High-Priority Notification to PM & CEO)
       ↓ (PM/CEO final sign-off)
   [Completed]
```

### 2.2 Select Dropdown Fix (Images 1 & 2)
- Overhaul `Select` and `SelectTrigger` / `SelectValue` to ensure:
  1. Solid opaque white background (`bg-white dark:bg-slate-900 border border-slate-200 shadow-xl z-50`).
  2. Selected label resolution: Renders human-readable text (`Alpha System`, `Alex Developer (Developer)`) instead of raw values (`1`, `7`).

---

## 3. Database Schema Changes

```sql
-- Alter attendance table
ALTER TABLE attendance 
  MODIFY COLUMN login_time VARCHAR(30) NULL,
  MODIFY COLUMN logout_time VARCHAR(30) NULL;

-- Alter projects table
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS documentation_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS attachments JSON NULL;

-- Alter users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS bio TEXT NULL,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS joining_date DATE NULL DEFAULT '2024-01-15';

-- Update tasks table status enum to support full lifecycle
ALTER TABLE tasks 
  MODIFY COLUMN status ENUM(
    'Created', 
    'Assigned', 
    'Planning', 
    'In Progress', 
    'Ready for Testing', 
    'Testing', 
    'Changes Required', 
    'Tested (PASS)', 
    'Ready for Demo', 
    'Completed', 
    'Cancelled'
  ) DEFAULT 'Created';
```
