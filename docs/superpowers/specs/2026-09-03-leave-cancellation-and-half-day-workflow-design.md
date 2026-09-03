# Leave Cancellation & Half Day Application Workflow Design

## Overview
This specification details the end-to-end design for:
1. Fixing the Half Day leave request flow so employee applications properly reach PM, Admin, and CEO with explicit Half Day indicators, management notifications, and accurate 1-click approvals.
2. Allowing employees to directly cancel unapproved (pending) leave requests.
3. Enabling employees to raise a cancellation request for approved leaves, which PM, Admin, and CEO can review, approve (restoring quota), or reject.

---

## 1. Database Schema Changes

### `attendance` Table
Modify the `status` column from the restricted enum to `VARCHAR(50)` to allow new workflow states without column truncate/enum rejection errors.

```sql
ALTER TABLE attendance 
MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Present';
```

Supported statuses:
- `Present`, `Present (Overtime)`
- `Absent`
- `Holiday`
- `Leave` (Full Day Approved)
- `Half Day` (Half Day Approved)
- `Leave (Pending)` (Unapproved Full Day Leave)
- `Half Day (Pending)` (Unapproved Half Day Leave)
- `Leave (Cancel Requested)` (Full Day Approved Leave awaiting Cancellation Approval)
- `Half Day (Cancel Requested)` (Half Day Approved Leave awaiting Cancellation Approval)
- `Leave (Rejected)` (Rejected Leave Application)

---

## 2. API Architecture

### 2.1 `POST /api/attendance` (Leave Application)
- **Input**: `{ action: "leave", selected_dates: [...], status: "Leave" | "Half Day", reason: string }`
- **Logic**:
  - Non-management employees submitting `status === "Half Day"` have their record created/updated with:
    - `status = 'Half Day (Pending)'`
    - `notes = 'PENDING_HALF_DAY: ' + reason`
  - Non-management employees submitting full-day leave:
    - `status = 'Leave (Pending)'`
    - `notes = 'PENDING_LEAVE: ' + reason`
  - **Notifications**:
    - Query active users with role in `('PM', 'Admin', 'CEO')`.
    - Insert notification for each management user (and/or with `target_role`):
      - Title: `status === 'Half Day' ? '🌓 New Half Day Leave Application' : '🏖️ New Leave Application'`
      - Message: `${employeeName} requested a ${status === 'Half Day' ? 'Half Day' : 'Leave'} for ${dateStr}.${reason ? ' Reason: ' + reason : ''}`
      - Type: `'info'`

### 2.2 `POST /api/attendance/leave-cancel` (Employee Direct Cancel for Unapproved Leave)
- **Authentication**: Session required.
- **Input**: `{ id: number }`
- **Logic**:
  - Fetch attendance record by `id`.
  - Validate that `record.user_id === session.user.id` (or user is Management).
  - Validate that `status IN ('Leave (Pending)', 'Half Day (Pending)')` or `status LIKE '%Pending%'`.
  - Delete attendance record (`DELETE FROM attendance WHERE id = ?`).
  - Send notification to PM, Admin, CEO:
    - Title: `🚫 Leave Application Cancelled`
    - Message: `${employeeName} cancelled their pending ${isHalfDay ? 'Half Day' : 'Leave'} application for ${dateStr}.`
    - Type: `'warning'`
  - Return `{ success: true, message: "Leave application cancelled successfully" }`.

### 2.3 `POST /api/attendance/leave-cancel-request` (Employee Raise Cancel Request for Approved Leave)
- **Authentication**: Session required.
- **Input**: `{ id: number, reason: string }`
- **Logic**:
  - Fetch attendance record by `id`.
  - Validate that `record.user_id === session.user.id`.
  - Validate that record date is upcoming or today (`date >= todayIST`).
  - Validate that status is currently approved: `Leave` or `Half Day` or `Sick Leave`.
  - Determine new status:
    - If `status === 'Half Day'` -> `Half Day (Cancel Requested)`
    - Else -> `Leave (Cancel Requested)`
  - Update attendance record:
    - `status = newStatus`
    - `notes = CONCAT(IFNULL(notes, ''), ' [CANCEL_REQUEST: ', reason, ']')`
  - Send notification to PM, Admin, CEO:
    - Title: `⚠️ Leave Cancellation Request`
    - Message: `${employeeName} requested to cancel their approved ${record.status} on ${dateStr}. Reason: ${reason}`
    - Type: `'warning'`
  - Return `{ success: true, message: "Cancellation request submitted for management review" }`.

