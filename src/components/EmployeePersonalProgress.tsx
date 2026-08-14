"use client";

import { useState, useEffect } from "react";
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
  TrendingUp
} from "lucide-react";
import Link from "next/link";

export default function EmployeePersonalProgress() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/projects"),
      ]);
      const tasksData = await tasksRes.json();
      const projectsData = await projectsRes.json();

      if (Array.isArray(tasksData)) setTasks(tasksData);
      if (Array.isArray(projectsData)) setProjects(projectsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Group tasks by project
  const projectMap: Record<number, any> = {};
  projects.forEach((p) => {
    projectMap[p.id] = {
      ...p,
      tasks: [],
      completedCount: 0,
      inProgressCount: 0,
      blockedCount: 0,
      totalHours: 0,
    };
  });

  tasks.forEach((t) => {
    const pId = t.project_id;
    if (projectMap[pId]) {
      projectMap[pId].tasks.push(t);
      if (t.status === "Completed" || t.status === "Ready for Demo" || t.status === "Tested (PASS)") {
        projectMap[pId].completedCount += 1;
      } else if (t.blockers) {
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
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time breakdown of tasks completed across all your assigned projects
            </p>
          </div>
          <Link href="/dashboard/tasks">
            <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 shadow-xs">
              <CheckSquare className="h-4 w-4" /> Go to Daily Tasks
            </Button>
          </Link>
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
                      <Badge className={p.status === "Completed" ? "bg-emerald-500 text-white" : "bg-sky-500 text-white"}>
                        {p.status || "In Progress"}
                      </Badge>
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
