import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import CEOFilterDashboard from "@/components/CEOFilterDashboard";
import EmployeePersonalProgress from "@/components/EmployeePersonalProgress";
import { Briefcase, CheckCircle, Clock, ShieldAlert } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role || "User";
  const userId = (session?.user as any)?.id;
  const isExecutive = ["Admin", "CEO", "PM"].includes(role);

  let projectCount = 0;
  let taskCount = 0;
  let readyForTestCount = 0;
  let completedCount = 0;

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
    } else {
      const [pRows]: any = await pool.query(
        "SELECT COUNT(DISTINCT project_id) as cnt FROM tasks WHERE assigned_to = ?",
        [userId]
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
    console.error(err);
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
              ? "Unitglo Solutions Executive Dashboard: Monitor project progress, review developer task deliverables, and audit QA verification pipelines."
              : "Track your active initiatives, manage daily task completion, and coordinate testing hand-offs."}
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isExecutive ? "Total Projects" : "My Projects"}
            </span>
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-500 group-hover:bg-sky-500 group-hover:text-white transition-colors">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-4">{projectCount}</div>
          <p className="text-xs text-slate-500 mt-1">
            {isExecutive ? "Active company initiatives" : "Initiatives you are contributing to"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isExecutive ? "Total Tasks" : "My Tasks"}
            </span>
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-4">{taskCount}</div>
          <p className="text-xs text-slate-500 mt-1">
            {isExecutive ? "Managed tasks across team" : "Tasks assigned / created"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ready for Testing</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-4">{readyForTestCount}</div>
          <p className="text-xs text-amber-600 font-semibold mt-1">Awaiting QA verification</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Passed & Completed</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-4">{completedCount}</div>
          <p className="text-xs text-emerald-600 font-semibold mt-1">Verified task pass rate</p>
        </div>
      </div>

      {/* Conditional Dashboard Rendering */}
      {isExecutive ? (
        <CEOFilterDashboard />
      ) : (
        <EmployeePersonalProgress />
      )}
    </div>
  );
}
