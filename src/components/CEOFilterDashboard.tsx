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
  AlertCircle,
  Calendar,
  CalendarDays,
  Hourglass,
  Layers,
  ChevronRight,
  ListTodo
} from "lucide-react";
import { showToast, showError, showSuccess, showWarning } from "@/lib/swal";
import { formatHoursAndMinutes } from "@/lib/timeUtils";
import EmployeeProductivityTag from "@/components/EmployeeProductivityTag";

export default function CEOFilterDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [halfDayWarnings, setHalfDayWarnings] = useState<any[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Productivity Analytics State
  const [productivityPeriod, setProductivityPeriod] = useState<"today" | "week" | "month" | "year">("today");
  const [productivitySummary, setProductivitySummary] = useState<any>(null);
  const [productivityMap, setProductivityMap] = useState<Map<number, any>>(new Map());
  const [selectedTagFilter, setSelectedTagFilter] = useState<"ALL" | "ideal" | "engaged" | "active" | "idle" | "off">("ALL");

  // Shift Working Hours Policy State
  const [fullDayPolicyHours, setFullDayPolicyHours] = useState<number>(8);
  const [policyInputHours, setPolicyInputHours] = useState<string>("8");
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Filters
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedAssignee, setSelectedAssignee] = useState("ALL");
  const [activeWorkloadTab, setActiveWorkloadTab] = useState<"all" | "active" | "incomplete" | "overdue" | "idle">("all");

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

  const fetchProductivity = useCallback(async (period: string) => {
    try {
      const res = await fetch(`/api/analytics/employee-productivity?period=${period}&_=` + Date.now());
      if (res.ok) {
        const data = await res.json();
        setProductivitySummary(data.summary || null);
        const map = new Map<number, any>();
        if (Array.isArray(data.employees)) {
          data.employees.forEach((emp: any) => map.set(emp.id, emp));
        }
        setProductivityMap(map);
      }
    } catch (err) {
      console.error("fetchProductivity error:", err);
    }
  }, []);

  useEffect(() => {
    fetchProductivity(productivityPeriod);
  }, [productivityPeriod, fetchProductivity]);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchData();
      fetchProductivity(productivityPeriod);
    }, 15000);

    const handleFocus = () => {
      fetchData();
      fetchProductivity(productivityPeriod);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchData, fetchProductivity, productivityPeriod]);

  // India Standard Time today string 'YYYY-MM-DD'
  const todayIST = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }, []);

  // Helpers for task statuses
  const isTaskCompleted = (status: string) => {
    return ["Completed", "Ready for Demo", "Tested (PASS)"].includes(status);
  };

  const isTaskPending = (status: string) => {
    return ["Planning", "Ready for Testing"].includes(status);
  };

  const isTaskInProgress = (status: string) => {
    return ["In Progress", "Testing", "Changes Required"].includes(status);
  };

  const isTaskOverdue = (task: any) => {
    if (!task?.target_date || isTaskCompleted(task.status)) return false;
    const cleanTarget = String(task.target_date).split("T")[0];
    return cleanTarget < todayIST;
  };

  const getDaysDifference = (targetDateStr: string | null | undefined, baseDateStr: string = todayIST): number => {
    if (!targetDateStr) return 0;
    const d1 = new Date(targetDateStr.split('T')[0] + "T00:00:00");
    const d2 = new Date(baseDateStr.split('T')[0] + "T00:00:00");
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    const diffTime = d1.getTime() - d2.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDateReadable = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "N/A";
    try {
      const clean = dateStr.split("T")[0];
      const d = new Date(clean + "T00:00:00");
      if (isNaN(d.getTime())) return clean;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch (_) {
      return dateStr;
    }
  };

  // Render deadline badge with countdown or overdue indicator
  const renderDeadlineBadge = (dateStr: string | null | undefined, isFinished: boolean = false) => {
    if (!dateStr) {
      return <span className="text-slate-400 text-xs italic">No deadline set</span>;
    }
    const cleanDate = dateStr.split("T")[0];
    const diff = getDaysDifference(cleanDate, todayIST);
    const formatted = formatDateReadable(cleanDate);

    if (isFinished) {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs font-semibold text-slate-700">{formatted}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
            ✓ Finished
          </Badge>
        </div>
      );
    }

    if (diff < 0) {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs font-bold text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
            {formatted}
          </span>
          <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-1.5 py-0 font-bold whitespace-nowrap animate-pulse">
            🚨 Overdue by {Math.abs(diff)}d
          </Badge>
        </div>
      );
    }

    if (diff === 0) {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-500 shrink-0" />
            {formatted}
          </span>
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0 font-bold whitespace-nowrap">
            ⚠️ Due Today
          </Badge>
        </div>
      );
    }

    if (diff <= 3) {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs font-bold text-amber-900">{formatted}</span>
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold whitespace-nowrap">
            ⏳ {diff} {diff === 1 ? "day" : "days"} left
          </Badge>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="text-xs font-semibold text-slate-800">{formatted}</span>
        <span className="text-[10px] text-slate-500 font-medium">in {diff} days</span>
      </div>
    );
  };

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

  // Calculate progress stats for each employee (with pending, incomplete, and overdue metrics)
  const employeeProgressList = useMemo(() => {
    return employees.map((emp) => {
      const allEmpTasks = tasks.filter((t) => isTaskAssignedToEmployee(t, emp.id));
      const empTasks = selectedProject === "ALL" 
        ? allEmpTasks 
        : allEmpTasks.filter((t) => String(t.project_id) === String(selectedProject));

      const empProjectsCount = projects.filter((p) => {
        const isMember = Array.isArray(p.members) && p.members.some((m: any) => String(m.id) === String(emp.id));
        const hasTask = allEmpTasks.some((t) => String(t.project_id) === String(p.id));
        return isMember || hasTask;
      }).length;
      
      const empCompleted = empTasks.filter((t) => isTaskCompleted(t.status)).length;
      const empActiveTasks = empTasks.filter((t) => isActiveTask(t.status));
      const empInProgress = empTasks.filter((t) => isTaskInProgress(t.status)).length;
      const empPending = empTasks.filter((t) => isTaskPending(t.status)).length;
      const empIncomplete = empTasks.length - empCompleted;
      const empOverdue = empTasks.filter((t) => isTaskOverdue(t)).length;
      const empBlocked = empTasks.filter((t) => t.blockers && !isTaskCompleted(t.status)).length;
      const empTotalHours = empTasks.reduce((sum, t) => sum + (parseFloat(t.hours_spent) || 0), 0);
      const empRate = empTasks.length > 0 ? Math.round((empCompleted / empTasks.length) * 100) : 0;
      
      const isDevOrTester = emp.role === "Developer" || emp.role === "Tester";
      const hasNoActiveTasks = isDevOrTester && empActiveTasks.length === 0;

      const lastTask = empTasks.length > 0 ? empTasks[0] : null;

      const prod = productivityMap.get(emp.id);
      const shiftHours = prod?.metrics?.shift_hours ?? 0;
      const allTimeShiftHours = prod?.metrics?.all_time_shift_hours ?? 0;
      const taskHours = prod?.metrics?.task_hours ?? 0;
      const allTimeTaskHours = prod?.metrics?.all_time_task_hours ?? empTotalHours;
      const isActiveShift = prod?.metrics?.active_shift_today ?? false;
      const loginTime = prod?.metrics?.login_time_today ?? null;

      return {
        ...emp,
        totalTasks: empTasks.length,
        allTotalTasks: allEmpTasks.length,
        assignedProjectsCount: empProjectsCount,
        completedCount: empCompleted,
        activeTasksCount: empActiveTasks.length,
        inProgressCount: empInProgress,
        pendingCount: empPending,
        incompleteCount: empIncomplete,
        overdueCount: empOverdue,
        blockedCount: empBlocked,
        totalHours: empTotalHours,
        shiftHours,
        allTimeShiftHours,
        taskHours,
        allTimeTaskHours,
        isActiveShift,
        loginTime,
        completionRate: empRate,
        hasNoActiveTasks,
        lastTask,
      };
    });
  }, [employees, tasks, projects, productivityMap, selectedProject, todayIST]);

  // Counts for workload tabs
  const activeStaffCount = useMemo(() => employeeProgressList.filter((e) => e.activeTasksCount > 0).length, [employeeProgressList]);
  const incompleteStaffCount = useMemo(() => employeeProgressList.filter((e) => e.incompleteCount > 0).length, [employeeProgressList]);
  const overdueStaffCount = useMemo(() => employeeProgressList.filter((e) => e.overdueCount > 0).length, [employeeProgressList]);

  // List of Developers & Testers with NO active tasks
  const idleEmployees = useMemo(() => {
    return employeeProgressList.filter((emp) => emp.hasNoActiveTasks);
  }, [employeeProgressList]);

  // Filtered employee matrix based on search / filter tab and productivity tag filter
  const filteredEmployeeMatrix = useMemo(() => {
    return employeeProgressList.filter((emp) => {
      const matchAssignee = selectedAssignee === "ALL" || String(emp.id) === String(selectedAssignee);
      if (!matchAssignee) return false;

      if (selectedTagFilter !== "ALL") {
        const prod = productivityMap.get(emp.id);
        const rawTag = prod?.tag || "off";
        const normalizedTag = rawTag === "active" || rawTag === "idle" ? "engaged" : rawTag;
        const filterNormalized = selectedTagFilter === "active" || selectedTagFilter === "idle" ? "engaged" : selectedTagFilter;
        if (normalizedTag !== filterNormalized) return false;
      }

      if (activeWorkloadTab === "active") {
        return emp.activeTasksCount > 0;
      }
      if (activeWorkloadTab === "incomplete") {
        return emp.incompleteCount > 0;
      }
      if (activeWorkloadTab === "overdue") {
        return emp.overdueCount > 0;
      }
      if (activeWorkloadTab === "idle") {
        return emp.hasNoActiveTasks;
      }
      return true;
    });
  }, [employeeProgressList, selectedAssignee, activeWorkloadTab, selectedTagFilter, productivityMap]);

  // Selected active project details & metrics
  const activeProject = useMemo(() => {
    if (selectedProject === "ALL") return null;
    return projects.find((p) => String(p.id) === String(selectedProject)) || null;
  }, [selectedProject, projects]);

  const projectTaskStats = useMemo(() => {
    if (!activeProject) return null;
    const pTasks = tasks.filter((t) => String(t.project_id) === String(activeProject.id));
    const completed = pTasks.filter((t) => isTaskCompleted(t.status)).length;
    const inProgress = pTasks.filter((t) => isTaskInProgress(t.status)).length;
    const pending = pTasks.filter((t) => isTaskPending(t.status)).length;
    const incomplete = pTasks.length - completed;
    const overdue = pTasks.filter((t) => isTaskOverdue(t)).length;
    const rate = pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0;
    return {
      total: pTasks.length,
      completed,
      inProgress,
      pending,
      incomplete,
      overdue,
      completionRate: rate,
    };
  }, [activeProject, tasks, todayIST]);

  // Filter tasks based on selections (including pending, incomplete, and overdue)
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchProject = selectedProject === "ALL" || String(t.project_id) === String(selectedProject);
      const matchAssignee = selectedAssignee === "ALL" || isTaskAssignedToEmployee(t, parseInt(selectedAssignee, 10));
      
      let matchStatus = true;
      if (selectedStatus === "ALL") {
        matchStatus = true;
      } else if (selectedStatus === "INCOMPLETE") {
        matchStatus = !isTaskCompleted(t.status);
      } else if (selectedStatus === "PENDING") {
        matchStatus = isTaskPending(t.status);
      } else if (selectedStatus === "OVERDUE") {
        matchStatus = isTaskOverdue(t);
      } else if (selectedStatus === "COMPLETED") {
        matchStatus = isTaskCompleted(t.status);
      } else {
        matchStatus = t.status === selectedStatus;
      }

      return matchProject && matchStatus && matchAssignee;
    });
  }, [tasks, selectedProject, selectedAssignee, selectedStatus, todayIST]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Planning":
        return <Badge className="bg-purple-600 text-white font-bold whitespace-nowrap">Planning</Badge>;
      case "In Progress":
        return <Badge className="bg-sky-500 text-white font-bold whitespace-nowrap">In Progress</Badge>;
      case "Ready for Testing":
        return <Badge className="bg-amber-500 text-white font-bold animate-pulse whitespace-nowrap">Ready for Testing</Badge>;
      case "Testing":
        return <Badge className="bg-blue-600 text-white font-bold whitespace-nowrap">Testing</Badge>;
      case "Tested (PASS)":
        return <Badge className="bg-emerald-600 text-white font-bold whitespace-nowrap">Tested (PASS)</Badge>;
      case "Ready for Demo":
        return <Badge className="bg-indigo-600 text-white font-bold shadow-xs whitespace-nowrap">🚀 Ready for Demo</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-500 text-white font-bold whitespace-nowrap">Completed</Badge>;
      case "Changes Required":
        return <Badge className="bg-red-500 text-white font-bold whitespace-nowrap">Changes Required (FAIL)</Badge>;
      default:
        return <Badge variant="outline" className="whitespace-nowrap">{status}</Badge>;
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
                {projects.map((p) => {
                  const deadlineStr = p.target_date ? `(Due: ${p.target_date.split("T")[0]})` : "";
                  return (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} {deadlineStr}
                    </SelectItem>
                  );
                })}
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
            <label className="text-xs font-bold text-slate-600 uppercase">Task Status Filter</label>
            <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val || "ALL")}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="INCOMPLETE">⏳ Incomplete (Active & Pending)</SelectItem>
                <SelectItem value="PENDING">🕒 Pending (Planning & Ready for QA)</SelectItem>
                <SelectItem value="OVERDUE">🚨 Overdue Tasks</SelectItem>
                <SelectItem value="COMPLETED">✅ Completed & Verified</SelectItem>
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

      {/* 4.1 Selected Project Spotlight & Target Deadline Banner */}
      {activeProject && projectTaskStats && (
        <div className="rounded-2xl border-2 border-indigo-300 bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-indigo-50/90 p-5 shadow-md space-y-4 animate-fade-in relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-indigo-600 text-white font-bold text-[11px] px-2.5 py-0.5 shadow-xs">
                  🎯 Project Delivery Spotlight
                </Badge>
                <span className="text-xs font-bold text-slate-700 bg-white/90 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Status: {activeProject.status || "Active"}
                </span>
                {activeProject.is_fast_track === 1 && (
                  <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                    ⚡ Fast Track
                  </Badge>
                )}
              </div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-indigo-600 shrink-0" />
                <span className="truncate">{activeProject.name}</span>
              </h3>
              {activeProject.description && (
                <p className="text-xs text-slate-600 max-w-3xl line-clamp-2">
                  {activeProject.description}
                </p>
              )}
            </div>

            {/* Project Target Deadline Callout */}
            <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-indigo-200 shadow-xs shrink-0 self-stretch sm:self-auto">
              <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Project Target Deadline
                </span>
                <div className="mt-0.5">
                  {renderDeadlineBadge(activeProject.target_date, activeProject.status === "Completed")}
                </div>
              </div>
            </div>
          </div>

          {/* Project Tasks & Workload Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-indigo-200/80">
            <div className="p-2.5 rounded-xl bg-white border border-indigo-100 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">Total Tasks</span>
              <span className="text-base font-black text-slate-900">{projectTaskStats.total}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-700 block">Completed</span>
              <span className="text-base font-black text-emerald-900">{projectTaskStats.completed}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-700 block">Incomplete</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black text-amber-900">{projectTaskStats.incomplete}</span>
                <span className="text-[10px] font-semibold text-amber-700">
                  ({projectTaskStats.inProgress} working)
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-200 shadow-2xs">
              <span className="text-[11px] font-bold text-purple-700 block">Pending / QA</span>
              <span className="text-base font-black text-purple-900">{projectTaskStats.pending}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-red-50/80 border border-red-200 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-red-700 block">Overdue Tasks</span>
              <span className="text-base font-black text-red-900">{projectTaskStats.overdue}</span>
            </div>
          </div>

          {/* Progress Bar & Actions */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700">Overall Project Completion</span>
              <span className="text-indigo-700 font-extrabold">{projectTaskStats.completionRate}%</span>
            </div>
            <div className="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-sky-500 h-full transition-all duration-500"
                style={{ width: `${projectTaskStats.completionRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Viewing filtered workload for <strong>{activeProject.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedProject("ALL")}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1"
              >
                Clear Project Filter (View All)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4.2 All Company Projects Deadlines & Work In Progress Overview Strip */}
      {selectedProject === "ALL" && projects.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Company Projects Deadlines & Delivery Overview
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Click any project card to filter team deliverables
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {projects.map((p) => {
              const pTasks = tasks.filter((t) => String(t.project_id) === String(p.id));
              const pCompleted = pTasks.filter((t) => isTaskCompleted(t.status)).length;
              const pPending = pTasks.filter((t) => isTaskPending(t.status)).length;
              const pIncomplete = pTasks.length - pCompleted;
              const pOverdue = pTasks.filter((t) => isTaskOverdue(t)).length;
              const pRate = pTasks.length > 0 ? Math.round((pCompleted / pTasks.length) * 100) : 0;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProject(String(p.id))}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 transition-all cursor-pointer shadow-2xs space-y-2.5 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 truncate block">
                      {p.name}
                    </span>
                    {pOverdue > 0 && (
                      <span className="text-[10px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded shrink-0">
                        {pOverdue} overdue
                      </span>
                    )}
                  </div>

                  {/* Target Deadline */}
                  <div className="text-xs">
                    <span className="text-[10px] font-semibold text-slate-500 block">Project Deadline:</span>
                    <div className="mt-0.5">
                      {renderDeadlineBadge(p.target_date, p.status === "Completed")}
                    </div>
                  </div>

                  {/* Task stats and progress */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                      <span>{pCompleted}/{pTasks.length} Done</span>
                      {pPending > 0 && (
                        <span className="text-purple-700 text-[10px] font-bold">
                          {pPending} pending
                        </span>
                      )}
                      <span className="text-indigo-600 font-bold">{pRate}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${pRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4.5 Workforce Productivity & Utilization Analytics */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900">
                Workforce Productivity & Utilization Analysis
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated 4-pillar evaluation (Working Time, Tasks, Subtasks & Projects). Visible exclusively to Admin, CEO, and PM.
            </p>
          </div>

          {/* Timeframe Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            {(["today", "week", "month", "year"] as const).map((p) => {
              const labels = {
                today: "Today",
                week: "This Week",
                month: "This Month",
                year: "This Year",
              };
              const isSelected = productivityPeriod === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProductivityPeriod(p)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 KPI Summary Cards with Quick Filter */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Ideal */}
          <button
            type="button"
            onClick={() => setSelectedTagFilter(selectedTagFilter === "ideal" ? "ALL" : "ideal")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedTagFilter === "ideal"
                ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs"
                : "bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                🌟 Ideal
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                ≥75 pts
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-950 mt-1">
              {productivitySummary?.ideal_count ?? 0}
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5">
              High efficiency & execution
            </div>
          </button>

          {/* 2. Engaged (Working on Task) */}
          <button
            type="button"
            onClick={() => setSelectedTagFilter(selectedTagFilter === "engaged" ? "ALL" : "engaged")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedTagFilter === "engaged" || selectedTagFilter === "active"
                ? "bg-sky-50 border-sky-400 ring-2 ring-sky-500/20 shadow-xs"
                : "bg-sky-50/40 border-sky-200 hover:bg-sky-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-800 flex items-center gap-1">
                ⚡ Engaged
              </span>
              <span className="text-[10px] font-bold text-sky-600 bg-sky-100/70 px-1.5 py-0.5 rounded">
                Working
              </span>
            </div>
            <div className="text-2xl font-black text-sky-950 mt-1">
              {productivitySummary?.engaged_count ?? productivitySummary?.active_count ?? 0}
            </div>
            <div className="text-[10px] text-sky-700 mt-0.5">
              Working on assigned tasks
            </div>
          </button>

          {/* 3. Under-utilized */}
          <button
            type="button"
            onClick={() => setSelectedTagFilter(selectedTagFilter === "idle" ? "ALL" : "idle")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedTagFilter === "idle"
                ? "bg-amber-50 border-amber-400 ring-2 ring-amber-500/20 shadow-xs"
                : "bg-amber-50/40 border-amber-200 hover:bg-amber-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                🟡 Under-utilized
              </span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                &lt;50 pts
              </span>
            </div>
            <div className="text-2xl font-black text-amber-950 mt-1">
              {productivitySummary?.idle_count ?? 0}
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">
              Low task hours vs shift
            </div>
          </button>

          {/* 4. Off / Leave */}
          <button
            type="button"
            onClick={() => setSelectedTagFilter(selectedTagFilter === "off" ? "ALL" : "off")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedTagFilter === "off"
                ? "bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 shadow-xs"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                ⚪ Off Shift
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                0 hrs
              </span>
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {productivitySummary?.off_count ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              On leave or non-working
            </div>
          </button>
        </div>

        {selectedTagFilter !== "ALL" && (
          <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-slate-700">
              Filtering employee matrix by productivity tag: <strong className="uppercase font-bold text-slate-900">{selectedTagFilter}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSelectedTagFilter("ALL")}
              className="text-sky-600 font-bold hover:underline cursor-pointer"
            >
              Show All Staff
            </button>
          </div>
        )}
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
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("all")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeWorkloadTab === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Staff ({employeeProgressList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("active")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                activeWorkloadTab === "active" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle className="h-3 w-3" /> Active ({activeStaffCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("incomplete")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                activeWorkloadTab === "incomplete" ? "bg-amber-500 text-white shadow-2xs" : "text-amber-800 hover:bg-amber-50"
              }`}
            >
              <Hourglass className="h-3 w-3" /> Incomplete / Pending ({incompleteStaffCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("overdue")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                activeWorkloadTab === "overdue" ? "bg-red-600 text-white shadow-2xs" : "text-red-700 hover:bg-red-50"
              }`}
            >
              <AlertTriangle className="h-3 w-3" /> Overdue Tasks ({overdueStaffCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("idle")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                activeWorkloadTab === "idle" ? "bg-slate-800 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-200/60"
              }`}
            >
              <AlertCircle className="h-3 w-3" /> Bench / Idle ({idleEmployees.length})
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold min-w-[210px]">Team Member</TableHead>
                <TableHead className="font-bold min-w-[90px]">Role</TableHead>
                <TableHead className="font-bold text-center min-w-[130px]">Workload Status</TableHead>
                <TableHead className="font-bold text-center min-w-[70px]">Projects</TableHead>
                <TableHead className="font-bold text-center min-w-[75px]">Total Tasks</TableHead>
                <TableHead className="font-bold text-center min-w-[80px]">Completed</TableHead>
                <TableHead className="font-bold text-center min-w-[95px]">Incomplete</TableHead>
                <TableHead className="font-bold text-center min-w-[80px]">Pending</TableHead>
                <TableHead className="font-bold text-center min-w-[80px]">Overdue</TableHead>
                <TableHead className="font-bold text-center min-w-[130px]">
                  <div className="flex flex-col items-center leading-tight">
                    <span className="flex items-center gap-1 text-slate-800">
                      <Clock className="h-3 w-3 text-sky-500" /> Shift Hours
                    </span>
                    <span className="text-[10px] text-sky-600 font-bold capitalize">
                      ({productivityPeriod === "today" ? "Today" : productivityPeriod === "week" ? "This Week" : productivityPeriod === "month" ? "This Month" : "This Year"})
                    </span>
                  </div>
                </TableHead>
                <TableHead className="font-bold text-center min-w-[125px]">
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-slate-800">Task Logged</span>
                    <span className="text-[10px] text-slate-500 font-normal">Active & Done</span>
                  </div>
                </TableHead>
                <TableHead className="font-bold text-right min-w-[110px]">Completion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8">Calculating live team metrics...</TableCell></TableRow>
              ) : filteredEmployeeMatrix.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center text-slate-500 py-10">No employees match the selected workload filter.</TableCell></TableRow>
              ) : (
                filteredEmployeeMatrix.map((emp) => (
                  <TableRow key={emp.id} className={`transition-colors ${emp.hasNoActiveTasks ? "bg-amber-50/30 hover:bg-amber-50/60" : "hover:bg-slate-50/80"}`}>
                    <TableCell className="font-bold text-slate-900">
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <div className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                          emp.hasNoActiveTasks ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-sky-100 text-sky-800"
                        }`}>
                          {emp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate">{emp.name}</span>
                        {productivityMap.has(emp.id) && (
                          <EmployeeProductivityTag
                            tag={productivityMap.get(emp.id)?.tag}
                            score={productivityMap.get(emp.id)?.score}
                            metrics={productivityMap.get(emp.id)?.metrics}
                            size="xs"
                          />
                        )}
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
                    
                    {/* Completed */}
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        {emp.completedCount}
                      </span>
                    </TableCell>

                    {/* Incomplete */}
                    <TableCell className="text-center">
                      {emp.incompleteCount > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800"
                            title={`${emp.inProgressCount} in progress / testing, ${emp.pendingCount} pending`}
                          >
                            {emp.incompleteCount}
                          </span>
                          <span className="text-[9px] text-amber-700 font-semibold mt-0.5">
                            ({emp.inProgressCount} active)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">0</span>
                      )}
                    </TableCell>

                    {/* Pending */}
                    <TableCell className="text-center">
                      {emp.pendingCount > 0 ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800"
                          title="Planning & Ready for QA"
                        >
                          {emp.pendingCount}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">0</span>
                      )}
                    </TableCell>

                    {/* Overdue */}
                    <TableCell className="text-center">
                      {emp.overdueCount > 0 ? (
                        <span
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse"
                          title="Tasks past target deadline"
                        >
                          🚨 {emp.overdueCount}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">0</span>
                      )}
                    </TableCell>
                    
                    {/* Shift Hours Cell */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-black text-slate-900 text-xs sm:text-sm">
                          {formatHoursAndMinutes(emp.shiftHours)}
                        </span>
                        {emp.isActiveShift ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            On Shift {emp.loginTime ? `(${emp.loginTime})` : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Off Shift</span>
                        )}
                        {emp.allTimeShiftHours > 0 && productivityPeriod !== "year" && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            All-Time: {formatHoursAndMinutes(emp.allTimeShiftHours)}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Task Work Logged Cell */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">
                          {formatHoursAndMinutes(emp.taskHours)}
                        </span>
                        {emp.allTimeTaskHours > 0 && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            All-Time: {formatHoursAndMinutes(emp.allTimeTaskHours)}
                          </span>
                        )}
                      </div>
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

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
          <Table className="min-w-[1050px]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold w-[28%] min-w-[260px]">Task Details</TableHead>
                <TableHead className="font-bold w-[16%] min-w-[150px]">Project & Deadline</TableHead>
                <TableHead className="font-bold w-[14%] min-w-[130px]">Task Target Deadline</TableHead>
                <TableHead className="font-bold w-[12%] min-w-[120px]">Assignee</TableHead>
                <TableHead className="font-bold w-[10%] min-w-[110px]">Status</TableHead>
                <TableHead className="font-bold w-[8%] min-w-[85px]">Progress</TableHead>
                <TableHead className="font-bold w-[5%] min-w-[65px]">Hours</TableHead>
                <TableHead className="font-bold w-[11%] min-w-[130px]">Blockers / Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading tasks...</TableCell></TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-10">No tasks match criteria.</TableCell></TableRow>
              ) : (
                filteredTasks.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Task Title & Description */}
                    <TableCell className="align-top py-3.5 pr-4">
                      <div className="font-bold text-slate-900 text-sm break-words whitespace-normal leading-snug">
                        {t.title}
                      </div>
                      {t.description && (
                        <p className="text-xs text-slate-500 whitespace-pre-wrap break-words mt-1 leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-150">
                          {t.description}
                        </p>
                      )}
                    </TableCell>

                    {/* Project & Project Deadline */}
                    <TableCell className="align-top py-3.5 px-3">
                      <div className="text-xs font-bold text-slate-900 break-words whitespace-normal leading-snug">
                        {t.project_name || "N/A"}
                      </div>
                      {(() => {
                        const taskProj = projects.find((p) => String(p.id) === String(t.project_id));
                        if (!taskProj?.target_date) return null;
                        return (
                          <div className="text-[10px] text-indigo-700 font-semibold mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-indigo-500 shrink-0" />
                            <span>Proj Due: {formatDateReadable(taskProj.target_date)}</span>
                          </div>
                        );
                      })()}
                    </TableCell>

                    {/* Task Target Deadline with Overdue / Due status */}
                    <TableCell className="align-top py-3.5 px-3 whitespace-nowrap">
                      {renderDeadlineBadge(t.target_date, isTaskCompleted(t.status))}
                    </TableCell>

                    {/* Assignee */}
                    <TableCell className="align-top py-3.5 px-3 text-xs text-slate-700 font-medium whitespace-nowrap">
                      {t.assignee_name || "Unassigned"}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="align-top py-3.5 px-2 whitespace-nowrap">
                      {getStatusBadge(t.status)}
                    </TableCell>

                    {/* Progress */}
                    <TableCell className="align-top py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden shrink-0">
                          <div
                            className="bg-sky-500 h-full"
                            style={{ width: `${t.progress_percentage || 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">{t.progress_percentage || 0}%</span>
                      </div>
                    </TableCell>

                    {/* Hours */}
                    <TableCell className="align-top py-3.5 px-3 font-bold text-slate-900 text-xs whitespace-nowrap">
                      {formatHoursAndMinutes(t.hours_spent)}
                    </TableCell>

                    {/* Blockers / Notes */}
                    <TableCell className="align-top py-3.5 pl-3 text-xs">
                      {t.blockers ? (
                        <span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200 inline-block break-words">
                          ⚠️ {t.blockers}
                        </span>
                      ) : t.daily_summary ? (
                        <span className="text-slate-600 break-words">{t.daily_summary}</span>
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
