"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Filter, 
  CheckCircle2, 
  Briefcase, 
  Clock, 
  ShieldCheck, 
  User, 
  TrendingUp, 
  AlertTriangle,
  Flame,
  Users,
  RefreshCw
} from "lucide-react";
import { showToast } from "@/lib/swal";

export default function CEOFilterDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Filters
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedAssignee, setSelectedAssignee] = useState("ALL");

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [tRes, pRes, eRes] = await Promise.all([
        fetch("/api/tasks?_=" + Date.now()),
        fetch("/api/projects?_=" + Date.now()),
        fetch("/api/employees?_=" + Date.now()),
      ]);

      const [tData, pData, eData] = await Promise.all([
        tRes.json(),
        pRes.json(),
        eRes.json(),
      ]);

      if (Array.isArray(tData)) setTasks(tData);
      if (Array.isArray(pData)) setProjects(pData);
      if (Array.isArray(eData)) setEmployees(eData);
      setLastUpdated(new Date());

      if (isManual) {
        showToast("Dashboard metrics refreshed!");
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 6 seconds to keep numbers live in real-time
    const interval = setInterval(() => {
      fetchData();
    }, 6000);

    // Refresh on window refocus
    const handleFocus = () => fetchData();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchData]);

  // Filter tasks based on selections
  const filteredTasks = tasks.filter((t) => {
    const matchProject = selectedProject === "ALL" || String(t.project_id) === String(selectedProject);
    const matchStatus = selectedStatus === "ALL" || t.status === selectedStatus;
    const matchAssignee = selectedAssignee === "ALL" || String(t.assigned_to) === String(selectedAssignee);
    return matchProject && matchStatus && matchAssignee;
  });

  const completedCount = filteredTasks.filter((t) => 
    t.status === "Completed" || t.status === "Ready for Demo" || t.status === "Tested (PASS)"
  ).length;
  const inProgressCount = filteredTasks.filter((t) => t.status === "In Progress" || t.status === "Planning").length;
  const readyForTestingCount = filteredTasks.filter((t) => t.status === "Ready for Testing" || t.status === "Testing").length;
  const changesRequiredCount = filteredTasks.filter((t) => t.status === "Changes Required").length;
  const completionRate = filteredTasks.length > 0 ? Math.round((completedCount / filteredTasks.length) * 100) : 0;

  // Build Employee Progress Breakdown Matrix with robust type matching
  const employeeProgressList = employees.map((emp) => {
    const empTasks = tasks.filter((t) => String(t.assigned_to) === String(emp.id));
    const empProjectsCount = new Set(empTasks.map((t) => t.project_id).filter(Boolean)).size;
    const empCompleted = empTasks.filter((t) => 
      t.status === "Completed" || t.status === "Ready for Demo" || t.status === "Tested (PASS)"
    ).length;
    const empInProgress = empTasks.filter((t) => t.status === "In Progress" || t.status === "Planning").length;
    const empBlocked = empTasks.filter((t) => t.blockers && t.status !== "Completed" && t.status !== "Ready for Demo").length;
    const empTotalHours = empTasks.reduce((sum, t) => sum + (parseFloat(t.hours_spent) || 0), 0);
    const empRate = empTasks.length > 0 ? Math.round((empCompleted / empTasks.length) * 100) : 0;

    return {
      ...emp,
      totalTasks: empTasks.length,
      assignedProjectsCount: empProjectsCount,
      completedCount: empCompleted,
      inProgressCount: empInProgress,
      blockedCount: empBlocked,
      totalHours: empTotalHours,
      completionRate: empRate,
    };
  }).filter((emp) => selectedAssignee === "ALL" || String(emp.id) === String(selectedAssignee));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Planning":
        return <Badge className="bg-purple-600 text-white font-bold">Planning</Badge>;
      case "In Progress":
        return <Badge className="bg-sky-500 text-white font-bold">In Progress</Badge>;
      case "Ready for Testing":
        return <Badge className="bg-amber-500 text-white font-bold animate-pulse">Ready for Testing</Badge>;
      case "Tested (PASS)":
        return <Badge className="bg-emerald-600 text-white font-bold">Tested (PASS)</Badge>;
      case "Ready for Demo":
        return <Badge className="bg-indigo-600 text-white font-bold shadow-xs">🚀 Ready for Demo</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-500 text-white font-bold">Completed</Badge>;
      case "Changes Required":
        return <Badge className="bg-red-500 text-white font-bold">Changes Required (FAIL)</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Control Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Filter className="h-4 w-4 text-sky-500" />
            Filter Projects, Tasks & Employee Progress Matrix
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span suppressHydrationWarning>Live Sync: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
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
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase">Project</label>
            <Select value={selectedProject} onValueChange={(val) => setSelectedProject(val || "ALL")}>
              <SelectTrigger><SelectValue placeholder="All Projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase">Assigned Employee</label>
            <Select value={selectedAssignee} onValueChange={(val) => setSelectedAssignee(val || "ALL")}>
              <SelectTrigger><SelectValue placeholder="All Team Members" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Team Members</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase">Task Status</label>
            <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val || "ALL")}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="Planning">Planning</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Ready for Testing">Ready for Testing</SelectItem>
                <SelectItem value="Changes Required">Changes Required</SelectItem>
                <SelectItem value="Tested (PASS)">Tested (PASS)</SelectItem>
                <SelectItem value="Ready for Demo">Ready for Demo</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Filtered Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Filtered Tasks</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{filteredTasks.length}</div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase">Completed</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{completedCount} ({completionRate}%)</div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-center shadow-xs">
          <span className="text-[11px] font-bold text-sky-700 uppercase">In Progress</span>
          <div className="text-2xl font-black text-sky-900 mt-1">{inProgressCount}</div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-center shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase">In Testing</span>
          <div className="text-2xl font-black text-amber-900 mt-1">{readyForTestingCount}</div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-center shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-red-700 uppercase">QA Rejections</span>
          <div className="text-2xl font-black text-red-900 mt-1">{changesRequiredCount}</div>
        </div>
      </div>

      {/* EMPLOYEE PROGRESS MATRIX */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-sky-500" />
            Team Member Progress & Initiative Completion Matrix
          </h2>
          <Badge variant="outline" className="text-xs font-semibold">
            {employeeProgressList.length} Team Members
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employeeProgressList.map((emp) => (
            <div key={emp.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                  <Badge variant="outline" className="text-[10px] mt-0.5">{emp.role}</Badge>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-sky-900">{emp.completionRate}%</div>
                  <span className="text-[10px] font-semibold text-slate-500">Done</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-300 ${
                    emp.completionRate === 100 ? "bg-emerald-500" : emp.completionRate >= 50 ? "bg-sky-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${emp.completionRate}%` }}
                />
              </div>

              {/* Metrics Pills */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs pt-1">
                <div className="p-1.5 bg-white rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Tasks</span>
                  <span className="font-bold text-slate-900">{emp.completedCount}/{emp.totalTasks}</span>
                </div>
                <div className="p-1.5 bg-white rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Projects</span>
                  <span className="font-bold text-slate-900">{emp.assignedProjectsCount}</span>
                </div>
                <div className="p-1.5 bg-white rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Hours</span>
                  <span className="font-bold text-slate-900">{emp.totalHours.toFixed(1)}</span>
                </div>
              </div>

              {emp.blockedCount > 0 && (
                <div className="p-1.5 rounded bg-red-50 border border-red-200 text-[11px] text-red-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  {emp.blockedCount} Task(s) Blocked
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filtered Tasks Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Task & Progress</TableHead>
              <TableHead className="font-bold">Project</TableHead>
              <TableHead className="font-bold">Assigned To</TableHead>
              <TableHead className="font-bold">Priority</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold">Created By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6">Loading tasks...</TableCell></TableRow>
            ) : filteredTasks.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No tasks match the selected filters.</TableCell></TableRow>
            ) : (
              filteredTasks.map((t) => (
                <TableRow key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell>
                    <div className="font-bold text-slate-900">{t.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Progress: <strong>{t.progress_percentage || 0}%</strong>
                      {t.hours_spent > 0 && ` • ${t.hours_spent} hrs logged`}
                    </div>
                    {t.blockers && (
                      <div className="text-[11px] text-red-600 font-semibold mt-0.5">
                        ⚠️ Blocker: {t.blockers}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600 font-medium text-xs">{t.project_name || "N/A"}</TableCell>
                  <TableCell className="text-slate-700 font-semibold text-xs">{t.assignee_name || "Unassigned"}</TableCell>
                  <TableCell><Badge variant="outline">{t.priority}</Badge></TableCell>
                  <TableCell>{getStatusBadge(t.status)}</TableCell>
                  <TableCell className="text-slate-500 text-xs">{t.creator_name || "System"} ({t.creator_role || "PM"})</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
