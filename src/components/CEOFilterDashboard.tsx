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
  Eye,
  ListTodo,
  Search,
  CheckSquare,
  Hourglass,
  Layers,
  Target,
  RotateCcw,
  Repeat,
  Copy
} from "lucide-react";
import { showToast, showError, showSuccess, showWarning } from "@/lib/swal";
import { formatHoursAndMinutes } from "@/lib/timeUtils";
import EmployeeProductivityTag from "@/components/EmployeeProductivityTag";

// Helper to calculate project & task deadline status
export const getDeadlineInfo = (targetDateStr: string | null | undefined, isComplete: boolean = false) => {
  if (!targetDateStr) {
    return {
      formatted: "No deadline set",
      badge: "No Deadline",
      status: "none" as const,
      color: "bg-slate-100 text-slate-600 border-slate-200",
      daysDiff: null,
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);

  const formatted = target.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (isComplete) {
    return {
      formatted,
      badge: "Completed",
      status: "completed" as const,
      color: "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold",
      daysDiff: 0,
    };
  }

  const diffTime = target.getTime() - today.getTime();
  const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return {
      formatted,
      badge: `Overdue by ${Math.abs(daysDiff)}d`,
      status: "overdue" as const,
      color: "bg-rose-100 text-rose-800 border-rose-300 font-extrabold",
      daysDiff,
    };
  } else if (daysDiff === 0) {
    return {
      formatted,
      badge: "Due Today",
      status: "due_today" as const,
      color: "bg-amber-100 text-amber-900 border-amber-400 font-black animate-pulse",
      daysDiff,
    };
  } else if (daysDiff <= 3) {
    return {
      formatted,
      badge: `${daysDiff}d left (Due Soon)`,
      status: "due_soon" as const,
      color: "bg-amber-50 text-amber-800 border-amber-300 font-bold",
      daysDiff,
    };
  } else {
    return {
      formatted,
      badge: `${daysDiff}d remaining`,
      status: "on_track" as const,
      color: "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold",
      daysDiff,
    };
  }
};

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
  const [activeWorkloadTab, setActiveWorkloadTab] = useState<"all" | "active" | "has_incomplete" | "has_pending" | "has_repeated" | "idle">("all");

  // Staff Work Modal State
  const [selectedStaffForModal, setSelectedStaffForModal] = useState<any | null>(null);
  const [staffModalFilter, setStaffModalFilter] = useState<"all" | "incomplete" | "pending" | "in_progress" | "testing" | "completed" | "repeated">("all");
  const [staffModalSearch, setStaffModalSearch] = useState<string>("");

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

  // Precompute Project metrics with deadlines
  const projectsWithMetrics = useMemo(() => {
    return projects.map((p) => {
      const pTasks = tasks.filter((t) => String(t.project_id) === String(p.id));
      const totalTasks = pTasks.length > 0 ? pTasks.length : (p.total_tasks || 0);
      const completedTasks = pTasks.length > 0 
        ? pTasks.filter((t) => ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)).length 
        : (p.completed_tasks || 0);
      const pendingTasks = pTasks.filter((t) => t.status === "Pending" || t.status === "Planning").length;
      const inProgressTasks = pTasks.filter((t) => t.status === "In Progress").length;
      const testingTasks = pTasks.filter((t) => ["Ready for Testing", "Testing", "Changes Required"].includes(t.status)).length;
      const incompleteTasks = Math.max(0, totalTasks - completedTasks);
      const progressRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const deadlineInfo = getDeadlineInfo(p.target_date, totalTasks > 0 && completedTasks === totalTasks);

      return {
        ...p,
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        testingTasks,
        incompleteTasks,
        progressRate,
        deadlineInfo,
      };
    });
  }, [projects, tasks]);

  const projectMap = useMemo(() => {
    const map = new Map<number, any>();
    projectsWithMetrics.forEach((p) => map.set(p.id, p));
    return map;
  }, [projectsWithMetrics]);

  // Calculate progress stats for each employee with Pending, Incomplete, In Progress & QA breakdown
  const employeeProgressList = useMemo(() => {
    return employees.map((emp) => {
      const empTasks = tasks.filter((t) => isTaskAssignedToEmployee(t, emp.id));
      const empProjectsCount = projects.filter((p) => {
        const isMember = Array.isArray(p.members) && p.members.some((m: any) => String(m.id) === String(emp.id));
        const hasTask = empTasks.some((t) => String(t.project_id) === String(p.id));
        return isMember || hasTask;
      }).length;
      
      const empCompleted = empTasks.filter((t) => 
        ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)
      ).length;
      
      const empActiveTasks = empTasks.filter((t) => isActiveTask(t.status));
      const empInProgress = empTasks.filter((t) => t.status === "In Progress").length;
      const empPending = empTasks.filter((t) => t.status === "Pending" || t.status === "Planning").length;
      const empTesting = empTasks.filter((t) => ["Ready for Testing", "Testing", "Changes Required"].includes(t.status)).length;
      const empIncomplete = Math.max(0, empTasks.length - empCompleted);
      const empBlocked = empTasks.filter((t) => t.blockers && t.status !== "Completed" && t.status !== "Ready for Demo").length;
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

      // Detect Repeated Tasks for this employee
      const titleMap = new Map<string, any[]>();
      for (const t of empTasks) {
        const norm = (t.title || "").trim().toLowerCase().replace(/\s+/g, " ");
        if (!norm) continue;
        if (!titleMap.has(norm)) {
          titleMap.set(norm, []);
        }
        titleMap.get(norm)!.push(t);
      }

      const repeatedGroups: any[] = [];
      let totalRepeatedInstances = 0;
      let totalRepeatedHours = 0;

      for (const [normTitle, group] of titleMap.entries()) {
        if (group.length > 1) {
          const groupHours = group.reduce((sum: number, t: any) => sum + (parseFloat(t.hours_spent) || 0), 0);
          totalRepeatedInstances += group.length;
          totalRepeatedHours += groupHours;
          repeatedGroups.push({
            title: group[0].title.trim(),
            normalizedTitle: normTitle,
            count: group.length,
            totalHours: Math.round(groupHours * 10) / 10,
            statuses: Array.from(new Set(group.map((t: any) => t.status))),
            projects: Array.from(new Set(group.map((t: any) => t.project_name || "Standalone"))),
            tasks: group,
          });
        }
      }

      const hasRepeatedTasks = repeatedGroups.length > 0;

      return {
        ...emp,
        totalTasks: empTasks.length,
        assignedProjectsCount: empProjectsCount,
        completedCount: empCompleted,
        activeTasksCount: empActiveTasks.length,
        inProgressCount: empInProgress,
        pendingCount: empPending,
        testingCount: empTesting,
        incompleteCount: empIncomplete,
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
        hasRepeatedTasks,
        repeatedGroups,
        repeatedTasksCount: repeatedGroups.length,
        repeatedInstancesCount: totalRepeatedInstances,
        repeatedHours: Math.round(totalRepeatedHours * 10) / 10,
        lastTask,
        tasks: empTasks,
      };
    });
  }, [employees, tasks, projects, productivityMap]);

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
      if (activeWorkloadTab === "has_incomplete") {
        return emp.incompleteCount > 0;
      }
      if (activeWorkloadTab === "has_pending") {
        return emp.pendingCount > 0;
      }
      if (activeWorkloadTab === "has_repeated") {
        return emp.hasRepeatedTasks;
      }
      if (activeWorkloadTab === "idle") {
        return emp.hasNoActiveTasks;
      }
      return true;
    });
  }, [employeeProgressList, selectedAssignee, activeWorkloadTab, selectedTagFilter, productivityMap]);

  // Filter tasks based on selections
  const filteredTasks = tasks.filter((t) => {
    const matchProject = selectedProject === "ALL" || String(t.project_id) === String(selectedProject);
    const matchStatus = selectedStatus === "ALL" || t.status === selectedStatus;
    const matchAssignee = selectedAssignee === "ALL" || isTaskAssignedToEmployee(t, parseInt(selectedAssignee, 10));
    return matchProject && matchStatus && matchAssignee;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
      case "Planning":
        return <Badge className="bg-purple-600 text-white font-bold whitespace-nowrap">Planning / Pending</Badge>;
      case "In Progress":
        return <Badge className="bg-sky-500 text-white font-bold whitespace-nowrap">In Progress</Badge>;
      case "Ready for Testing":
        return <Badge className="bg-amber-500 text-white font-bold animate-pulse whitespace-nowrap">Ready for Testing</Badge>;
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

      {/* 4. Active Projects & Delivery Deadlines Roadmap Overview Deck */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  Active Projects & Delivery Deadlines Roadmap
                  <Badge variant="outline" className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border-indigo-200">
                    {projectsWithMetrics.length} {projectsWithMetrics.length === 1 ? "Project" : "Projects"}
                  </Badge>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracking project deadlines, target delivery dates, completion trajectories, and deliverables across teams.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const overdueProjects = projectsWithMetrics.filter(p => p.deadlineInfo.status === "overdue").length;
              const dueSoonProjects = projectsWithMetrics.filter(p => p.deadlineInfo.status === "due_soon" || p.deadlineInfo.status === "due_today").length;
              const onTrackProjects = projectsWithMetrics.filter(p => p.deadlineInfo.status === "on_track").length;
              return (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {overdueProjects > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[11px]">
                      <AlertTriangle className="h-3 w-3 text-rose-600" />
                      {overdueProjects} Overdue
                    </span>
                  )}
                  {dueSoonProjects > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200 text-[11px]">
                      <Clock className="h-3 w-3 text-amber-600" />
                      {dueSoonProjects} Due Soon
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 text-[11px]">
                    <CheckCircle className="h-3 w-3 text-emerald-600" />
                    {onTrackProjects} On Track
                  </span>
                  {selectedProject !== "ALL" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedProject("ALL")}
                      className="h-7 text-xs font-bold text-sky-600 hover:text-sky-800 hover:bg-sky-50 px-2"
                    >
                      Clear Filter (Show All)
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {projectsWithMetrics.map((p) => {
            const isSelected = selectedProject === String(p.id);
            return (
              <div
                key={p.id}
                onClick={() => setSelectedProject(isSelected ? "ALL" : String(p.id))}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group ${
                  isSelected
                    ? "bg-sky-50/50 border-sky-400 ring-2 ring-sky-400/30 shadow-md"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                          {p.name}
                        </span>
                        {Boolean(p.is_fast_track) && (
                          <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0">
                            Fast-Track
                          </Badge>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border shrink-0 ${p.deadlineInfo.color}`}>
                      <Calendar className="h-3 w-3 shrink-0" />
                      {p.deadlineInfo.badge}
                    </span>
                  </div>

                  {/* Project Deadline Date details */}
                  <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-150">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-indigo-500" /> Project Deadline:
                    </span>
                    <span className="font-bold text-slate-900">
                      {p.deadlineInfo.formatted}
                    </span>
                  </div>

                  {/* Task Delivery Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">Task Delivery:</span>
                      <span className="font-bold text-slate-900">
                        {p.completedTasks}/{p.totalTasks} Done ({p.progressRate}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          p.progressRate === 100
                            ? "bg-emerald-500"
                            : p.progressRate >= 50
                            ? "bg-sky-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${p.progressRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Breakdown badges */}
                  <div className="flex items-center justify-between gap-1 text-[10px] pt-1">
                    <span className="text-slate-600">
                      Remaining: <strong className="text-rose-700 font-bold">{p.incompleteTasks} Incomplete</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {p.pendingTasks > 0 && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 font-semibold">
                          {p.pendingTasks} Pending
                        </span>
                      )}
                      {p.inProgressTasks > 0 && (
                        <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-200 font-semibold">
                          {p.inProgressTasks} In Prog
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-150 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">
                    {Array.isArray(p.members) ? `${p.members.length} team members` : "Team assigned"}
                  </span>
                  <span className={`font-bold transition-colors ${isSelected ? "text-sky-700 font-black" : "text-slate-500 group-hover:text-slate-800"}`}>
                    {isSelected ? "✓ Active Filter" : "Filter Dashboard →"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Filter Control Bar */}
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
            <label className="text-xs font-bold text-slate-600 uppercase">Project (with Deadline)</label>
            <Select value={selectedProject} onValueChange={(val) => setSelectedProject(val || "ALL")}>
              <SelectTrigger><SelectValue placeholder="All Projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Projects</SelectItem>
                {projectsWithMetrics.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name} {p.target_date ? `(Due: ${p.deadlineInfo.formatted} • ${p.deadlineInfo.badge})` : ""}
                  </SelectItem>
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
                <SelectItem value="Planning">Planning / Pending</SelectItem>
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

      {/* 4.8 Repeated Tasks & Redundancy Alert Banner */}
      {employeeProgressList.some((e) => e.hasRepeatedTasks) && (
        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/40 to-amber-50 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-extrabold text-amber-950">
                  Repeated Tasks & Redundancy Detection
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                  {employeeProgressList.filter((e) => e.hasRepeatedTasks).length} Employees with Repeated Tasks
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Multiple task entries sharing identical titles assigned to the same employee. Review duplicate tasks to avoid redundant work, clarify scope, or consolidate hours.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveWorkloadTab("has_repeated")}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm shrink-0 cursor-pointer flex items-center gap-1.5 transition"
          >
            <Eye className="h-3.5 w-3.5" /> View Staff with Repeated Tasks ({employeeProgressList.filter((e) => e.hasRepeatedTasks).length})
          </button>
        </div>
      )}

      {/* 5. Employee Progress Breakdown Matrix with Workload Tabs & Pending/Incomplete Audit */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-500" />
              Live Employee Deliverables & Workload Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditing staff work: <strong>Pending</strong>, <strong>In Progress</strong>, <strong>In QA</strong>, <strong>Incomplete</strong>, <strong>Repeated</strong>, and completed ratios.
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
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeWorkloadTab === "active" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle className="h-3 w-3" /> Active ({employeeProgressList.filter(e => e.activeTasksCount > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("has_incomplete")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeWorkloadTab === "has_incomplete" ? "bg-rose-600 text-white shadow-2xs" : "text-rose-700 hover:bg-rose-50"
              }`}
            >
              <Hourglass className="h-3 w-3" /> Has Incomplete ({employeeProgressList.filter(e => e.incompleteCount > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("has_pending")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeWorkloadTab === "has_pending" ? "bg-purple-600 text-white shadow-2xs" : "text-purple-700 hover:bg-purple-50"
              }`}
            >
              <Clock className="h-3 w-3" /> Has Pending ({employeeProgressList.filter(e => e.pendingCount > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("has_repeated")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeWorkloadTab === "has_repeated" ? "bg-amber-600 text-white shadow-2xs" : "text-amber-800 hover:bg-amber-50"
              }`}
            >
              <RotateCcw className="h-3 w-3" /> Has Repeated ({employeeProgressList.filter(e => e.hasRepeatedTasks).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkloadTab("idle")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeWorkloadTab === "idle" ? "bg-amber-500 text-white shadow-2xs" : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              <AlertCircle className="h-3 w-3" /> On Bench ({idleEmployees.length})
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
          <Table className="min-w-[1150px]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold min-w-[200px]">Team Member</TableHead>
                <TableHead className="font-bold min-w-[85px]">Role</TableHead>
                <TableHead className="font-bold text-center min-w-[125px]">Workload Status</TableHead>
                <TableHead className="font-bold text-center min-w-[70px]">Projects</TableHead>
                <TableHead className="font-bold text-center min-w-[65px]">Total</TableHead>
                <TableHead className="font-bold text-center min-w-[85px]">
                  <span className="flex items-center justify-center gap-1 text-purple-700">
                    <Clock className="h-3 w-3" /> Pending
                  </span>
                </TableHead>
                <TableHead className="font-bold text-center min-w-[95px]">
                  <span className="flex items-center justify-center gap-1 text-sky-700">
                    <Flame className="h-3 w-3" /> In Progress
                  </span>
                </TableHead>
                <TableHead className="font-bold text-center min-w-[80px]">
                  <span className="flex items-center justify-center gap-1 text-amber-700">
                    In QA
                  </span>
                </TableHead>
                <TableHead className="font-bold text-center min-w-[95px]">
                  <span className="flex items-center justify-center gap-1 text-rose-700">
                    <Hourglass className="h-3 w-3" /> Incomplete
                  </span>
                </TableHead>
                <TableHead className="font-bold text-center min-w-[80px]">
                  <span className="flex items-center justify-center gap-1 text-emerald-700">
                    <CheckCircle className="h-3 w-3" /> Done
                  </span>
                </TableHead>
                <TableHead className="font-bold text-center min-w-[95px]">
                  <span className="flex items-center justify-center gap-1 text-amber-800">
                    <RotateCcw className="h-3 w-3" /> Repeated
                  </span>
                </TableHead>
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
                <TableHead className="font-bold text-center min-w-[120px]">
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-slate-800">Task Hours</span>
                    <span className="text-[10px] text-slate-500 font-normal">Logged Time</span>
                  </div>
                </TableHead>
                <TableHead className="font-bold text-center min-w-[110px]">Progress</TableHead>
                <TableHead className="font-bold text-center min-w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8">Calculating live team metrics...</TableCell></TableRow>
              ) : filteredEmployeeMatrix.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="text-center text-slate-500 py-10">No employees match the selected workload filter.</TableCell></TableRow>
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
                    
                    {/* Pending Tasks */}
                    <TableCell className="text-center">
                      {emp.pendingCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          {emp.pendingCount}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">0</span>
                      )}
                    </TableCell>

                    {/* In Progress Tasks */}
                    <TableCell className="text-center">
                      {emp.inProgressCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                          {emp.inProgressCount}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">0</span>
                      )}
                    </TableCell>

                    {/* In QA / Testing Tasks */}
                    <TableCell className="text-center">
                      {emp.testingCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {emp.testingCount}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">0</span>
                      )}
                    </TableCell>

                    {/* Incomplete / Remaining Tasks */}
                    <TableCell className="text-center">
                      {emp.incompleteCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                          {emp.incompleteCount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          0
                        </span>
                      )}
                    </TableCell>

                    {/* Completed Tasks */}
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {emp.completedCount}
                      </span>
                    </TableCell>

                    {/* Repeated Tasks Audit */}
                    <TableCell className="text-center">
                      {emp.hasRepeatedTasks ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStaffForModal(emp);
                            setStaffModalFilter("repeated");
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition cursor-pointer shadow-2xs group"
                          title={`${emp.repeatedTasksCount} repeated task title(s) across ${emp.repeatedInstancesCount} instances (${emp.repeatedHours}h total)`}
                        >
                          <RotateCcw className="h-3 w-3 text-amber-700 group-hover:rotate-180 transition-transform duration-300" />
                          <span>{emp.repeatedTasksCount} Rep</span>
                          <span className="text-[9px] px-1 rounded bg-amber-200 font-mono font-bold text-amber-950">
                            {emp.repeatedInstancesCount}x
                          </span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs font-semibold">0</span>
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

                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-14 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
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

                    {/* Action / View Staff Work */}
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedStaffForModal(emp);
                          setStaffModalFilter("all");
                          setStaffModalSearch("");
                        }}
                        className="h-7 px-2 text-[11px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300 shadow-2xs gap-1 cursor-pointer"
                        title={`Inspect pending, incomplete, and active tasks for ${emp.name}`}
                      >
                        <Eye className="h-3 w-3 text-sky-600" />
                        <span>View Work</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Staff Work & Deliverables Breakdown Inspection Modal */}
      <Dialog open={!!selectedStaffForModal} onOpenChange={(open) => !open && setSelectedStaffForModal(null)}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm border border-indigo-200 shrink-0">
                  {selectedStaffForModal?.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-lg text-slate-900">{selectedStaffForModal?.name}</span>
                    <Badge variant="outline" className="text-[10px] font-bold">{selectedStaffForModal?.role}</Badge>
                    {selectedStaffForModal && productivityMap.has(selectedStaffForModal.id) && (
                      <EmployeeProductivityTag
                        tag={productivityMap.get(selectedStaffForModal.id)?.tag}
                        score={productivityMap.get(selectedStaffForModal.id)?.score}
                        metrics={productivityMap.get(selectedStaffForModal.id)?.metrics}
                        size="xs"
                      />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    Assigned Tasks, Deliverables, Status Breakdown & Project Deadlines
                  </p>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedStaffForModal && (
            <div className="space-y-4 pt-2">
              {/* Summary Metric Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Total</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{selectedStaffForModal.totalTasks}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <div className="text-[10px] font-bold text-rose-700 uppercase">Incomplete</div>
                  <div className="text-lg font-black text-rose-900 mt-0.5">{selectedStaffForModal.incompleteCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-center">
                  <div className="text-[10px] font-bold text-purple-700 uppercase">Pending</div>
                  <div className="text-lg font-black text-purple-900 mt-0.5">{selectedStaffForModal.pendingCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-center">
                  <div className="text-[10px] font-bold text-sky-700 uppercase">In Progress</div>
                  <div className="text-lg font-black text-sky-900 mt-0.5">{selectedStaffForModal.inProgressCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">In QA</div>
                  <div className="text-lg font-black text-amber-900 mt-0.5">{selectedStaffForModal.testingCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Completed</div>
                  <div className="text-lg font-black text-emerald-900 mt-0.5">{selectedStaffForModal.completedCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300 text-center">
                  <div className="text-[10px] font-extrabold text-amber-900 uppercase flex items-center justify-center gap-1">
                    <RotateCcw className="h-3 w-3 text-amber-700" /> Repeated
                  </div>
                  <div className="text-lg font-black text-amber-950 mt-0.5">{selectedStaffForModal.repeatedTasksCount || 0}</div>
                </div>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setStaffModalFilter("all")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      staffModalFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All ({selectedStaffForModal.totalTasks})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffModalFilter("incomplete")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      staffModalFilter === "incomplete" ? "bg-rose-600 text-white shadow-2xs" : "text-rose-700 hover:bg-rose-50"
                    }`}
                  >
                    Incomplete ({selectedStaffForModal.incompleteCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffModalFilter("pending")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      staffModalFilter === "pending" ? "bg-purple-600 text-white shadow-2xs" : "text-purple-700 hover:bg-purple-50"
                    }`}
                  >
                    Pending ({selectedStaffForModal.pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffModalFilter("in_progress")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      staffModalFilter === "in_progress" ? "bg-sky-600 text-white shadow-2xs" : "text-sky-700 hover:bg-sky-50"
                    }`}
                  >
                    In Progress ({selectedStaffForModal.inProgressCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffModalFilter("testing")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      staffModalFilter === "testing" ? "bg-amber-600 text-white shadow-2xs" : "text-amber-700 hover:bg-amber-50"
                    }`}
                  >
                    In QA ({selectedStaffForModal.testingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffModalFilter("completed")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      staffModalFilter === "completed" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    Done ({selectedStaffForModal.completedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffModalFilter("repeated")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      staffModalFilter === "repeated" ? "bg-amber-600 text-white shadow-2xs" : "text-amber-800 hover:bg-amber-50"
                    }`}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Repeated ({selectedStaffForModal.repeatedTasksCount || 0})
                  </button>
                </div>

                <div className="relative min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search tasks or projects..."
                    value={staffModalSearch}
                    onChange={(e) => setStaffModalSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-slate-50"
                  />
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {(() => {
                  // Dedicated Repeated Tasks View
                  if (staffModalFilter === "repeated") {
                    const repeatedGroups = selectedStaffForModal.repeatedGroups || [];
                    const filteredGroups = repeatedGroups.filter((grp: any) => {
                      if (!staffModalSearch.trim()) return true;
                      const q = staffModalSearch.toLowerCase();
                      return grp.title?.toLowerCase().includes(q) || grp.projects?.some((p: string) => p.toLowerCase().includes(q));
                    });

                    if (filteredGroups.length === 0) {
                      return (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                          🎉 No repeated task titles found for this employee. All assigned tasks have unique scopes.
                        </div>
                      );
                    }

                    return filteredGroups.map((grp: any, gIdx: number) => (
                      <div key={gIdx} className="p-4 rounded-xl bg-amber-50/50 border-2 border-amber-300 space-y-3 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-amber-200">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
                              <RotateCcw className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                                "{grp.title}"
                              </h4>
                              <p className="text-[11px] text-amber-800 mt-0.5">
                                Assigned <strong>{grp.count} times</strong> to {selectedStaffForModal.name} • Cumulative Work: <strong>{grp.totalHours} hrs</strong>
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-200 text-amber-950 border border-amber-400 self-start sm:self-auto shrink-0 shadow-2xs">
                            <Repeat className="h-3.5 w-3.5" />
                            {grp.count} Duplicate Task Entries
                          </span>
                        </div>

                        {/* List individual task instances under this group */}
                        <div className="grid grid-cols-1 gap-2">
                          {grp.tasks.map((t: any) => {
                            const proj = projectMap.get(t.project_id);
                            return (
                              <div key={t.id} className="p-3 bg-white rounded-xl border border-amber-200/90 shadow-2xs space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                        Task #{t.id}
                                      </span>
                                      <span className="font-bold text-xs text-slate-900 truncate">
                                        {t.title}
                                      </span>
                                    </div>
                                    {t.description && (
                                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 bg-slate-50 p-2 rounded">
                                        {t.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {getStatusBadge(t.status)}
                                    <Badge variant="outline" className="text-[9px] uppercase font-bold">
                                      {t.priority || "Medium"}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-slate-100">
                                  <span className="text-slate-600 font-medium flex items-center gap-1">
                                    <Briefcase className="h-3 w-3 text-sky-600" />
                                    Project: <strong className="text-slate-900">{t.project_name || "Standalone"}</strong>
                                  </span>
                                  <span className="text-slate-600">
                                    Hours Logged: <strong className="text-slate-900 font-bold">{formatHoursAndMinutes(t.hours_spent)}</strong>
                                  </span>
                                  <span className="text-slate-500">
                                    Created: <strong>{t.created_at ? String(t.created_at).split("T")[0] : "—"}</strong>
                                  </span>
                                  <span className="text-sky-600 font-bold">
                                    Progress: {t.progress_percentage || 0}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  }

                  const empTasks = selectedStaffForModal.tasks || [];
                  const filtered = empTasks.filter((t: any) => {
                    if (staffModalFilter === "incomplete") {
                      if (["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)) return false;
                    } else if (staffModalFilter === "pending") {
                      if (t.status !== "Pending" && t.status !== "Planning") return false;
                    } else if (staffModalFilter === "in_progress") {
                      if (t.status !== "In Progress") return false;
                    } else if (staffModalFilter === "testing") {
                      if (!["Ready for Testing", "Testing", "Changes Required"].includes(t.status)) return false;
                    } else if (staffModalFilter === "completed") {
                      if (!["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)) return false;
                    }

                    if (staffModalSearch.trim()) {
                      const q = staffModalSearch.toLowerCase();
                      const matchTitle = t.title?.toLowerCase().includes(q);
                      const matchDesc = t.description?.toLowerCase().includes(q);
                      const matchProj = t.project_name?.toLowerCase().includes(q);
                      if (!matchTitle && !matchDesc && !matchProj) return false;
                    }

                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                        No tasks found matching current filter & search criteria.
                      </div>
                    );
                  }

                  return filtered.map((t: any) => {
                    const proj = projectMap.get(t.project_id);
                    const deadlineInfo = getDeadlineInfo(proj?.target_date, proj && proj.completedTasks && proj.completedTasks >= proj.totalTasks);
                    const taskDueInfo = t.due_date ? getDeadlineInfo(t.due_date, ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status)) : null;
                    const normTitle = (t.title || "").trim().toLowerCase().replace(/\s+/g, " ");
                    const isRepeatedTask = (selectedStaffForModal.repeatedGroups || []).some((g: any) => g.normalizedTitle === normTitle);

                    return (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs space-y-2.5 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="font-bold text-sm text-slate-900 leading-snug flex items-center gap-2 flex-wrap">
                              <span>{t.title}</span>
                              {isRepeatedTask && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                  <RotateCcw className="h-2.5 w-2.5 text-amber-700" /> Repeated Task
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <p className="text-xs text-slate-500 whitespace-pre-wrap break-words leading-relaxed bg-slate-50/70 p-2 rounded border border-slate-150">
                                {t.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                            {getStatusBadge(t.status)}
                            <Badge variant="outline" className="text-[10px] uppercase font-bold">
                              {t.priority || "Medium"}
                            </Badge>
                          </div>
                        </div>

                        {/* Project Name & Project Deadline Banner */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/80 p-2 rounded-lg border border-slate-150">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                            <Briefcase className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                            <span>Project: {t.project_name || "Standalone / General"}</span>
                          </div>

                          {proj?.target_date && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-slate-500">Project Deadline:</span>
                              <span className="font-bold text-slate-900">{deadlineInfo.formatted}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] border ${deadlineInfo.color}`}>
                                {deadlineInfo.badge}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Task Due Date & Progress Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                          <div className="flex items-center gap-3">
                            {taskDueInfo && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                <span>Task Due: <strong>{taskDueInfo.formatted}</strong> ({taskDueInfo.badge})</span>
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500">
                              Hours Logged: <strong className="text-slate-900 font-bold">{formatHoursAndMinutes(t.hours_spent)}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-sky-500 h-full"
                                style={{ width: `${t.progress_percentage || 0}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700">{t.progress_percentage || 0}%</span>
                          </div>
                        </div>

                        {/* Blockers alert if any */}
                        {t.blockers && (
                          <div className="p-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                            <span>Blocker: {t.blockers}</span>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. Filtered Tasks Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-sky-500" />
            Filtered Tasks & Deliverables ({filteredTasks.length})
          </h3>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold w-[34%] min-w-[300px]">Task Details</TableHead>
                <TableHead className="font-bold w-[16%] min-w-[160px]">Project</TableHead>
                <TableHead className="font-bold w-[12%] min-w-[130px]">Assignee</TableHead>
                <TableHead className="font-bold w-[12%] min-w-[130px]">Status</TableHead>
                <TableHead className="font-bold w-[10%] min-w-[110px]">Progress</TableHead>
                <TableHead className="font-bold w-[6%] min-w-[80px]">Hours</TableHead>
                <TableHead className="font-bold w-[10%] min-w-[140px]">Blockers / Notes</TableHead>
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

                    {/* Project Name & Project Deadline */}
                    <TableCell className="align-top py-3.5 px-3">
                      <div className="text-xs font-bold text-slate-800 break-words whitespace-normal leading-relaxed">
                        {t.project_name || "Standalone / General"}
                      </div>
                      {(() => {
                        const proj = projectMap.get(t.project_id);
                        const deadlineInfo = getDeadlineInfo(proj?.target_date, proj && proj.completedTasks && proj.completedTasks >= proj.totalTasks);
                        return proj?.target_date ? (
                          <div className="mt-1 flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                              <Calendar className="h-3 w-3 text-indigo-500 shrink-0" />
                              <span>Project Deadline: {deadlineInfo.formatted}</span>
                            </span>
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] w-fit border ${deadlineInfo.color}`}>
                              {deadlineInfo.badge}
                            </span>
                          </div>
                        ) : null;
                      })()}
                      {t.due_date && (
                        <div className="mt-1 text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                          <span>Task Due: {new Date(t.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
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
