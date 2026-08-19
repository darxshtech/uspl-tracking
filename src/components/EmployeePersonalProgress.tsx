"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DailyMonthlyProgressSummary from "@/components/DailyMonthlyProgressSummary";
import { 
  Briefcase, 
  CheckSquare, 
  Clock, 
  Flame, 
  Calendar, 
  ExternalLink, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  RefreshCw 
} from "lucide-react";
import Link from "next/link";
import { showToast } from "@/lib/swal";

export default function EmployeePersonalProgress() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [yesterdayHalfDay, setYesterdayHalfDay] = useState<any>(null);
  const [fullDayHours, setFullDayHours] = useState<number>(9);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [tasksRes, projectsRes, attActiveRes] = await Promise.all([
        fetch("/api/tasks?_=" + Date.now()),
        fetch("/api/projects?_=" + Date.now()),
        fetch("/api/attendance/active?_=" + Date.now()),
      ]);
      const tasksData = await tasksRes.json();
      const projectsData = await projectsRes.json();
      const attActiveData = await attActiveRes.json();

      if (Array.isArray(tasksData)) setTasks(tasksData);
      if (Array.isArray(projectsData)) setProjects(projectsData);
      if (attActiveData) {
        if (attActiveData.fullDayHours) setFullDayHours(attActiveData.fullDayHours);
        if (attActiveData.yesterdayHalfDay) setYesterdayHalfDay(attActiveData.yesterdayHalfDay);
        else setYesterdayHalfDay(null);
      }
      setLastUpdated(new Date());

      if (isManual) {
        showToast("Progress report refreshed!");
      }
    } catch (err) {
      console.error("Personal progress fetch error:", err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 20 seconds
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchData();
    }, 20000);

    const handleFocus = () => fetchData();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchData]);

  // Group tasks by project
  const projectMap: Record<string, any> = {};
  projects.forEach((p) => {
    projectMap[String(p.id)] = {
      ...p,
      tasks: [],
      completedCount: 0,
      inProgressCount: 0,
      blockedCount: 0,
      totalHours: 0,
    };
  });

  tasks.forEach((t) => {
    const pId = String(t.project_id);
    if (projectMap[pId]) {
      projectMap[pId].tasks.push(t);
      if (t.status === "Completed" || t.status === "Ready for Demo" || t.status === "Tested (PASS)") {
        projectMap[pId].completedCount += 1;
      } else if (t.blockers && t.status !== "Completed") {
        projectMap[pId].blockedCount += 1;
      } else {
        projectMap[pId].inProgressCount += 1;
      }
      projectMap[pId].totalHours += parseFloat(t.hours_spent) || 0;
    }
  });

  const assignedProjects = Object.values(projectMap).filter((p) => p.tasks.length > 0);

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
        Loading personal progress report...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Yesterday's / Previous Shift Half Day Warning Banner */}
      {yesterdayHalfDay && !bannerDismissed && (
        <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50 p-4 sm:p-5 shadow-sm animate-fade-in relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0 border border-amber-300 shadow-2xs">
                <AlertTriangle className="h-6 w-6 text-amber-600 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-200/90 text-amber-900 border border-amber-300">
                    ⚠️ Attendance Notice
                  </span>
                  <span className="text-xs font-bold text-amber-900">
                    Previous Shift ({yesterdayHalfDay.date})
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-extrabold text-amber-950">
                  You received a Half Day on your last shift ({parseFloat(yesterdayHalfDay.hours).toFixed(1)} hrs completed, &lt;{fullDayHours} hrs required).
                </h4>
                <p className="text-xs text-amber-800 font-medium">
                  Please make sure to complete your full <strong>{fullDayHours} hours</strong> today to maintain full day attendance.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Link href="/dashboard/attendance">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs">
                  View Attendance
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="text-xs text-amber-700 hover:text-amber-950 font-bold px-2 py-1 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Progress Summary & Daily/Monthly Visual Charts */}
      <DailyMonthlyProgressSummary tasks={tasks} onRefresh={() => fetchData(false)} />

      {/* Project-Wise Breakdown Cards */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-sky-500" />
          Project-Wise Deliverables & Task Status
        </h3>

        {assignedProjects.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
            No active project tasks assigned yet. Check your Daily Tasks board or ask PM/CEO to assign initiatives.
          </div>
        ) : (
          assignedProjects.map((p) => {
            const pTotal = p.tasks.length;
            const pPct = pTotal > 0 ? Math.round((p.completedCount / pTotal) * 100) : 0;

            return (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>{p.name}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <UserCheck className="h-3 w-3 text-sky-500" />
                      <span>Assigned By: <strong>{p.creator_name || "Management"} ({p.creator_role || "PM"})</strong></span>
                      {p.target_date && <span className="ml-2">• Target: {new Date(p.target_date).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <span className="font-bold text-slate-900">{p.completedCount} of {pTotal} tasks finished</span>
                    <span className="text-slate-500 font-semibold ml-2">({pPct}%)</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 ${
                      pPct === 100 ? "bg-emerald-500" : pPct >= 50 ? "bg-sky-500" : "bg-amber-500"
                    }`}
                    style={{ width: `${pPct}%` }}
                  />
                </div>

                {/* Tasks List within this project */}
                <div className="space-y-1.5 pt-1">
                  {p.tasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs gap-2"
                    >
                      <div className="space-y-0.5 max-w-md">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{task.title}</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1">{task.priority}</Badge>
                        </div>
                        {task.description && (
                          <p className="text-slate-600 text-xs whitespace-pre-wrap break-words leading-relaxed">
                            {task.description}
                          </p>
                        )}
                        {task.daily_summary && (
                          <p className="text-sky-700 text-[11px] font-medium">
                            📝 Summary: {task.daily_summary}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {task.hours_spent > 0 && (
                          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-sky-500" /> {task.hours_spent}h
                          </span>
                        )}
                        <Badge
                          className={
                            task.status === "Completed"
                              ? "bg-emerald-500 text-white font-bold"
                              : task.status === "Ready for Demo"
                              ? "bg-indigo-600 text-white font-bold animate-pulse"
                              : task.status === "Tested (PASS)"
                              ? "bg-emerald-600 text-white font-bold"
                              : task.status === "Ready for Testing"
                              ? "bg-amber-500 text-white font-bold"
                              : task.status === "Changes Required"
                              ? "bg-red-500 text-white font-bold"
                              : "bg-sky-500 text-white font-bold"
                          }
                        >
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
