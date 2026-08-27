import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import CEOFilterDashboard from "@/components/CEOFilterDashboard";
import EmployeePersonalProgress from "@/components/EmployeePersonalProgress";
import RemindersWidget from "@/components/RemindersWidget";
import { Briefcase, CheckCircle, Clock, ShieldAlert, UserX, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role || "User";
  const userId = (session?.user as any)?.id;
  const isExecutive = ["Admin", "CEO", "PM"].includes(role);
  const isTester = role === "Tester";

  let projectCount = 0;
  let taskCount = 0;
  let readyForTestCount = 0;
  let completedCount = 0;
  let idleDeveloperCount = 0;

  try {
    if (isExecutive) {
      const [pRows]: any = await pool.query("SELECT COUNT(*) as cnt FROM projects");
      projectCount = pRows[0]?.cnt || 0;

      const [tRows]: any = await pool.query("SELECT COUNT(*) as cnt FROM tasks");
      taskCount = tRows[0]?.cnt || 0;

      const [rRows]: any = await pool.query("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'Ready for Testing'");
      readyForTestCount = rRows[0]?.cnt || 0;

      const [cRows]: any = await pool.query("SELECT COUNT(*) as cnt FROM tasks WHERE status IN ('Completed', 'Tested (PASS)', 'Ready for Demo')");
      completedCount = cRows[0]?.cnt || 0;

      // Count Developers and Testers with 0 active in-progress tasks
      const [idleRows]: any = await pool.query(`
        SELECT COUNT(u.id) AS cnt
        FROM users u
        WHERE u.role IN ('Developer', 'Tester')
        AND u.id NOT IN (
          SELECT DISTINCT t.assigned_to 
          FROM tasks t 
          WHERE t.assigned_to IS NOT NULL 
          AND t.status IN ('In Progress', 'Planning', 'Ready for Testing', 'Testing', 'Changes Required')
          UNION
          SELECT DISTINCT ta.user_id
          FROM task_assignees ta
          JOIN tasks t ON ta.task_id = t.id
          WHERE t.status IN ('In Progress', 'Planning', 'Ready for Testing', 'Testing', 'Changes Required')
        )
      `);
      idleDeveloperCount = idleRows[0]?.cnt || 0;
    } else if (isTester) {
      const [pRows]: any = await pool.query(
        "SELECT COUNT(DISTINCT project_id) as cnt FROM project_members WHERE user_id = ?",
        [userId]
      );
      projectCount = pRows[0]?.cnt || 0;

      const [tRows]: any = await pool.query(
        "SELECT COUNT(*) as cnt FROM tasks WHERE status IN ('Ready for Testing', 'Testing', 'Changes Required', 'Tested (PASS)', 'Ready for Demo')"
      );
      taskCount = tRows[0]?.cnt || 0;

      const [rRows]: any = await pool.query("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'Ready for Testing'");
      readyForTestCount = rRows[0]?.cnt || 0;

      const [cRows]: any = await pool.query("SELECT COUNT(*) as cnt FROM tasks WHERE status IN ('Tested (PASS)', 'Ready for Demo', 'Completed')");
      completedCount = cRows[0]?.cnt || 0;
    } else {
      // Developer / regular team member
      const [pRows]: any = await pool.query(
        "SELECT COUNT(DISTINCT project_id) as cnt FROM (SELECT project_id FROM project_members WHERE user_id = ? UNION SELECT project_id FROM tasks WHERE assigned_to = ?) as combined",
        [userId, userId]
      );
      projectCount = pRows[0]?.cnt || 0;

      const [tRows]: any = await pool.query("SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to = ?", [userId]);
      taskCount = tRows[0]?.cnt || 0;

      const [rRows]: any = await pool.query(
        "SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to = ? AND status = 'Ready for Testing'",
        [userId]
      );
      readyForTestCount = rRows[0]?.cnt || 0;

      const [cRows]: any = await pool.query(
        "SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to = ? AND status IN ('Completed', 'Tested (PASS)', 'Ready for Demo')",
        [userId]
      );
      completedCount = cRows[0]?.cnt || 0;
    }
  } catch (err) {
    console.error("Error fetching dashboard counts:", err);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold uppercase tracking-wider border border-sky-500/30">
            {role} Portal
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Welcome back, {session?.user?.name}!
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            {isExecutive
              ? "Unitglo Solutions Executive Dashboard: Monitor project initiatives, track idle developers, review deliverables, and audit QA verification pipelines."
              : "Track your active initiatives, manage daily task completion, and coordinate testing hand-offs."}
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className={`grid gap-5 ${isExecutive ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-2 lg:grid-cols-4"}`}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isExecutive ? "Total Projects" : "My Projects"}
            </span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-500 group-hover:bg-sky-500 group-hover:text-white transition-colors">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3">{projectCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isExecutive ? "Active company initiatives" : "Initiatives you are contributing to"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isExecutive ? "Total Tasks" : isTester ? "Testing Queue Tasks" : "My Tasks"}
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3">{taskCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isExecutive ? "Managed tasks across team" : isTester ? "Tasks in QA pipeline" : "Tasks assigned / created"}
          </p>
        </div>

        {/* Executive Exclusive: Idle / Available Developers without active tasks */}
        {isExecutive && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">No Active Tasks</span>
              <div className={`p-2 rounded-xl transition-colors ${idleDeveloperCount > 0 ? "bg-amber-500 text-white shadow-xs animate-bounce" : "bg-amber-100 text-amber-600"}`}>
                <UserX className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-amber-950 mt-3">{idleDeveloperCount}</div>
            <p className="text-[11px] font-semibold text-amber-700 mt-1">
              {idleDeveloperCount > 0 ? "⚠️ Devs / Testers on Bench" : "✓ Full Team Actively Allocated"}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ready for Testing</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3">{readyForTestCount}</div>
          <p className="text-[11px] text-purple-600 font-semibold mt-1">Awaiting QA verification</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Passed & Done</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3">{completedCount}</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Verified pass rate</p>
        </div>
      </div>

      <RemindersWidget role={role} currentUserId={userId} />

      {/* Conditional Dashboard Rendering */}
      {isExecutive ? (
        <CEOFilterDashboard />
      ) : (
        <EmployeePersonalProgress />
      )}
    </div>
  );
}
