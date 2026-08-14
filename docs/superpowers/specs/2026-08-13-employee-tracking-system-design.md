# Employee Tracking System Design Spec

## 1. Goal
Build a Bare Minimum Functional Product (BMFP) for an internal employee progress and task tracking system based on the provided requirements.

## 2. Architecture
- **Framework:** Next.js App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS & shadcn/ui
- **Database:** Local MySQL (XAMPP for development, GoDaddy for production)
- **Authentication:** NextAuth.js (Credentials provider) with bcrypt hashing
- **Deployment:** Vercel

## 3. Data Model
- **users:** id, name, email, password_hash, role (CEO, PM, Developer, Tester), is_active
- **projects:** id, name, description, start_date, target_date, status
- **project_members:** project_id, user_id (many-to-many)
- **tasks:** id, title, description, project_id, created_by, assigned_to, priority, due_date, estimated_hours, status, remarks
- **task_checklists:** id, task_id, item_text, is_completed
- **daily_work:** id, user_id, project_id, task_id, date, hours_worked, work_description, status, remarks
- **attendance:** id, user_id, date, status, login_time, logout_time, total_hours
- **testing_records:** id, task_id, tester_id, test_date, result, remarks

## 4. Workflows & Roles
- **CEO:** Oversight of all projects, tasks, attendance, and employees. Can create projects and employees.
- **PM:** Manages projects, assigns tasks to developers, views team progress. Can create projects, tasks, and employees.
- **Developer:** Works on assigned tasks, updates checklists, logs daily work, updates task status to "Ready for Testing".
- **Tester:** Views testing queue, runs tests, passes/fails tasks, creating testing records. If fail, goes back to developer.

## 5. Security & Isolation
- Pages are protected via NextAuth server-side checks.
- Data access is scoped to the user's role (e.g. Developers only see assigned tasks, Testers only see testing queue).

## 6. Self-Review
- The design meets all core BMFP requirements.
- No microservices or complex ORMs (Prisma) are used, adhering strictly to the constraint of using `mysql2`.
- Animations and modern UI are satisfied via `shadcn/ui` and `lucide-react`.
