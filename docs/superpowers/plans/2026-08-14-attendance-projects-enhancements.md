# Implementation Plan: Full System Enhancements & Task Lifecycle (Plan/Work/Test/Demo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the tracking system with CEO attendance exemption, 12h IST punch format, strict current-day validation with PM security alerts, PM monthly attendance management with editing and Excel/PDF/Email export, fix UI dropdown transparency glitches and select label display (Images 1 & 2), Cloudinary project documentation/file attachments, team member assignment by CEO/PM with developer alerts, complete Developer Task Lifecycle (Start Plan -> Start Work -> Daily Sub-tasks -> Send for Testing -> Tester PASS -> Submit to Demo -> PM/CEO Alert), Daily Work logging page (`/dashboard/work`), and User Profile & Company Tenure page (`/dashboard/profile`).

**Architecture:** Next.js App Router (React 19, TypeScript), MySQL with connection pooling, NextAuth.js session auth, Cloudinary SDK with local fallback, XLSX & jsPDF export, Nodemailer service.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, MySQL (mysql2), NextAuth, XLSX, jsPDF, jspdf-autotable, Cloudinary, Nodemailer.

---

### Task 1: Fix UI Dropdown Transparency & Select Label Display (Images 1 & 2)
**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/select.tsx`

- [ ] Add missing theme CSS tokens (`--popover`, `--popover-foreground`, `--border`, `--card`) in `globals.css`.
- [ ] Refactor `Select` and `SelectTrigger`/`SelectValue` in `select.tsx` to ensure selected project and developer text render accurately instead of numeric IDs (`1`, `7`), with solid white opaque popup styling (`bg-white dark:bg-slate-900 border border-slate-200 shadow-xl z-50`).

---

### Task 2: Install Dependencies & Update Database Schema
**Files:**
- Modify: `package.json`
- Modify: `scripts/init-db.js`
- Create: `scripts/update-schema.js`

- [ ] Install `xlsx`, `jspdf`, `jspdf-autotable`, `cloudinary`, `nodemailer`, `@types/nodemailer`.
- [ ] Modify `attendance` table: update `login_time` and `logout_time` to `VARCHAR(30)`.
- [ ] Modify `projects` table: add `documentation_url TEXT` and `attachments JSON`.
- [ ] Modify `users` table: add `avatar_url VARCHAR(500)`, `bio TEXT`, `phone VARCHAR(50)`, `joining_date DATE`.
- [ ] Modify `tasks` table: extend `status` enum to include `Planning`, `In Progress`, `Ready for Testing`, `Testing`, `Changes Required`, `Tested (PASS)`, `Ready for Demo`, `Completed`.
- [ ] Run migration script and verify MySQL schema update.

---

### Task 3: Project Member Assignment & Developer Alert Flow
**Files:**
- Modify: `src/app/api/projects/route.ts`
- Modify: `src/app/dashboard/projects/page.tsx`

- [ ] PM/CEO creates/updates project with member assignments.
- [ ] Automatically dispatch notification alert to assigned Developers and Testers.
- [ ] Display documentation links and Cloudinary attachments for assigned members.

---

### Task 4: Developer Task Lifecycle (Plan/Work/Sub-tasks/Test/Demo)
**Files:**
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/dashboard/tasks/page.tsx`
- Modify: `src/app/dashboard/testing/page.tsx`

- [ ] Implement Task status flow:
  - Developer clicks "Start Plan" -> status becomes `Planning`.
  - Developer clicks "Start Work" -> status becomes `In Progress`.
  - Developer creates sub-tasks / checklists with progress tracking (e.g. `4/5 done - 80%`).
  - Developer clicks "Send for Testing" -> moves to QA queue.
  - Tester audits: if PASS -> marks `Tested (PASS)` and activates "Submit to Demo".
  - Clicking "Submit to Demo" sets status to `Ready for Demo` and fires instant high-priority notification to **PM and CEO**.

---

### Task 5: Revamp Attendance Backend & CEO Exemption
**Files:**
- Modify: `src/app/api/attendance/route.ts`
- Modify: `src/app/api/attendance/active/route.ts`
- Modify: `src/components/AttendanceWidget.tsx`
- Modify: `src/app/dashboard/attendance/page.tsx`

- [ ] Hide `AttendanceWidget` and punch controls for CEO.
- [ ] Strip Wi-Fi check.
- [ ] Record punch timestamps in 12-hour format with AM/PM (India IST).
- [ ] Enforce strict server-side current date validation with PM/CEO security alerts.
- [ ] Calculate `total_hours` elapsed from check-in to check-out.

---

### Task 6: PM Attendance Management, Time Editing & Multi-Format Export
**Files:**
- Create: `src/components/PMAttendanceManager.tsx`
- Create: `src/app/api/attendance/manage/route.ts`
- Create: `src/app/api/attendance/export-email/route.ts`
- Modify: `src/app/dashboard/attendance/page.tsx`

- [ ] Build PM employee-wise filter (Employee, Month, Year).
- [ ] Build PM modal to edit punch times, status, and recalculate total hours with audit notification.
- [ ] Implement Excel export (`.xlsx`) using `xlsx`.
- [ ] Implement PDF export (`.pdf`) using `jspdf` and `jspdf-autotable`.
- [ ] Implement "Send to Employee Email" endpoint and button using `nodemailer`.

---

### Task 7: Cloudinary Upload API
**Files:**
- Create: `src/app/api/upload/route.ts`

- [ ] Implement multipart file uploader supporting Cloudinary with local fallback to `/public/uploads`.

---

### Task 8: Daily Work Module
**Files:**
- Create: `src/app/api/work/route.ts`
- Create: `src/app/dashboard/work/page.tsx`

- [ ] Build `/api/work` endpoint to support logging, fetching, and filtering daily work logs.
- [ ] Build `/dashboard/work/page.tsx` with daily work submission form for Developers/Testers, and review/filter table for CEO & PM.

---

### Task 9: User Profile & Company Tenure Dashboard
**Files:**
- Create: `src/app/api/profile/route.ts`
- Create: `src/app/dashboard/profile/page.tsx`
- Modify: `src/app/dashboard/layout.tsx`

- [ ] Build `/api/profile` to retrieve and update user photo (avatar), bio, phone, and joining date.
- [ ] Build `/dashboard/profile/page.tsx` with photo uploader, bio editor, joining year/date display, company tenure calculator ("X Years, Y Months"), and recent activity summary.
- [ ] Add Profile navigation link to sidebar and user avatar menu in `layout.tsx`.

---

### Task 10: End-to-End Verification & Walkthrough
- [ ] Open "Create Task" modal: verify select dropdowns show Project and Developer names with solid white background.
- [ ] PM assigns project: verify developer gets alert and sees project.
- [ ] Developer starts plan, starts work, creates sub-tasks, and sends for testing.
- [ ] Tester passes task and submits to demo: verify PM and CEO receive instant notification.
- [ ] PM exports monthly attendance to Excel/PDF and tests email sending.
- [ ] User visits `/dashboard/profile`, uploads avatar, and views company tenure.
