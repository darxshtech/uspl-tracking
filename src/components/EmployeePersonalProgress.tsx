"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        fetch("/api/tasks?_=" + Date.now()),
        fetch("/api/projects?_=" + Date.now()),
      ]);
      const tasksData = await tasksRes.json();
      const projectsData = await projectsRes.json();

      if (Array.isArray(tasksData)) setTasks(tasksData);
      if (Array.isArray(projectsData)) setProjects(projectsData);
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

    // Auto-refresh every 6 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 6000);

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
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "Completed" || t.status === "Ready for Demo" || t.status === "Tested (PASS)").length;
  const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalHoursSpent = tasks.reduce((sum, t) => sum + (parseFloat(t.hours_spent) || 0), 0);

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
        Loading personal progress report...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Progress Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-sky-500" />
              My Daily Progress & Deliverables Summary
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>Real-time breakdown of tasks completed across all your assigned projects</span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span suppressHydrationWarning>Live Sync: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="h-8 px-2.5 text-xs font-bold gap-1 text-slate-700 hover:text-sky-600 bg-white shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-sky-600" : ""}`} />
              Refresh
            </Button>
            <Link href="/dashboard/tasks">
              <Button size="sm" className="h-8 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 shadow-xs">
                <CheckSquare className="h-4 w-4" /> Go to Daily Tasks
              </Button>
            </Link>
          </div>
        </div>

        {/* Metric Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Assigned Projects</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{assignedProjects.length}</div>
          </div>

          <div className="p-3.5 bg-sky-50/70 rounded-xl border border-sky-200">
            <span className="text-[11px] font-bold text-sky-700 uppercase">Tasks Completed</span>
            <div className="text-2xl font-black text-sky-900 mt-1">
              {completedTasks} <span className="text-xs font-semibold text-sky-600">/ {totalTasks} ({overallPct}%)</span>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Total Hours Logged</span>
            <div className="text-2xl font-black text-emerald-900 mt-1">{totalHoursSpent.toFixed(1)} hrs</div>
          </div>

          <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200">
            <span className="text-[11px] font-bold text-purple-700 uppercase">Overall Completion</span>
            <div className="text-2xl font-black text-purple-900 mt-1">{overallPct}%</div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span>Overall Task Completion Rate</span>
            <span>{overallPct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-500 ${
                overallPct === 100
                  ? "bg-emerald-500"
                  : overallPct >= 50
                  ? "bg-sky-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </div>

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
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{task.title}</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1">{task.priority}</Badge>
                          {task.assigned_by_type && (
                            <Badge className="bg-slate-200 text-slate-700 text-[10px] py-0 px-1">
                              {task.assigned_by_type}
                            </Badge>
                          )}
                        </div>
                        {task.blockers && (
                          <span className="text-red-600 font-medium text-[11px] block">
                            ⚠️ Blocker: {task.blockers}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="font-bold text-slate-700">{task.progress_percentage || 0}% Done</span>
                        {task.hours_spent > 0 && (
                          <span className="text-slate-500 font-semibold">{task.hours_spent} hrs</span>
                        )}
                        <Badge className={
                          task.status === "Completed" || task.status === "Tested (PASS)"
                            ? "bg-emerald-500 text-white"
                            : task.status === "Changes Required"
                            ? "bg-red-500 text-white"
                            : "bg-sky-500 text-white"
                        }>
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
