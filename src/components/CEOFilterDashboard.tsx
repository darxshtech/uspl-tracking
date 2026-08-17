"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DailyMonthlyProgressSummary from "@/components/DailyMonthlyProgressSummary";
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
      {/* Real-time KPI Summary & Daily/Monthly Visual Progress Charts */}
      <DailyMonthlyProgressSummary tasks={tasks} onRefresh={() => fetchData(false)} />

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
                <SelectItem value="Testing">Testing</SelectItem>
                <SelectItem value="Changes Required">Changes Required</SelectItem>
                <SelectItem value="Tested (PASS)">Tested (PASS)</SelectItem>
                <SelectItem value="Ready for Demo">Ready for Demo</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Employee Progress Breakdown Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-500" />
            Live Employee Deliverables & Progress Matrix
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            {employeeProgressList.length} Team Members Tracked
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Team Member</TableHead>
                <TableHead className="font-bold">Role</TableHead>
                <TableHead className="font-bold text-center">Projects</TableHead>
                <TableHead className="font-bold text-center">Total Tasks</TableHead>
                <TableHead className="font-bold text-center">Completed</TableHead>
                <TableHead className="font-bold text-center">In Progress</TableHead>
                <TableHead className="font-bold text-center">Blockers</TableHead>
                <TableHead className="font-bold text-center">Hours Logged</TableHead>
                <TableHead className="font-bold text-right">Completion Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">Calculating live team metrics...</TableCell></TableRow>
              ) : employeeProgressList.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-10">No employees match filter.</TableCell></TableRow>
              ) : (
                employeeProgressList.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-bold text-slate-900">{emp.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-semibold text-[11px]">{emp.role}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-800">{emp.assignedProjectsCount}</TableCell>
                    <TableCell className="text-center font-bold text-slate-900">{emp.totalTasks}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        {emp.completedCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                        {emp.inProgressCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {emp.blockedCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                          {emp.blockedCount}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-900 text-xs">
                      {emp.totalHours.toFixed(1)} hrs
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
                          <div
                            className={`h-full ${
                              emp.completionRate === 100
                                ? "bg-emerald-500"
                                : emp.completionRate >= 50
                                ? "bg-sky-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${emp.completionRate}%` }}
                          />
                        </div>
                        <span className="font-black text-slate-900 text-xs">{emp.completionRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Filtered Tasks Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-sky-500" />
            Filtered Tasks & Deliverables ({filteredTasks.length})
          </h3>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Task</TableHead>
                <TableHead className="font-bold">Project</TableHead>
                <TableHead className="font-bold">Assignee</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold">Progress</TableHead>
                <TableHead className="font-bold">Hours</TableHead>
                <TableHead className="font-bold">Blockers / Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading tasks...</TableCell></TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-10">No tasks match criteria.</TableCell></TableRow>
              ) : (
                filteredTasks.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="max-w-xs align-top">
                      <div className="font-bold text-slate-900 text-sm">{t.title}</div>
                      {t.description && (
                        <p className="text-xs text-slate-500 whitespace-pre-wrap break-words mt-0.5 leading-relaxed">
                          {t.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-xs font-semibold text-slate-800">{t.project_name || "N/A"}</TableCell>
                    <TableCell className="align-top text-xs text-slate-700 font-medium">{t.assignee_name || "Unassigned"}</TableCell>
                    <TableCell className="align-top">{getStatusBadge(t.status)}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center gap-2">
                        <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-sky-500 h-full"
                            style={{ width: `${t.progress_percentage || 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">{t.progress_percentage || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top font-bold text-slate-900 text-xs">{parseFloat(t.hours_spent || 0).toFixed(1)} hrs</TableCell>
                    <TableCell className="align-top max-w-xs text-xs">
                      {t.blockers ? (
                        <span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200 inline-block">
                          ⚠️ {t.blockers}
                        </span>
                      ) : t.daily_summary ? (
                        <span className="text-slate-600">{t.daily_summary}</span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
