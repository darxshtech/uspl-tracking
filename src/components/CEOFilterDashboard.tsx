"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  RefreshCw,
  Sliders,
  UserX,
  Plus,
  ArrowRight,
  Sparkles,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { showToast, showError, showSuccess, showWarning } from "@/lib/swal";
import { formatHoursAndMinutes } from "@/lib/timeUtils";

export default function CEOFilterDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [halfDayWarnings, setHalfDayWarnings] = useState<any[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Shift Working Hours Policy State
  const [fullDayPolicyHours, setFullDayPolicyHours] = useState<number>(9);
  const [policyInputHours, setPolicyInputHours] = useState<string>("9");
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Filters
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedAssignee, setSelectedAssignee] = useState("ALL");
  const [activeWorkloadTab, setActiveWorkloadTab] = useState<"all" | "active" | "idle">("all");

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data && data.full_day_hours) {
        setFullDayPolicyHours(data.full_day_hours);
        setPolicyInputHours(data.full_day_hours.toString());
      }
    } catch (_) {}
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(policyInputHours);
    if (isNaN(parsed) || parsed <= 0 || parsed > 24) {
      showWarning("Invalid Value", "Please enter a valid number between 1 and 24 hours.");
      return;
    }

    setSavingPolicy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_day_hours: parsed }),
      });
      const data = await res.json();
      if (res.ok) {
        setFullDayPolicyHours(parsed);
        setPolicyModalOpen(false);
        showSuccess("Policy Updated", `Full-day required working hours set to ${parsed} hours for all employees.`);
      } else {
        showError("Update Failed", data.error || "Failed to update settings");
      }
    } catch (err) {
      showError("Error", "Could not save policy setting.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [tRes, pRes, eRes, aRes, sRes] = await Promise.all([
        fetch("/api/tasks?_=" + Date.now()),
        fetch("/api/projects?_=" + Date.now()),
        fetch("/api/employees?_=" + Date.now()),
        fetch("/api/attendance?_=" + Date.now()),
        fetch("/api/settings?_=" + Date.now()),
      ]);

      const [tData, pData, eData, aData, sData] = await Promise.all([
        tRes.json(),
        pRes.json(),
        eRes.json(),
        aRes.json(),
        sRes.json(),
      ]);

      let policyHours = 9;
      if (sData && sData.full_day_hours) {
        policyHours = sData.full_day_hours;
        setFullDayPolicyHours(sData.full_day_hours);
        setPolicyInputHours(sData.full_day_hours.toString());
      }

      if (Array.isArray(tData)) setTasks(tData);
      if (Array.isArray(pData)) setProjects(pData);
      if (Array.isArray(eData)) setEmployees(eData);

      // Compute Half Day Shift Warnings for all employees from their previous shift
      if (aData && Array.isArray(aData.attendance) && Array.isArray(eData)) {
        const currentDate = aData.currentDate || new Date().toISOString().split("T")[0];
        const warnings: any[] = [];

        eData.forEach((emp: any) => {
          if (emp.role === "CEO" || emp.role === "Admin") return;
          const empLogs = aData.attendance.filter(
            (rec: any) =>
              (String(rec.user_id) === String(emp.id) || String(rec.employee_id) === String(emp.id)) &&
              rec.logout_time &&
              rec.date &&
              !rec.date.startsWith(currentDate)
          );

          if (empLogs.length > 0) {
            const latestClosed = empLogs[0];
            const hours = parseFloat(latestClosed.total_hours || 0);
            if (latestClosed.status === "Half Day" || (latestClosed.total_hours !== null && hours < policyHours)) {
              const dateStr = latestClosed.date instanceof Date 
                ? latestClosed.date.toISOString().split("T")[0] 
                : String(latestClosed.date).split("T")[0];
              warnings.push({
                employeeId: emp.id,
                employeeName: emp.name,
                employeeRole: emp.role,
                date: dateStr,
                hours: hours,
                status: latestClosed.status,
              });
            }
          }
        });

        setHalfDayWarnings(warnings);
      }

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

    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchData();
    }, 15000);

    const handleFocus = () => fetchData();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchData]);

  // Helper to check if task is assigned to employee (single or multi-assignee)
  const isTaskAssignedToEmployee = (task: any, empId: number) => {
    if (String(task.assigned_to) === String(empId)) return true;
    if (Array.isArray(task.assignees)) {
      return task.assignees.some((a: any) => String(a.id) === String(empId));
    }
    return false;
  };

  // Helper to check if task is actively being worked on
  const isActiveTask = (status: string) => {
    return ["In Progress", "Planning", "Ready for Testing", "Testing", "Changes Required"].includes(status);
  };

  // Build Comprehensive Employee Progress Matrix
  const employeeProgressList = useMemo(() => {
    return employees.map((emp) => {
      const empTasks = tasks.filter((t) => isTaskAssignedToEmployee(t, emp.id));
      const empProjectsCount = new Set(empTasks.map((t) => t.project_id).filter(Boolean)).size;
      
      const empCompleted = empTasks.filter((t) => 
        ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)
      ).length;
      
      const empActiveTasks = empTasks.filter((t) => isActiveTask(t.status));
      const empInProgress = empTasks.filter((t) => t.status === "In Progress" || t.status === "Planning").length;
      const empBlocked = empTasks.filter((t) => t.blockers && t.status !== "Completed" && t.status !== "Ready for Demo").length;
      const empTotalHours = empTasks.reduce((sum, t) => sum + (parseFloat(t.hours_spent) || 0), 0);
      const empRate = empTasks.length > 0 ? Math.round((empCompleted / empTasks.length) * 100) : 0;
      
      const isDevOrTester = emp.role === "Developer" || emp.role === "Tester";
      const hasNoActiveTasks = isDevOrTester && empActiveTasks.length === 0;

      // Last task details
      const lastTask = empTasks.length > 0 ? empTasks[0] : null;

      return {
        ...emp,
        totalTasks: empTasks.length,
        assignedProjectsCount: empProjectsCount,
        completedCount: empCompleted,
        activeTasksCount: empActiveTasks.length,
        inProgressCount: empInProgress,
        blockedCount: empBlocked,
        totalHours: empTotalHours,
        completionRate: empRate,
        hasNoActiveTasks,
        lastTask,
      };
    });
  }, [employees, tasks]);

  // List of Developers & Testers with NO active tasks
  const idleEmployees = useMemo(() => {
    return employeeProgressList.filter((emp) => emp.hasNoActiveTasks);
  }, [employeeProgressList]);

  // Filtered employee matrix based on search / filter tab
  const filteredEmployeeMatrix = useMemo(() => {
    return employeeProgressList.filter((emp) => {
      const matchAssignee = selectedAssignee === "ALL" || String(emp.id) === String(selectedAssignee);
      if (!matchAssignee) return false;

      if (activeWorkloadTab === "active") {
        return emp.activeTasksCount > 0;
      }
      if (activeWorkloadTab === "idle") {
        return emp.hasNoActiveTasks;
      }
      return true;
    });
  }, [employeeProgressList, selectedAssignee, activeWorkloadTab]);

  // Filter tasks based on selections
  const filteredTasks = tasks.filter((t) => {
    const matchProject = selectedProject === "ALL" || String(t.project_id) === String(selectedProject);
    const matchStatus = selectedStatus === "ALL" || t.status === selectedStatus;
    const matchAssignee = selectedAssignee === "ALL" || isTaskAssignedToEmployee(t, parseInt(selectedAssignee, 10));
    return matchProject && matchStatus && matchAssignee;
  });

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
      {/* 1. BENCH / UNASSIGNED DEVELOPERS ALERT MONITOR */}
      {idleEmployees.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 p-5 shadow-md shadow-amber-500/5 animate-fade-in relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-amber-500 text-white shrink-0 shadow-md shadow-amber-500/20 ring-4 ring-amber-100">
                <UserX className="h-6 w-6" />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                    ⚠️ Idle / Unassigned Staff Alert
                  </span>
                  <span className="text-xs font-bold text-amber-950 bg-amber-200/80 px-2.5 py-0.5 rounded-md border border-amber-300">
                    {idleEmployees.length} {idleEmployees.length === 1 ? "Employee" : "Employees"} Currently Have No Active Task
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                    Staff Available for Work Allocation
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    The following developers or testers do not have any task currently <strong>In Progress</strong> or <strong>In QA</strong>:
                  </p>
                </div>
              </div>
            </div>

            <Link href="/dashboard/tasks">
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 shadow-md shrink-0">
                <Plus className="h-4 w-4 text-sky-400" /> Go to Daily Tasks Hub to Assign
              </Button>
            </Link>
          </div>

          {/* Idle Employee Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-3 border-t border-amber-200/80">
            {idleEmployees.map((emp) => (
              <div
                key={emp.id}
                className="p-3 rounded-xl bg-white border border-amber-200 shadow-xs flex items-center justify-between gap-3 hover:border-amber-400 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-bold flex items-center justify-center text-xs shrink-0">
                    {emp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate flex items-center gap-1.5">
                      <span className="truncate">{emp.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-800 border-amber-200 shrink-0">
                        {emp.role}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-amber-700 font-semibold mt-0.5 truncate">
                      {emp.totalTasks > 0 ? `${emp.completedCount}/${emp.totalTasks} Done (Idle)` : "No tasks assigned"}
                    </p>
                  </div>
                </div>

                <Link href={`/dashboard/tasks`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shrink-0"
                    title={`Assign task to ${emp.name}`}
                  >
                    + Assign
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Half Day Shift Warnings Banner */}
      {!bannerDismissed && halfDayWarnings.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 p-5 shadow-lg shadow-amber-500/10 animate-fade-in relative overflow-hidden backdrop-blur-xs">
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-amber-500 text-white shrink-0 shadow-md shadow-amber-500/30 ring-4 ring-amber-100">
                <AlertTriangle className="h-6 w-6 animate-pulse" />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                    ⚠️ Half-Day Shift Alert
                  </span>
                  <span className="text-xs font-bold text-amber-950 bg-amber-200/80 px-2.5 py-0.5 rounded-md border border-amber-300">
                    {halfDayWarnings.length} {halfDayWarnings.length === 1 ? "Team Member" : "Team Members"} Recorded &lt;{fullDayPolicyHours}h on Previous Shift
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                    Previous Shift Attendance Warning: Shift threshold (&lt;{fullDayPolicyHours} hrs) not reached
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    The following employees completed less than the required full-day <strong>{fullDayPolicyHours} hours</strong> on their last shift:
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {halfDayWarnings.map((w, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-slate-800 shadow-xs hover:border-amber-400 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      <span className="text-slate-900 font-extrabold">{w.employeeName}</span>
                      <span className="text-slate-500 text-[11px] font-normal">({w.employeeRole})</span>
                      <span className="text-amber-800 font-extrabold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-[11px]">
                        {w.hours.toFixed(1)} hrs completed ({w.date})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end lg:self-center">
              <Link href="/dashboard/warnings">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-md shadow-amber-600/20">
                  <AlertTriangle className="h-3.5 w-3.5" /> Manage & Resend Warnings
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPolicyModalOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs gap-1.5 shadow-xs border-slate-300"
              >
                <Sliders className="h-3.5 w-3.5 text-sky-600" />
                Adjust Policy ({fullDayPolicyHours}h)
              </Button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Real-time KPI Summary & Daily/Monthly Visual Progress Charts */}
      <DailyMonthlyProgressSummary tasks={tasks} onRefresh={() => fetchData(false)} />

      {/* 4. Filter Control Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Filter className="h-4 w-4 text-sky-500" />
            Filter Projects, Tasks & Employee Progress Matrix
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mr-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span suppressHydrationWarning>Live Sync: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>

            {/* Shift Working Hours Policy Config Modal */}
            <Dialog open={policyModalOpen} onOpenChange={setPolicyModalOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" className="h-8 px-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs gap-1.5 shadow-xs border-slate-300" />}>
                <Sliders className="h-3.5 w-3.5 text-sky-600" /> Shift Policy ({fullDayPolicyHours}h)
              </DialogTrigger>
              <DialogContent className="w-[92vw] sm:max-w-sm max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Sliders className="h-5 w-5 text-sky-600" />
                    Configure Full-Day Shift Policy
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSavePolicy} className="space-y-4 pt-2">
                  <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 text-xs text-sky-900 space-y-1">
                    <span className="font-bold block">Company Attendance Policy</span>
                    <p className="text-[11px] text-sky-800 leading-snug">
                      Shifts completed below this threshold will automatically be recorded as <strong>Half Day</strong> and alert the employee.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="policyHours" className="font-bold text-slate-900 text-xs">
                      Required Full-Day Working Hours (e.g. 9 or 8) *
                    </Label>
                    <Input
                      id="policyHours"
                      type="number"
                      step="0.5"
                      min="1"
                      max="24"
                      value={policyInputHours}
                      onChange={(e) => setPolicyInputHours(e.target.value)}
                      className="text-base font-bold"
                      required
                    />
                    <p className="text-[11px] text-slate-500">
                      Currently active threshold: <strong>{fullDayPolicyHours} hours / day</strong>
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={savingPolicy}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 shadow-sm"
                  >
                    {savingPolicy ? "Saving Policy..." : "Update Full-Day Policy"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

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

      {/* 5. Employee Progress Breakdown Matrix with Workload Tabs */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-500" />
              Live Employee Deliverables & Workload Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditing employee active tasks, completed ratios, and bench availability.
            </p>
          </div>

          {/* Workload Status Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("all")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                activeWorkloadTab === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Staff ({employeeProgressList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("active")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${
                activeWorkloadTab === "active" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle className="h-3 w-3" /> Active ({employeeProgressList.filter(e => e.activeTasksCount > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("idle")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${
                activeWorkloadTab === "idle" ? "bg-amber-500 text-white shadow-2xs" : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              <AlertCircle className="h-3 w-3" /> No Active Tasks ({idleEmployees.length})
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Team Member</TableHead>
                <TableHead className="font-bold">Role</TableHead>
                <TableHead className="font-bold text-center">Workload Status</TableHead>
                <TableHead className="font-bold text-center">Projects</TableHead>
                <TableHead className="font-bold text-center">Total Tasks</TableHead>
                <TableHead className="font-bold text-center">Completed</TableHead>
                <TableHead className="font-bold text-center">In Progress</TableHead>
                <TableHead className="font-bold text-center">Hours Logged</TableHead>
                <TableHead className="font-bold text-right">Completion Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">Calculating live team metrics...</TableCell></TableRow>
              ) : filteredEmployeeMatrix.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-10">No employees match the selected workload filter.</TableCell></TableRow>
              ) : (
                filteredEmployeeMatrix.map((emp) => (
                  <TableRow key={emp.id} className={`transition-colors ${emp.hasNoActiveTasks ? "bg-amber-50/30 hover:bg-amber-50/60" : "hover:bg-slate-50/80"}`}>
                    <TableCell className="font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center ${
                          emp.hasNoActiveTasks ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-sky-100 text-sky-800"
                        }`}>
                          {emp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{emp.name}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline" className="font-semibold text-[11px]">{emp.role}</Badge>
                    </TableCell>

                    {/* Workload Status Badge */}
                    <TableCell className="text-center">
                      {emp.hasNoActiveTasks ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                          ⚠️ On Bench (0 Active)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ⚡ {emp.activeTasksCount} Active {emp.activeTasksCount === 1 ? "Task" : "Tasks"}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-center font-bold text-slate-800">{emp.assignedProjectsCount}</TableCell>
                    <TableCell className="text-center font-bold text-slate-900">{emp.totalTasks}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        {emp.completedCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {emp.inProgressCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                          {emp.inProgressCount}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-900 text-xs">
                      {formatHoursAndMinutes(emp.totalHours)}
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

      {/* 6. Filtered Tasks Table */}
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
                    <TableCell className="align-top font-bold text-slate-900 text-xs">{formatHoursAndMinutes(t.hours_spent)}</TableCell>
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