### 2.4 `GET /api/attendance/leave-action` (Management Pending Queue)
- Query all records where:
  `status LIKE '%Pending%' OR status LIKE '%Cancel Requested%'`
- Return enriched records with:
  - `is_half_day`: boolean based on status/notes
  - `is_cancel_request`: boolean (`status LIKE '%Cancel Requested%'`)
  - `clean_reason`: parsed note string without internal prefix tags

### 2.5 `POST /api/attendance/leave-action` (Management Action Handler)
- **Actions**:
  1. `approve`:
     - If record is `Half Day (Pending)` -> set `status = 'Half Day'`.
     - If record is `Leave (Pending)` -> set `status = leave_type || 'Leave'`.
     - Notify employee that leave was approved.
  2. `reject`:
     - Set `status = 'Leave (Rejected)'`.
     - Notify employee that leave was rejected.
  3. `approve_cancel`:
     - For `Leave (Cancel Requested)` or `Half Day (Cancel Requested)`:
     - Delete the attendance record (`DELETE FROM attendance WHERE id = ?`).
     - This automatically restores the employee's paid leave quota and returns the day to a normal workday.
     - Notify employee: `🏖️ Leave Cancellation Approved. Your leave for ${dateStr} has been cancelled.`
  4. `reject_cancel`:
     - Revert `status` back to `Half Day` (if previous was half day) or `Leave`.
     - Append note: `[Cancel Rejected by ${userName}: ${reason}]`.
     - Notify employee: `❌ Leave Cancellation Rejected. Your request to cancel leave on ${dateStr} was rejected by ${userName}.`

---

## 3. Frontend User Interface

### 3.1 Employee Views (`src/app/dashboard/attendance/page.tsx`)
1. **Pending Leaves Banner**:
   - For each pending leave, display a badge indicating `🌓 Half Day (Pending)` or `🏖️ Full Day (Pending)`.
   - Include a **"Cancel Request"** button (with SweetAlert2 confirmation) to cancel immediately.
2. **Recent Attendance Records Table**:
   - Rows with pending leaves display a **"Cancel Request"** button.
   - Rows with approved leaves (`Leave` or `Half Day` where `date >= today`) display a **"Request Cancellation"** button.
   - Rows with `Cancel Requested` display a badge `⚠️ Cancel Requested (Awaiting PM)`.
3. **Cancellation Request Modal**:
   - Prompt employee for reason for cancelling the approved leave.

### 3.2 Management Views (PM, Admin, CEO)
1. **Pending Employee Leave Applications Card**:
   - Table displays:
     - **Employee Name & Role**
     - **Date**
     - **Leave Type Badge**:
       - `🌓 Half Day (Pending)` (Amber)
       - `🏖️ Full Day (Pending)` (Sky)
       - `⚠️ Cancellation Request` (Rose / Red)
     - **Reason**: Formatted cleanly.
     - **Actions**:
       - For `Pending`: **"Approve"** (automatically approves according to requested type) & **"Reject"**.
       - For `Cancellation Request`: **"Approve Cancellation"** (Emerald) & **"Reject Cancellation"** (Red).

---

## 4. Verification & Testing Plan
1. Run database migration script to modify `attendance.status` to `VARCHAR(50)`.
2. Apply for a Half Day leave as an employee and verify:
   - Database record is saved with `Half Day (Pending)`.
   - PM, Admin, CEO receive in-app notifications.
   - PM/Admin/CEO queue shows `🌓 Half Day (Pending)`.
3. Test direct cancellation of pending leave:
   - Employee clicks "Cancel Request".
   - Confirm record is deleted and notification sent.
4. Test approved leave cancellation flow:
   - Management approves a leave.
   - Employee sees approved leave and clicks "Request Cancellation".
   - Status transitions to `Cancel Requested` and management is notified.
   - Management approves cancellation -> record deleted, leave balance restored.
   - Management rejects cancellation -> record remains approved.
5. Verify build integrity (`npm run build`).
