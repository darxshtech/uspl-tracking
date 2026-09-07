import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CEOFilterDashboard from "@/components/CEOFilterDashboard";
import { TrendingUp, Award, Calendar } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role || "User";
  const isExecutive = ["Admin", "CEO", "PM"].includes(role);

  if (!session) {
    redirect("/login");
  }

  if (!isExecutive) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center space-y-3 animate-fade-in">
        <h2 className="text-xl font-bold text-red-900">Access Restricted</h2>
        <p className="text-sm text-red-700 max-w-md mx-auto">
          Productivity Analytics & Ideal Employee classification are reserved exclusively for executive leadership (Admin, CEO, and PM).
        </p>
        <div className="pt-2">
          <Link href="/dashboard">
            <Button variant="outline">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Executive Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
                <Award className="h-3.5 w-3.5 text-indigo-400" />
                Executive Leadership Intelligence
              </span>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-700">
                {role} View
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <TrendingUp className="h-7 w-7 text-indigo-400" />
              Employee Productivity & Ideal Tags Analytics Hub
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-3xl">
              Multi-dimensional evaluation based on <strong>Working Shift Time</strong> (Attendance check-in to check-out vs task timer hours), <strong>Task Delivery</strong>, <strong>Subtask Checklists</strong>, and <strong>Project Engagement</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/dashboard/attendance">
              <Button variant="outline" size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Attendance Calendar
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Filterable Analytics Dashboard */}
      <CEOFilterDashboard />
    </div>
  );
}
