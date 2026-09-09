"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess, showWarning, showToast, showConfirm } from "@/lib/swal";
import { 
  CheckCircle, 
  Send, 
  AlertCircle, 
  Clock, 
  Play, 
  Sparkles, 
  ListTodo, 
  CheckSquare, 
  Plus, 
  Calendar, 
  User, 
  Briefcase, 
  Rocket, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  ShieldCheck, 
  UserCheck, 
  SunMedium, 
  Flame, 
  Trash2,
  Crown,
  Edit3,
  AlertTriangle,
  FileText,
  Link as LinkIcon,
  RefreshCw,
  Filter,
  Search,
  Hash,
  Paperclip,
  Link2,
  Users,
  Pause,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Globe,
  Laptop,
  ArrowDown,
  FlaskConical
} from "lucide-react";
import { formatHoursAndMinutes } from "@/lib/timeUtils";
import LiveTeamActivityMonitor from "@/components/LiveTeamActivityMonitor";

export default function DailyTasksPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const currentUserId = (session?.user as any)?.id;
  const canManageAllTasks = role === "CEO" || role === "PM" || role === "Admin";

  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow" | "assigned_pm" | "assigned_ceo" | "from_tester" | "submitted_testing" | "self_created" | "incomplete" | "overdue" | "all">("today");

  // Advanced Filters State
  const [filterProject, setFilterProject] = useState<string>("ALL");
  const [filterDateMode, setFilterDateMode] = useState<string>("ALL");
  const [filterCustomDate, setFilterCustomDate] = useState<string>("");
  const [filterEmployee, setFilterEmployee] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create Task Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [priority, setPriority] = useState("Medium");
  const [assignedByType, setAssignedByType] = useState<"PM" | "CEO" | "Tester" | "Self Tested">("Self Tested");
  const [timeline, setTimeline] = useState<"today" | "tomorrow" | "custom">("today");
  const [customDate, setCustomDate] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [initialChecklists, setInitialChecklists] = useState<{ id?: number; item_text: string; is_completed?: boolean }[]>([]);
  const [newChecklistInput, setNewChecklistInput] = useState("");
  const [editingInitialChecklistIdx, setEditingInitialChecklistIdx] = useState<number | null>(null);
  const [editingInitialChecklistText, setEditingInitialChecklistText] = useState("");

  // Task-level attachments state (for Create & Edit modals)
  const [initialTaskAttachments, setInitialTaskAttachments] = useState<{ title: string; url: string }[]>([]);
  const [newTaskAttTitle, setNewTaskAttTitle] = useState("");
  const [newTaskAttUrl, setNewTaskAttUrl] = useState("");

  const [editTaskAttachments, setEditTaskAttachments] = useState<{ title: string; url: string }[]>([]);
  const [editTaskAttTitle, setEditTaskAttTitle] = useState("");
  const [editTaskAttUrl, setEditTaskAttUrl] = useState("");

  // Sub-tasks state for Edit Task modal
  const [editChecklists, setEditChecklists] = useState<{ id?: number; item_text: string; is_completed?: boolean }[]>([]);
  const [editNewChecklistInput, setEditNewChecklistInput] = useState("");
  const [editingEditChecklistIdx, setEditingEditChecklistIdx] = useState<number | null>(null);
  const [editingEditChecklistText, setEditingEditChecklistText] = useState("");

  const [assignToAll, setAssignToAll] = useState(false);
  const [isMockTask, setIsMockTask] = useState(false);

  // Sub-task creation state
  const [activeChecklistTaskId, setActiveChecklistTaskId] = useState<number | null>(null);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Inline editing active sub-task state
  const [editingSubTaskId, setEditingSubTaskId] = useState<number | null>(null);
  const [editingSubTaskText, setEditingSubTaskText] = useState("");

  // Update Task Progress Modal state
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [selectedTaskForProgress, setSelectedTaskForProgress] = useState<any>(null);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [hoursSpentToday, setHoursSpentToday] = useState<number>(2.0);
  const [dailySummary, setDailySummary] = useState<string>("");
  const [blockers, setBlockers] = useState<string>("");
  const [progressStatus, setProgressStatus] = useState<string>("In Progress");
  const [submittingProgress, setSubmittingProgress] = useState(false);

  // Finish Task Choice Modal state (Submit for QA Testing vs Direct Complete)
  const [finishChoiceModalOpen, setFinishChoiceModalOpen] = useState(false);
  const [taskToFinishChoice, setTaskToFinishChoice] = useState<any | null>(null);

  // Dedicated Send to Testing Modal state
  const [testingModalOpen, setTestingModalOpen] = useState(false);
  const [selectedTaskForTesting, setSelectedTaskForTesting] = useState<any>(null);
  const [taskLinks, setTaskLinks] = useState<string[]>([""]);
  const [testingNotes, setTestingNotes] = useState<string>("");
  const [testingDeadline, setTestingDeadline] = useState<string>("");
  const [submittingTesting, setSubmittingTesting] = useState(false);

  // Dedicated Direct Submit to Demo Modal state
  const [directSubmitModalOpen, setDirectSubmitModalOpen] = useState(false);
  const [selectedTaskForDirectSubmit, setSelectedTaskForDirectSubmit] = useState<any>(null);
  const [directSubmitLinks, setDirectSubmitLinks] = useState<string[]>([""]);
  const [directSubmitNotes, setDirectSubmitNotes] = useState<string>("");
  const [submittingDirectSubmit, setSubmittingDirectSubmit] = useState(false);

  // Management Edit Task Modal State (CEO, PM, Admin)
  const [editTaskModalOpen, setEditTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState<string[]>([]);
  const [editPriority, setEditPriority] = useState("Medium");
  const [editStatus, setEditStatus] = useState("In Progress");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editTimeline, setEditTimeline] = useState<"today" | "tomorrow" | "custom">("today");
  const [editCustomDate, setEditCustomDate] = useState("");
  const [editStartDate, setEditStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [editExpectedDate, setEditExpectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [editAssignedByType, setEditAssignedByType] = useState("PM");
  const [editProgressPercentage, setEditProgressPercentage] = useState(0);
  const [editHoursSpent, setEditHoursSpent] = useState(0);
  const [editBlockers, setEditBlockers] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [savingEditTask, setSavingEditTask] = useState(false);

  // Delete Task Confirmation State (CEO, PM, Admin)
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<any>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  // Active Timer state
  const [activeUserTimer, setActiveUserTimer] = useState<any>(null);

  // Time Logs History Modal state
  const [timeLogsModalOpen, setTimeLogsModalOpen] = useState(false);
  const [selectedTaskForTimeLogs, setSelectedTaskForTimeLogs] = useState<any>(null);
  const [taskTimeLogs, setTaskTimeLogs] = useState<any[]>([]);
  const [loadingTimeLogs, setLoadingTimeLogs] = useState(false);

  // PM / Admin / CEO Edit Time Log state
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editLogStart, setEditLogStart] = useState("");
  const [editLogEnd, setEditLogEnd] = useState("");
  const [editLogSummary, setEditLogSummary] = useState("");
  const [savingEditLog, setSavingEditLog] = useState(false);

  // Project Credentials Modal State
  const [credentials, setCredentials] = useState<any[]>([]);
  const [projectCredsModalOpen, setProjectCredsModalOpen] = useState(false);
  const [selectedProjectForCreds, setSelectedProjectForCreds] = useState<{ id: number; name: string } | null>(null);
  const [credsVisiblePasswords, setCredsVisiblePasswords] = useState<Record<string, boolean>>({});
  const [credsCopiedKey, setCredsCopiedKey] = useState<string | null>(null);

  // Live Task Monitoring Highlight State
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);
  const [highlightedEmployeeName, setHighlightedEmployeeName] = useState<string | null>(null);

  // Group credentials by project_id for instant lookup
  const projectCredentialsMap = useMemo(() => {
    const map = new Map<number, any[]>();
    credentials.forEach((c) => {
      if (c.project_id) {
        if (!map.has(c.project_id)) map.set(c.project_id, []);
        map.get(c.project_id)!.push(c);
      }
    });
    return map;
  }, [credentials]);

  const fetchCredentials = async () => {
    try {
      const res = await fetch("/api/credentials?_=" + Date.now());
      const data = await res.json();
      if (Array.isArray(data)) setCredentials(data);
    } catch (err) {
      console.error("Failed to fetch credentials:", err);
    }
  };

  const handleCopyCredText = (text: string, keyName: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCredsCopiedKey(keyName);
    showToast(`${label} copied!`, "success");
    setTimeout(() => setCredsCopiedKey(null), 2000);
  };

  const handleToggleCredPassword = (key: string) => {
    setCredsVisiblePasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenProjectCredentials = (projectId: number, projectName: string) => {
    setSelectedProjectForCreds({ id: projectId, name: projectName });
    setProjectCredsModalOpen(true);
  };

  // Helper to get the project live server URL from credentials or task documentation
  const getProjectLiveServerUrl = (projectId?: number) => {
    if (!projectId) return null;
    const creds = projectCredentialsMap.get(projectId) || [];
    const credWithLive = creds.find((c: any) => c.live_link && c.live_link.trim() !== "");
    if (credWithLive?.live_link) return credWithLive.live_link.trim();
    const credWithDemo = creds.find((c: any) => c.demo_link && c.demo_link.trim() !== "");
    if (credWithDemo?.demo_link) return credWithDemo.demo_link.trim();
    return null;
  };

  // Helper to extract structured accounts from credentials text
  const parseCredentialSections = (text: string, defaultRole: string = "Account") => {
    if (!text) return [];
    const lines = text.split("\n");
    const sections: { role: string; username?: string; password?: string; notes?: string; raw: string }[] = [];
    let currentSection: any = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      const roleHeaderMatch = trimmed.match(/^\[(.*?)\]$/);

      if (roleHeaderMatch) {
        if (currentSection) sections.push(currentSection);
        currentSection = { role: roleHeaderMatch[1], raw: line };
      } else {
        if (!currentSection) {
          currentSection = { role: defaultRole, raw: line };
        } else {
          currentSection.raw += "\n" + line;
        }

        const colonIdx = trimmed.indexOf(":");
        if (colonIdx !== -1) {
          const field = trimmed.substring(0, colonIdx).trim().toLowerCase();
          const val = trimmed.substring(colonIdx + 1).trim();
          if (field.includes("user") || field.includes("email") || field.includes("login")) {
            currentSection.username = val;
          } else if (field.includes("pass") || field.includes("pwd") || field.includes("key")) {
            currentSection.password = val;
          } else if (field.includes("role")) {
            currentSection.role = val;
          }
        }
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }
    return sections;
  };

  const fetchActiveUserTimer = async () => {
    try {
      const res = await fetch("/api/tasks/timer?mode=active");
      if (res.ok) {
        const data = await res.json();
        setActiveUserTimer(data.active_timer || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchEmployees();
    fetchCredentials();
    fetchActiveUserTimer();

    const handleTimerUpdate = () => {
      fetchActiveUserTimer();
      fetchTasks();
    };
    window.addEventListener("task-timer-updated", handleTimerUpdate);

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchTasks();
      fetchActiveUserTimer();
    }, 20000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("task-timer-updated", handleTimerUpdate);
    };
  }, []);

  // Direct Start / Resume Timer without custom time selection modal
  const handleStartTimerDirect = async (task: any) => {
    // 1. Validation: Locked statuses where timer cannot be started or resumed
    const LOCKED_TIMER_STATUSES = [
      "Completed",
      "Ready for Demo",
      "Ready for Testing",
      "Testing",
      "Tested (PASS)"
    ];
    if (LOCKED_TIMER_STATUSES.includes(task.status)) {
      let desc = `Task "${task.title}" is in "${task.status}" state and timer cannot be started or resumed.`;
      if (task.status === "Completed") {
        desc = `Task "${task.title}" is already completed and logged (${formatHoursAndMinutes(task.hours_spent)}). Once logged, you cannot start or resume this task again.`;
      } else if (task.status === "Ready for Demo") {
        desc = `Task "${task.title}" has been submitted for Demo. Timer cannot be started or resumed on demo-ready tasks.`;
      } else if (task.status === "Ready for Testing" || task.status === "Testing") {
        desc = `Task "${task.title}" is currently in QA testing ("${task.status}"). Timer cannot be started or resumed while under QA review.`;
      } else if (task.status === "Tested (PASS)") {
        desc = `Task "${task.title}" has passed QA verification ("Tested (PASS)"). Timer is locked unless changes are requested.`;
      }
      showWarning("Timer Locked", desc);
      return;
    }

    // 2. Validation: If another task is active, cannot start until earlier task timer ends
    if (activeUserTimer && activeUserTimer.task_id !== task.id) {
      showWarning(
        "Active Task Timer In Progress",
        `You are currently tracking "${activeUserTimer.task_title}". You cannot start another task timer until the earlier task timer is paused or finished.`
      );
      return;
    }

    try {
      const res = await fetch("/api/tasks/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          task_id: task.id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const isResuming = parseFloat(task.hours_spent) > 0;
        showToast(
          isResuming
            ? `▶ Resumed timer for "${task.title}" (Continuing from ${formatHoursAndMinutes(task.hours_spent)})`
            : `▶ Started timer for "${task.title}"`
        );
        window.dispatchEvent(new Event("task-timer-updated"));
        fetchActiveUserTimer();
        fetchTasks();
      } else {
        showError("Timer Start Blocked", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Failed to start task timer.");
    }
  };

  const handleQuickPauseTimer = async (taskId: number) => {
    try {
      const res = await fetch("/api/tasks/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pause",
          task_id: taskId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Timer paused for break! (${data.duration_minutes || 1}m logged)`);
        window.dispatchEvent(new Event("task-timer-updated"));
        fetchActiveUserTimer();
        fetchTasks();
      } else {
        showError("Failed to Pause Timer", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Failed to pause task timer.");
    }
  };

  const handleQuickFinishTask = (task: any) => {
    setTaskToFinishChoice(task);
    setFinishChoiceModalOpen(true);
  };

  const handleDirectFinishTask = async (task: any) => {
    setFinishChoiceModalOpen(false);
    const isTaskFastTrack = Boolean(task.project_is_fast_track || projectFastTrackMap[task.project_id]);
    const confirmed = await showConfirm(
      "Finish & Complete Task Directly?",
      isTaskFastTrack
        ? `Are you sure you want to finish "${task.title}" directly? This will stop your timer, mark the task as 100% Completed, and permanently record your hours spent today as locked.`
        : `Are you sure you want to finish "${task.title}" directly without QA testing? This will stop your timer, mark the task as 100% Completed, and permanently record your hours spent today as locked.`,
      "Yes, Finish Directly",
      "Keep Working"
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/tasks/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop",
          task_id: task.id,
          task_status: "Completed",
          session_summary: `Task finished and verified complete directly`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess("Task Completed!", `Total recorded time: ${formatHoursAndMinutes(data.hours_spent)} locked in Hours Spent.`);
        window.dispatchEvent(new Event("task-timer-updated"));
        fetchActiveUserTimer();
        fetchTasks();
      } else {
        showError("Failed to Complete Task", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Failed to finish task.");
    } finally {
      setTaskToFinishChoice(null);
    }
  };

  const handleOpenTimeLogs = async (task: any) => {
    setSelectedTaskForTimeLogs(task);
    setTimeLogsModalOpen(true);
    setLoadingTimeLogs(true);
    setEditingLogId(null);
    try {
      const res = await fetch(`/api/tasks/timer?mode=history&task_id=${task.id}`);
      if (res.ok) {
        const data = await res.json();
        setTaskTimeLogs(data.history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTimeLogs(false);
    }
  };

  const handleStartEditLog = (log: any) => {
    setEditingLogId(log.id);
    const startObj = new Date(log.started_at);
    startObj.setMinutes(startObj.getMinutes() - startObj.getTimezoneOffset());
    setEditLogStart(startObj.toISOString().slice(0, 16));

    if (log.ended_at) {
      const endObj = new Date(log.ended_at);
      endObj.setMinutes(endObj.getMinutes() - endObj.getTimezoneOffset());
      setEditLogEnd(endObj.toISOString().slice(0, 16));
    } else {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setEditLogEnd(now.toISOString().slice(0, 16));
    }

    setEditLogSummary(log.session_summary || "");
  };

  const handleSaveEditTimeLog = async (logId: number) => {
    if (!editLogStart || !editLogEnd) {
      showWarning("Required Fields", "Start and end times are required.");
      return;
    }
    setSavingEditLog(true);
    try {
      const res = await fetch("/api/tasks/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_log",
          log_id: logId,
          started_at: new Date(editLogStart).toISOString(),
          ended_at: new Date(editLogEnd).toISOString(),
          session_summary: editLogSummary,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Time log successfully adjusted!");
        setEditingLogId(null);
        if (selectedTaskForTimeLogs) {
          handleOpenTimeLogs(selectedTaskForTimeLogs);
        }
        fetchTasks();
      } else {
        showError("Failed to Adjust", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Failed to edit time log.");
    } finally {
      setSavingEditLog(false);
    }
  };

  const handleDeleteTimeLog = async (logId: number) => {
    const confirmed = await showConfirm(
      "Delete Time Session?",
      "Are you sure you want to delete this time session? The task's total hours spent will be automatically recalculated and synced.",
      "Yes, Delete Session",
      "Cancel"
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/tasks/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_log",
          log_id: logId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Time session deleted and hours updated.");
        if (selectedTaskForTimeLogs) {
          handleOpenTimeLogs(selectedTaskForTimeLogs);
        }
        fetchTasks();
      } else {
        showError("Failed to Delete", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Failed to delete time session.");
    }
  };

  const fetchTasks = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/tasks?_=" + Date.now());
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
      if (isManual) showToast("Daily tasks refreshed!");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects?_=" + Date.now());
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees?_=" + Date.now());
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Compute Auto Sequential Task ID (1, 2, 3, 4...) for each employee
  const employeeTaskSeqMap = useMemo(() => {
    const map: Record<number, number> = {};
    const empTaskGroups: Record<string, any[]> = {};

    // Group tasks per employee
    tasks.forEach((t) => {
      const key = String(t.assigned_to || t.created_by || "unassigned");
      if (!empTaskGroups[key]) empTaskGroups[key] = [];
      empTaskGroups[key].push(t);
    });

    // Sort chronologically per employee (oldest first = Task #1, Task #2...)
    Object.values(empTaskGroups).forEach((group) => {
      group.sort((a, b) => {
        const dateA = new Date(a.created_at || a.target_date || 0).getTime();
        const dateB = new Date(b.created_at || b.target_date || 0).getTime();
        return dateA - dateB || a.id - b.id;
      });

      group.forEach((task, idx) => {
        map[task.id] = idx + 1; // 1, 2, 3, 4...
      });
    });

    return map;
  }, [tasks]);

  // Filter employees assigned to the currently selected project for Create Task Modal
  const projectAssignedEmployees = useMemo(() => {
    if (!projectId) return employees;
    const selectedProj = projects.find((p) => p.id.toString() === projectId);
    if (selectedProj && selectedProj.members && Array.isArray(selectedProj.members) && selectedProj.members.length > 0) {
      const memberIds = new Set(selectedProj.members.map((m: any) => m.id));
      if (selectedProj.created_by) memberIds.add(selectedProj.created_by);
      return employees.filter((e) => memberIds.has(e.id));
    }
    return employees;
  }, [projectId, projects, employees]);

  // Filter employees assigned to the currently selected project for Edit Task Modal
  const editProjectAssignedEmployees = useMemo(() => {
    if (!editProjectId) return employees;
    const selectedProj = projects.find((p) => p.id.toString() === editProjectId);
    if (selectedProj && selectedProj.members && Array.isArray(selectedProj.members) && selectedProj.members.length > 0) {
      const memberIds = new Set(selectedProj.members.map((m: any) => m.id));
      if (selectedProj.created_by) memberIds.add(selectedProj.created_by);
      return employees.filter((e) => memberIds.has(e.id));
    }
    return employees;
  }, [editProjectId, projects, employees]);

  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

  const handleAddInitialChecklist = () => {
    if (!newChecklistInput.trim()) return;
    setInitialChecklists((prev) => [
      ...prev,
      { item_text: newChecklistInput.trim() }
    ]);
    setNewChecklistInput("");
  };

  const handleRemoveInitialChecklist = (index: number) => {
    setInitialChecklists((prev) => prev.filter((_, i) => i !== index));
    if (editingInitialChecklistIdx === index) {
      setEditingInitialChecklistIdx(null);
      setEditingInitialChecklistText("");
    }
  };

  const handleStartEditInitialChecklist = (index: number, currentText: string) => {
    setEditingInitialChecklistIdx(index);
    setEditingInitialChecklistText(currentText);
  };

  const handleSaveEditInitialChecklist = (index: number) => {
    if (!editingInitialChecklistText.trim()) return;
    setInitialChecklists((prev) =>
      prev.map((item, i) => (i === index ? { ...item, item_text: editingInitialChecklistText.trim() } : item))
    );
    setEditingInitialChecklistIdx(null);
    setEditingInitialChecklistText("");
  };

  // Sub-task handlers for Edit Task Modal
  const handleAddEditChecklist = () => {
    if (!editNewChecklistInput.trim()) return;
    setEditChecklists((prev) => [
      ...prev,
      { item_text: editNewChecklistInput.trim(), is_completed: false }
    ]);
    setEditNewChecklistInput("");
  };

  const handleRemoveEditChecklist = (index: number) => {
    setEditChecklists((prev) => prev.filter((_, i) => i !== index));
    if (editingEditChecklistIdx === index) {
      setEditingEditChecklistIdx(null);
      setEditingEditChecklistText("");
    }
  };

  const handleStartEditEditChecklist = (index: number, currentText: string) => {
    setEditingEditChecklistIdx(index);
    setEditingEditChecklistText(currentText);
  };

  const handleSaveEditEditChecklist = (index: number) => {
    if (!editingEditChecklistText.trim()) return;
    setEditChecklists((prev) =>
      prev.map((item, i) => (i === index ? { ...item, item_text: editingEditChecklistText.trim() } : item))
    );
    setEditingEditChecklistIdx(null);
    setEditingEditChecklistText("");
  };

  // Task-level attachment handlers for Create Task Modal
  const handleAddInitialTaskAttachment = () => {
    if (!newTaskAttTitle.trim() || !newTaskAttUrl.trim()) {
      showWarning("Missing Details", "Please enter both an attachment title and URL.");
      return;
    }
    let urlToUse = newTaskAttUrl.trim();
    if (!urlToUse.startsWith("http://") && !urlToUse.startsWith("https://")) {
      urlToUse = "https://" + urlToUse;
    }
    setInitialTaskAttachments((prev) => [...prev, { title: newTaskAttTitle.trim(), url: urlToUse }]);
    setNewTaskAttTitle("");
    setNewTaskAttUrl("");
  };

  const handleRemoveInitialTaskAttachment = (index: number) => {
    setInitialTaskAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Task-level attachment handlers for Edit Task Modal
  const handleAddEditTaskAttachment = () => {
    if (!editTaskAttTitle.trim() || !editTaskAttUrl.trim()) {
      showWarning("Missing Details", "Please enter both an attachment title and URL.");
      return;
    }
    let urlToUse = editTaskAttUrl.trim();
    if (!urlToUse.startsWith("http://") && !urlToUse.startsWith("https://")) {
      urlToUse = "https://" + urlToUse;
    }
    setEditTaskAttachments((prev) => [...prev, { title: editTaskAttTitle.trim(), url: urlToUse }]);
    setEditTaskAttTitle("");
    setEditTaskAttUrl("");
  };

  const handleRemoveEditTaskAttachment = (index: number) => {
    setEditTaskAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteSubTask = async (checklistId: number) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_checklist",
          checklist_id: checklistId,
        }),
      });
      if (res.ok) {
        fetchTasks();
        showToast("Sub-task deleted!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateSubTaskText = async (checklistId: number) => {
    if (!editingSubTaskText.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_checklist",
          checklist_id: checklistId,
          item_text: editingSubTaskText.trim(),
        }),
      });
      if (res.ok) {
        setEditingSubTaskId(null);
        setEditingSubTaskText("");
        fetchTasks();
        showToast("Sub-task text updated!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !projectId) {
      showWarning("Missing Fields", "Please enter a title and select a project.");
      return;
    }

    setSubmitting(true);
    try {
      const finalAssignees = canManageAllTasks 
        ? (assignedTo.length > 0 ? assignedTo : [currentUserId.toString()])
        : [currentUserId.toString()];

      const finalStartDate = startDate || todayStr;
      const finalExpectedDate = expectedDate || todayStr;

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          project_id: projectId,
          assigned_to: finalAssignees,
          priority,
          assigned_by_type: assignedByType,
          start_date: finalStartDate,
          expected_date: finalExpectedDate,
          target_date: finalExpectedDate,
          due_date: finalExpectedDate,
          timeline: finalExpectedDate === tomorrowStr ? "tomorrow" : (finalExpectedDate === todayStr ? "today" : "custom"),
          checklists: initialChecklists,
          attachments: initialTaskAttachments,
          assign_to_all: assignToAll,
          is_mock_task: isMockTask,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreateModalOpen(false);
        fetchTasks();
        setTitle("");
        setDescription("");
        setProjectId("");
        setAssignedTo([]);
        setPriority("Medium");
        setAssignedByType("Self Tested");
        setTimeline("today");
        setCustomDate("");
        setStartDate(todayStr);
        setExpectedDate(todayStr);
        setInitialChecklists([]);
        setNewChecklistInput("");
        setInitialTaskAttachments([]);
        setNewTaskAttTitle("");
        setNewTaskAttUrl("");
        setAssignToAll(false);
        setIsMockTask(false);
        showToast(data.message || "Task created successfully!");
      } else {
        showError("Failed to Create Task", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Failed to submit task.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Task Modal (PM, CEO, Admin, Developer, Tester)
  const openEditTaskModal = (task: any) => {
    setEditingTask(task);
    setEditTitle(task.title || "");
    setEditDescription(task.description || "");
    setEditProjectId(task.project_id ? task.project_id.toString() : "");
    if (task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0) {
      setEditAssignedTo(task.assignees.map((a: any) => a.id.toString()));
    } else if (task.assigned_to) {
      setEditAssignedTo([task.assigned_to.toString()]);
    } else {
      setEditAssignedTo([]);
    }
    setEditPriority(task.priority || "Medium");
    setEditStatus(task.status || "In Progress");

    // Start date & Expected date prefill
    const sDate = task.start_date ? (task.start_date.includes("T") ? task.start_date.split("T")[0] : task.start_date) : (task.created_at ? task.created_at.split("T")[0] : todayStr);
    const expDate = task.expected_date ? (task.expected_date.includes("T") ? task.expected_date.split("T")[0] : task.expected_date) : (task.target_date ? (task.target_date.includes("T") ? task.target_date.split("T")[0] : task.target_date) : (task.due_date ? (task.due_date.includes("T") ? task.due_date.split("T")[0] : task.due_date) : todayStr));
    setEditStartDate(sDate);
    setEditExpectedDate(expDate);

    // Target date handling & timeline prefill
    const taskDate = expDate || "";
    setEditTargetDate(taskDate);
    if (taskDate === todayStr) {
      setEditTimeline("today");
      setEditCustomDate("");
    } else if (taskDate === tomorrowStr) {
      setEditTimeline("tomorrow");
      setEditCustomDate("");
    } else if (taskDate) {
      setEditTimeline("custom");
      setEditCustomDate(taskDate);
    } else {
      setEditTimeline("today");
      setEditCustomDate("");
    }

    setEditAssignedByType(task.assigned_by_type || "PM");
    setEditProgressPercentage(task.progress_percentage || 0);
    setEditHoursSpent(parseFloat(task.hours_spent) || 0);
    setEditBlockers(task.blockers || "");
    setEditRemarks(task.remarks || "");

    // Attachments normalization & prefill
    let rawAtts: any[] = [];
    if (Array.isArray(task.attachments)) {
      rawAtts = task.attachments;
    } else if (typeof task.attachments === "string" && task.attachments.trim() !== "") {
      try {
        rawAtts = JSON.parse(task.attachments);
      } catch (_) {}
    }
    if (rawAtts.length === 0) {
      if (Array.isArray(task.task_links) && task.task_links.length > 0) {
        rawAtts = task.task_links.map((link: string, i: number) => ({ title: `Link #${i + 1}`, url: link }));
      } else if (task.task_link) {
        rawAtts = [{ title: "Reference Link", url: task.task_link }];
      }
    }
    setEditTaskAttachments(rawAtts);
    setEditTaskAttTitle("");
    setEditTaskAttUrl("");

    // Checklists normalization & prefill
    let rawChecklists: any[] = [];
    if (Array.isArray(task.checklists)) {
      rawChecklists = task.checklists.map((c: any) => ({
        id: c.id,
        item_text: typeof c === "string" ? c : (c.item_text || ""),
        is_completed: typeof c === "object" ? Boolean(c.is_completed) : false,
      }));
    }
    setEditChecklists(rawChecklists);
    setEditNewChecklistInput("");
    setEditingEditChecklistIdx(null);
    setEditingEditChecklistText("");
    setEditTaskModalOpen(true);
  };

  // Save Edit Task
  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    if (!editStartDate) {
      showError("Invalid Date", "Please select a start date.");
      return;
    }
    if (!editExpectedDate) {
      showError("Invalid Date", "Please select an expected date.");
      return;
    }

    setSavingEditTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTask.id,
          action: "admin_edit",
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          project_id: editProjectId ? parseInt(editProjectId) : undefined,
          assigned_to: canManageAllTasks ? editAssignedTo.map((id) => parseInt(id)) : undefined,
          priority: editPriority,
          status: editStatus,
          start_date: editStartDate,
          expected_date: editExpectedDate,
          target_date: editExpectedDate,
          due_date: editExpectedDate,
          assigned_by_type: editAssignedByType,
          progress_percentage: editProgressPercentage,
          hours_spent: editHoursSpent,
          blockers: editBlockers || null,
          remarks: editRemarks || null,
          attachments: editTaskAttachments,
          checklists: editChecklists,
        }),
      });

      if (res.ok) {
        setEditTaskModalOpen(false);
        setEditingTask(null);
        fetchTasks();
        showToast("Task updated successfully!");
      } else {
        const data = await res.json();
        showError("Failed to Update Task", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error updating task.");
    } finally {
      setSavingEditTask(false);
    }
  };

  // Confirm Delete Task (PM, CEO, Admin)
  const confirmDeleteTask = async () => {
    if (!deleteConfirmTask) return;

    setDeletingTask(true);
    try {
      const res = await fetch(`/api/tasks?id=${deleteConfirmTask.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirmTask(null);
        fetchTasks();
        showToast("Task deleted successfully!");
      } else {
        const data = await res.json();
        showError("Failed to Delete Task", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error deleting task.");
    } finally {
      setDeletingTask(false);
    }
  };

  // Open Update Progress Modal
  const openProgressModal = (task: any) => {
    setSelectedTaskForProgress(task);
    setProgressPercentage(task.progress_percentage || 0);
    const recordedHours = task.hours_spent !== null && task.hours_spent !== undefined ? parseFloat(task.hours_spent) : 0;
    setHoursSpentToday(recordedHours || 0);
    setDailySummary(task.daily_summary || "");
    setBlockers(task.blockers || "");
    
    const validStatuses = ["Planning", "In Progress", "Completed"];
    setProgressStatus(validStatuses.includes(task.status) ? task.status : "In Progress");
    setProgressModalOpen(true);
  };

  // Save Progress
  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalHours = (parseFloat(selectedTaskForProgress.hours_spent) > 0 && !canManageAllTasks)
      ? parseFloat(selectedTaskForProgress.hours_spent)
      : Math.max(0, Number(hoursSpentToday) || 0);

    const is100Pct = Number(progressPercentage) === 100 || progressStatus === "Completed";
    const finalStatus = is100Pct ? "Completed" : progressStatus;
    const finalPct = is100Pct ? 100 : progressPercentage;

    setSubmittingProgress(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTaskForProgress.id,
          status: finalStatus,
          progress_percentage: finalPct,
          hours_spent: finalHours,
          daily_summary: dailySummary.trim(),
          blockers: blockers.trim() || null,
        }),
      });

      if (res.ok) {
        setProgressModalOpen(false);
        setSelectedTaskForProgress(null);
        fetchTasks();
        window.dispatchEvent(new Event("task-timer-updated"));
        showToast(is100Pct ? "Task finished & marked Completed (100%)!" : "Progress updated!");
      } else {
        const data = await res.json();
        showError("Update Failed", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("An error occurred while updating task progress.");
    } finally {
      setSubmittingProgress(false);
    }
  };

  // Open Dedicated Send to Testing Modal (Standard QA only; Fast-track routes to Demo)
  const openSendToTestingModal = (task: any) => {
    const isTaskFastTrack = Boolean(task.project_is_fast_track || projectFastTrackMap[task.project_id]);
    if (isTaskFastTrack) {
      openDirectSubmitModal(task);
      return;
    }
    setSelectedTaskForTesting(task);
    const existingLinks = Array.isArray(task.task_links) && task.task_links.length > 0
      ? task.task_links
      : task.task_link ? [task.task_link] : [""];
    setTaskLinks(existingLinks);
    setTestingNotes("");

    // Prefill default testing deadline: Today at 6:00 PM or 4 hours from now
    const now = new Date();
    now.setHours(18, 0, 0, 0);
    if (now.getTime() <= Date.now() + 3600000) {
      now.setDate(now.getDate() + 1);
    }
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const defaultVal = `${year}-${month}-${day}T${hours}:${mins}`;

    if (task.testing_deadline) {
      try {
        const d = new Date(task.testing_deadline);
        const dy = d.getFullYear();
        const dm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dh = String(d.getHours()).padStart(2, "0");
        const dmi = String(d.getMinutes()).padStart(2, "0");
        setTestingDeadline(`${dy}-${dm}-${dd}T${dh}:${dmi}`);
      } catch (_) {
        setTestingDeadline(defaultVal);
      }
    } else {
      setTestingDeadline(defaultVal);
    }

    setTestingModalOpen(true);
  };

  const handleAddLinkInput = () => {
    setTaskLinks((prev) => [...prev, ""]);
  };

  const handleRemoveLinkInput = (index: number) => {
    setTaskLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLinkChange = (index: number, val: string) => {
    setTaskLinks((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleSendToTestingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForTesting) return;

    const validLinks = taskLinks.filter((l) => l && l.trim());
    if (validLinks.length === 0) {
      showWarning("Link Required", "Please provide at least one valid preview / PR link for the QA tester.");
      return;
    }

    setSubmittingTesting(true);
    try {
      // Auto-stop active timer if currently running on this task
      if (activeUserTimer && activeUserTimer.task_id === selectedTaskForTesting.id) {
        try {
          await fetch("/api/tasks/timer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "stop",
              task_id: selectedTaskForTesting.id,
              session_summary: `Work finished and sent to QA testing`,
              task_status: "Ready for Testing"
            }),
          });
          window.dispatchEvent(new Event("task-timer-updated"));
        } catch (timerErr) {
          console.error("Auto-stop timer error on send to testing:", timerErr);
        }
      }

      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTaskForTesting.id,
          action: "send_to_testing",
          task_links: validLinks,
          testing_deadline: testingDeadline ? testingDeadline : undefined,
          remarks: testingNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        setTestingModalOpen(false);
        setSelectedTaskForTesting(null);
        fetchActiveUserTimer();
        fetchTasks();
        showSuccess("Submitted for QA", "Task moved to QA Testing queue.");
      } else {
        const data = await res.json();
        showError("Submission Failed", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("An error occurred while submitting task to testing.");
    } finally {
      setSubmittingTesting(false);
    }
  };

  // Open Dedicated Direct Submit to Demo Modal
  const openDirectSubmitModal = (task: any) => {
    setSelectedTaskForDirectSubmit(task);
    const existingLinks = Array.isArray(task.task_links) && task.task_links.length > 0
      ? task.task_links
      : task.task_link ? [task.task_link] : [""];
    setDirectSubmitLinks(existingLinks);
    setDirectSubmitNotes("");
    setDirectSubmitModalOpen(true);
  };

  const handleDirectSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForDirectSubmit) return;

    const validLinks = directSubmitLinks.filter((l) => l && l.trim());
    if (validLinks.length === 0) {
      showWarning("Link Required", "Please provide at least one valid preview/demo link.");
      return;
    }

    setSubmittingDirectSubmit(true);
    try {
      // Auto-stop active timer if currently running on this task
      if (activeUserTimer && activeUserTimer.task_id === selectedTaskForDirectSubmit.id) {
        try {
          await fetch("/api/tasks/timer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "stop",
              task_id: selectedTaskForDirectSubmit.id,
              session_summary: `Work finished and fast-tracked directly to Demo`,
              task_status: "Ready for Demo"
            }),
          });
          window.dispatchEvent(new Event("task-timer-updated"));
        } catch (timerErr) {
          console.error("Auto-stop timer error on direct submit:", timerErr);
        }
      }

      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTaskForDirectSubmit.id,
          action: "direct_submit",
          task_links: validLinks,
          remarks: directSubmitNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        setDirectSubmitModalOpen(false);
        setSelectedTaskForDirectSubmit(null);
        fetchActiveUserTimer();
        fetchTasks();
        showSuccess("Submitted for Demo", "Task fast-tracked and marked Ready for Demo! Management notified.");
      } else {
        const data = await res.json();
        showError("Submission Failed", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("An error occurred while submitting task directly to demo.");
    } finally {
      setSubmittingDirectSubmit(false);
    }
  };

  const updateStatus = async (taskId: number, newStatus: string) => {
    try {
      const LOCKED_TIMER_STATUSES = ["Completed", "Ready for Demo", "Ready for Testing", "Testing", "Tested (PASS)"];
      if (activeUserTimer && activeUserTimer.task_id === taskId && LOCKED_TIMER_STATUSES.includes(newStatus)) {
        try {
          await fetch("/api/tasks/timer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "stop",
              task_id: taskId,
              session_summary: `Timer ended on status change to ${newStatus}`,
              task_status: newStatus
            }),
          });
          window.dispatchEvent(new Event("task-timer-updated"));
        } catch (tErr) {
          console.error("Error auto-stopping timer on status change:", tErr);
        }
      }

      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      if (res.ok) {
        fetchActiveUserTimer();
        fetchTasks();
      } else {
        showError("Failed to update status.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChecklist = async (taskId: number) => {
    if (!newChecklistText.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_checklist",
          task_id: taskId,
          item_text: newChecklistText.trim(),
        }),
      });
      if (res.ok) {
        setNewChecklistText("");
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleChecklist = async (checklistId: number, currentCompleted: boolean) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_checklist",
          checklist_id: checklistId,
          is_completed: !currentCompleted,
        }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string, task?: any) => {
    if (task?.is_testing_overdue) {
      return (
        <Badge className="bg-red-600 text-white font-extrabold border border-red-400 animate-pulse flex items-center gap-1 shadow-xs">
          <AlertTriangle className="h-3 w-3 text-red-100" /> 🚨 QA OVERDUE
        </Badge>
      );
    }
    switch (status) {
      case "Planning":
        return <Badge className="bg-purple-600 text-white font-bold">Planning</Badge>;
      case "In Progress":
        return <Badge className="bg-sky-500 text-white font-bold animate-pulse">In Progress</Badge>;
      case "Ready for Testing":
        return <Badge className="bg-amber-500 text-white font-bold animate-bounce">Ready for Testing</Badge>;
      case "Testing":
        return <Badge className="bg-amber-600 text-white font-bold">Testing in Progress</Badge>;
      case "Changes Required":
        return <Badge className="bg-red-600 text-white font-bold">Changes Required</Badge>;
      case "Tested (PASS)":
        return <Badge className="bg-emerald-600 text-white font-bold">QA Passed</Badge>;
      case "Ready for Demo":
        return <Badge className="bg-indigo-600 text-white font-bold shadow-md animate-pulse">🚀 Ready for Demo</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-500 text-white font-bold">Completed</Badge>;
      default:
        return <Badge variant="outline" className="font-semibold">{status}</Badge>;
    }
  };

  // Comprehensive Multi-dimensional Filter
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const taskExpDate = t.expected_date ? t.expected_date.split("T")[0] : (t.target_date ? t.target_date.split("T")[0] : todayStr);
      const taskStartDate = t.start_date ? t.start_date.split("T")[0] : (t.created_at ? t.created_at.split("T")[0] : todayStr);
      const isFinished = ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status);
      const isCompleted = t.status === "Completed" || t.status === "Ready for Demo";

      // 1. Tab filtering
      let matchTab = true;
      if (activeTab === "today") {
        // Today's task: Scheduled today OR started earlier but still unfinished (carried over).
        // Yesterday's finished tasks must NOT be shown in today's tab.
        const isScheduledToday = taskExpDate === todayStr || taskStartDate === todayStr;
        const isUnfinishedPastTask = !isFinished && (taskStartDate <= todayStr || taskExpDate <= todayStr);
        matchTab = isScheduledToday || isUnfinishedPastTask;
      } else if (activeTab === "tomorrow") {
        matchTab = taskExpDate > todayStr;
      } else if (activeTab === "assigned_pm") {
        matchTab = t.assigned_by_type === "PM" || t.creator_role === "PM" || t.project_creator_role === "PM";
      } else if (activeTab === "assigned_ceo") {
        matchTab = t.assigned_by_type === "CEO" || t.creator_role === "CEO" || t.project_creator_role === "CEO";
      } else if (activeTab === "from_tester") {
        matchTab = t.assigned_by_type === "Tester" || t.status === "Changes Required" || t.status === "Ready for Testing" || t.status === "Testing" || t.creator_role === "Tester";
      } else if (activeTab === "submitted_testing") {
        matchTab = t.status === "Ready for Testing" || t.status === "Testing" || Boolean(t.sent_to_testing_at);
      } else if (activeTab === "self_created") {
        matchTab = t.assigned_by_type === "Self Tested" || t.created_by === currentUserId;
      } else if (activeTab === "incomplete") {
        matchTab = !isCompleted;
      } else if (activeTab === "overdue") {
        matchTab = !isCompleted && taskExpDate < todayStr;
      }

      if (!matchTab) return false;

      // 2. Status filter dropdown (Incomplete, Overdue, or specific status)
      if (filterStatus === "INCOMPLETE") {
        if (isCompleted) return false;
      } else if (filterStatus === "OVERDUE") {
        if (isCompleted || taskExpDate >= todayStr) return false;
      } else if (filterStatus !== "ALL" && t.status !== filterStatus) {
        return false;
      }

      // 3. Project filter
      if (filterProject !== "ALL" && String(t.project_id) !== String(filterProject)) {
        return false;
      }

      // 4. Employee / Developer Advance filter (for PM/CEO/Admin)
      if (filterEmployee !== "ALL" && String(t.assigned_to) !== String(filterEmployee)) {
        return false;
      }

      // 5. Date filter (checks both expected date and start date, plus unfinished carryovers)
      if (filterDateMode === "TODAY") {
        const isScheduledToday = taskExpDate === todayStr || taskStartDate === todayStr;
        const isUnfinishedPastTask = !isFinished && (taskStartDate <= todayStr || taskExpDate <= todayStr);
        if (!isScheduledToday && !isUnfinishedPastTask) {
          return false;
        }
      }
      if (filterDateMode === "TOMORROW" && taskExpDate !== tomorrowStr) {
        return false;
      }
      if (filterDateMode === "CUSTOM" && filterCustomDate && taskExpDate !== filterCustomDate && taskStartDate !== filterCustomDate) {
        return false;
      }

      // 6. Search query filter (title, description, project name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchProj = t.project_name?.toLowerCase().includes(q);
        const matchDev = t.assignee_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchProj && !matchDev) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, activeTab, filterProject, filterEmployee, filterDateMode, filterCustomDate, filterStatus, searchQuery, todayStr, tomorrowStr, currentUserId]);

  const projectFastTrackMap = useMemo(() => {
    const map: Record<number, boolean> = {};
    if (Array.isArray(projects)) {
      projects.forEach((p: any) => {
        map[p.id] = Boolean(p.is_fast_track);
      });
    }
    return map;
  }, [projects]);

  // Jump to and highlight an active task from live activity monitor
  const handleScrollAndHighlightTask = (taskId: number, employeeName?: string) => {
    setHighlightedTaskId(taskId);
    if (employeeName) setHighlightedEmployeeName(employeeName);

    // Ensure the task is visible in the current filtered table
    const isCurrentlyVisible = filteredTasks.some((t) => t.id === taskId);
    if (!isCurrentlyVisible) {
      setActiveTab("all");
      setSearchQuery("");
      setFilterProject("ALL");
      setFilterEmployee("ALL");
      setFilterDateMode("ALL");
      setFilterCustomDate("");
    }

    // Smooth scroll down to target task row
    setTimeout(() => {
      const el = document.getElementById(`task-row-${taskId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTimeout(() => {
          document.getElementById(`task-row-${taskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
      }
    }, 150);

    showToast(`Focused on active task #${taskId}${employeeName ? ` by ${employeeName}` : ""}`, "info");
  };

  const countToday = tasks.filter((t) => {
    const taskExpDate = t.expected_date ? t.expected_date.split("T")[0] : (t.target_date ? t.target_date.split("T")[0] : todayStr);
    const taskStartDate = t.start_date ? t.start_date.split("T")[0] : (t.created_at ? t.created_at.split("T")[0] : todayStr);
    const isFinished = ["Completed", "Ready for Demo", "Tested (PASS)"].includes(t.status);
    const isScheduledToday = taskExpDate === todayStr || taskStartDate === todayStr;
    const isUnfinishedPastTask = !isFinished && (taskStartDate <= todayStr || taskExpDate <= todayStr);
    return isScheduledToday || isUnfinishedPastTask;
  }).length;

  const countTomorrow = tasks.filter((t) => {
    const taskExpDate = t.expected_date ? t.expected_date.split("T")[0] : (t.target_date ? t.target_date.split("T")[0] : todayStr);
    return taskExpDate > todayStr;
  }).length;
  const countPM = tasks.filter((t) => t.assigned_by_type === "PM" || t.creator_role === "PM" || t.project_creator_role === "PM").length;
  const countCEO = tasks.filter((t) => t.assigned_by_type === "CEO" || t.creator_role === "CEO" || t.project_creator_role === "CEO").length;
  const countTester = tasks.filter((t) => t.assigned_by_type === "Tester" || t.status === "Changes Required" || t.status === "Ready for Testing" || t.status === "Testing" || t.creator_role === "Tester").length;
  const countSelf = tasks.filter((t) => t.assigned_by_type === "Self Tested" || t.created_by === currentUserId).length;
  const countIncomplete = tasks.filter((t) => {
    const isCompleted = t.status === "Completed" || t.status === "Ready for Demo";
    return !isCompleted;
  }).length;
  const countOverdue = tasks.filter((t) => {
    const taskExpDate = t.expected_date ? t.expected_date.split("T")[0] : (t.target_date ? t.target_date.split("T")[0] : todayStr);
    const isCompleted = t.status === "Completed" || t.status === "Ready for Demo";
    return !isCompleted && taskExpDate < todayStr;
  }).length;

  const tasksSubmittedForTesting = tasks.filter(
    (t) => t.status === "Ready for Testing" || t.status === "Testing" || Boolean(t.sent_to_testing_at)
  );
  const projectsSubmittedSet = new Set<string>();
  tasksSubmittedForTesting.forEach((t) => {
    if (t.project_name) projectsSubmittedSet.add(t.project_name);
  });
  const countProjectsSubmittedTesting = projectsSubmittedSet.size;
  const countTasksSubmittedTesting = tasksSubmittedForTesting.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-sky-500" />
            Daily Tasks Hub & Progress Management
          </h1>
          <p className="text-slate-500 mt-1">
            {role === "Developer" || role === "Tester"
              ? "Auto-numbered daily tasks, target dates, progress tracking, and QA submissions."
              : "Company-wide task hub: filter by developer, project, and date, edit task scopes, and manage releases."}
          </p>
        </div>

        {/* Top Right Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchTasks(true)}
            disabled={refreshing}
            className="h-9 px-3 text-xs font-bold gap-1 text-slate-700 hover:text-sky-600 bg-white shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-sky-600" : ""}`} />
            Refresh
          </Button>

          {/* Create Task Button */}
          <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
            <DialogTrigger render={<Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md flex items-center gap-2" />}>
              <Plus className="h-4 w-4" /> {canManageAllTasks ? "Create & Assign Task" : "Create Daily Task"}
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-sky-500" /> 
                  {canManageAllTasks ? "Create & Assign Task" : "Create Daily Task for Assigned Project"}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="font-semibold text-slate-700">Task Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Implement Stripe Webhook Listener"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="font-semibold text-slate-700">Description / Goal</Label>
                  <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed description of task deliverables and requirements..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed"
                  />
                </div>

                <div className={`grid grid-cols-1 ${canManageAllTasks ? "md:grid-cols-2" : "md:grid-cols-3"} gap-3`}>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Project *</Label>
                    <Select value={projectId} onValueChange={(val) => setProjectId(val || "")}>
                      <SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.name} {p.creator_name ? `(By: ${p.creator_name})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Task Assigned By *</Label>
                    <Select value={assignedByType} onValueChange={(val: any) => setAssignedByType(val || "Self Tested")}>
                      <SelectTrigger><SelectValue placeholder="Assigned By" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PM">📋 PM (Project Manager)</SelectItem>
                        <SelectItem value="CEO">👑 CEO (Executive)</SelectItem>
                        <SelectItem value="Tester">🧪 Tester (QA Bug Fix)</SelectItem>
                        <SelectItem value="Self Tested">✍️ Self Tested</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!canManageAllTasks && (
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-slate-700">Priority</Label>
                      <Select value={priority} onValueChange={(val) => setPriority(val || "Medium")}>
                        <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {canManageAllTasks && (
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 text-xs flex items-center justify-between">
                      <span>
                        <Users className="h-3.5 w-3.5 inline text-sky-500 mr-1" />
                        Assign Team Members * {assignedTo.length > 0 && `(${assignedTo.length} selected)`}
                        {projectId && (
                          <span className="ml-1 text-[10px] text-sky-700 font-bold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                            Project Members ({projectAssignedEmployees.length})
                          </span>
                        )}
                      </span>
                      {assignedTo.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAssignedTo([])}
                          className="text-[10px] text-red-500 hover:underline font-bold"
                        >
                          Clear Selection
                        </button>
                      )}
                    </Label>
                    {assignToAll ? (
                      <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-sky-50 border border-sky-200 text-xs font-bold text-sky-900">
                        <Sparkles className="h-3.5 w-3.5 text-sky-600 animate-pulse" />
                        <span>All Project Team Members ({projectAssignedEmployees.length} Members)</span>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl bg-white p-2 space-y-1 max-h-36 overflow-y-auto">
                        {projectAssignedEmployees.length === 0 ? (
                          <p className="text-xs text-slate-400 italic p-2 text-center">No team members assigned to this project.</p>
                        ) : (
                          projectAssignedEmployees.map((e) => {
                            const isSelected = assignedTo.includes(e.id.toString());
                            return (
                              <div
                                key={e.id}
                                onClick={() => {
                                  setAssignedTo((prev) =>
                                    isSelected
                                      ? prev.filter((x) => x !== e.id.toString())
                                      : [...prev, e.id.toString()]
                                  );
                                }}
                                className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-sky-50 text-sky-900 font-bold border border-sky-200"
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded border-slate-300 text-sky-600 h-3.5 w-3.5 cursor-pointer"
                                  />
                                  <span>{e.name}</span>
                                </div>
                                <Badge variant="outline" className="text-[10px] font-semibold text-slate-500">
                                  {e.role}
                                </Badge>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Special Mass Assignment for CEO, PM, Admin */}
                {canManageAllTasks && (
                  <div className="p-3 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50/90 via-indigo-50/60 to-purple-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-sky-600" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            Assign to Everyone ({employees.length} Employees)
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Creates an individual copy for each active team member.
                          </span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={assignToAll}
                          onChange={(e) => setAssignToAll(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Task Schedule Dates (Start Date default Today & Expected Date) */}
                <div className="space-y-3 p-3.5 bg-gradient-to-br from-slate-50 to-sky-50/30 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Calendar className="h-4 w-4 text-sky-600" /> Task Schedule & Dates
                    </Label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Start date defaults to today
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Start Date */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="taskStartDate" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <Play className="h-3 w-3 text-emerald-600" /> Start Date *
                        </Label>
                        {startDate === todayStr && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">Today</span>
                        )}
                      </div>
                      <Input
                        id="taskStartDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStartDate(val);
                          if (expectedDate && val && expectedDate < val) {
                            setExpectedDate(val);
                          }
                        }}
                        className="bg-white text-xs font-medium border-slate-300 focus:border-sky-500"
                        required
                      />
                    </div>

                    {/* Expected Date */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="taskExpectedDate" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-sky-600" /> Expected Date *
                        </Label>
                        {expectedDate === todayStr ? (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">Today</span>
                        ) : expectedDate === tomorrowStr ? (
                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.2 rounded">Tomorrow</span>
                        ) : null}
                      </div>
                      <Input
                        id="taskExpectedDate"
                        type="date"
                        min={startDate || undefined}
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        className="bg-white text-xs font-medium border-slate-300 focus:border-sky-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons for Expected Date */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 font-semibold mr-1">Quick Expected:</span>
                    <button
                      type="button"
                      onClick={() => setExpectedDate(todayStr)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        expectedDate === todayStr
                          ? "bg-amber-500 text-white shadow-2xs"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Flame className="h-3 w-3" /> Due Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpectedDate(tomorrowStr)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        expectedDate === tomorrowStr
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <SunMedium className="h-3 w-3" /> Due Tomorrow
                    </button>
                  </div>
                </div>

                {/* Task-Level Attachments & Reference Links */}
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Label className="font-bold text-slate-900 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="h-4 w-4 text-sky-500" /> Task Attachments & Reference Links (Optional)
                    </span>
                    {initialTaskAttachments.length > 0 && (
                      <span className="text-[10px] text-sky-600 font-bold">{initialTaskAttachments.length} Attached</span>
                    )}
                  </Label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Attachment Title (e.g. Figma / Spec)"
                      value={newTaskAttTitle}
                      onChange={(e) => setNewTaskAttTitle(e.target.value)}
                      className="bg-white text-xs h-8"
                    />
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="URL (e.g. https://...)"
                        value={newTaskAttUrl}
                        onChange={(e) => setNewTaskAttUrl(e.target.value)}
                        className="bg-white text-xs h-8 flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddInitialTaskAttachment();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddInitialTaskAttachment}
                        className="h-8 px-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shrink-0 flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    </div>
                  </div>

                  {initialTaskAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200 max-h-32 overflow-y-auto">
                      {initialTaskAttachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-medium text-slate-800"
                        >
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-sky-600 hover:underline flex items-center gap-1 max-w-[150px] truncate"
                          >
                            <Link2 className="h-3 w-3 shrink-0 text-sky-500" />
                            <span className="truncate">{att.title || att.url}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveInitialTaskAttachment(idx)}
                            className="text-red-500 hover:text-red-700 p-0.5 rounded shrink-0 cursor-pointer"
                            title="Remove attachment"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtasks / Checklist */}
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <ListTodo className="h-4 w-4 text-sky-500" /> Add Checklist Sub-tasks (Optional)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Write unit test cases"
                      value={newChecklistInput}
                      onChange={(e) => setNewChecklistInput(e.target.value)}
                      className="bg-white text-xs h-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddInitialChecklist();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddInitialChecklist}
                      className="h-8 bg-sky-600 text-white font-semibold text-xs shrink-0"
                    >
                      Add
                    </Button>
                  </div>

                  {initialChecklists.length > 0 && (
                    <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                      {initialChecklists.map((item, idx) => (
                        <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2">
                          {editingInitialChecklistIdx === idx ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <Input
                                value={editingInitialChecklistText}
                                onChange={(e) => setEditingInitialChecklistText(e.target.value)}
                                className="h-7 text-xs bg-white flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveEditInitialChecklist(idx);
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveEditInitialChecklist(idx)}
                                className="h-7 px-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shrink-0"
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-slate-800 font-medium whitespace-pre-wrap break-words [overflow-wrap:anywhere] flex-1 leading-relaxed">
                                ✓ {item.item_text}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditInitialChecklist(idx, item.item_text)}
                                  className="text-sky-600 hover:text-sky-800 hover:bg-sky-50 p-1 rounded cursor-pointer"
                                  title="Edit sub-task text"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInitialChecklist(idx)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded cursor-pointer"
                                  title="Delete sub-task"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2"
                >
                  {submitting ? "Creating Task..." : "Create Task"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Live Team Activity Monitor (PM, Admin, CEO) */}
      {canManageAllTasks && (
        <LiveTeamActivityMonitor 
          onSelectTask={handleScrollAndHighlightTask}
          selectedTaskId={highlightedTaskId}
        />
      )}

      {/* Active Ongoing Timer Quick Jump Banner (Developers / Testers) */}
      {!canManageAllTasks && activeUserTimer && (
        <div 
          onClick={() => handleScrollAndHighlightTask(activeUserTimer.task_id, session?.user?.name || undefined)}
          className="rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 shadow-xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer flex items-center justify-between gap-4 group"
          title="Click to jump to and highlight your active ongoing task"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Play className="h-4 w-4 fill-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">Your Active Ongoing Task</span>
                <Badge className="bg-emerald-200 text-emerald-900 border-emerald-300 text-[10px] font-bold">In Progress</Badge>
              </div>
              <p className="font-bold text-slate-900 text-xs truncate mt-0.5">{activeUserTimer.task_title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-emerald-700 bg-white group-hover:bg-emerald-600 group-hover:text-white px-3 py-1.5 rounded-lg border border-emerald-200 group-hover:border-emerald-600 shadow-2xs transition-all flex items-center gap-1">
              <span>Jump to Task</span>
              <ArrowDown className="h-3 w-3" />
            </span>
          </div>
        </div>
      )}

      {/* ADVANCED MULTI-FILTER BAR (Project, Date, Developer Name, Search) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Filter className="h-4 w-4 text-sky-500" /> Filter & Search Tasks
          </div>
          {(filterProject !== "ALL" || filterEmployee !== "ALL" || filterDateMode !== "ALL" || filterStatus !== "ALL" || searchQuery) && (
            <button
              onClick={() => {
                setFilterProject("ALL");
                setFilterEmployee("ALL");
                setFilterDateMode("ALL");
                setFilterCustomDate("");
                setFilterStatus("ALL");
                setSearchQuery("");
              }}
              className="text-xs font-bold text-sky-600 hover:text-sky-800 underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${canManageAllTasks ? "md:grid-cols-3 xl:grid-cols-5" : "md:grid-cols-4"} gap-3 pt-1`}>
          {/* 1. Filter by Project */}
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-600 uppercase">Project</Label>
            <Select value={filterProject} onValueChange={(val) => setFilterProject(val || "ALL")}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Projects ({projects.length})</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Advance Filter by Developer Name (PM, CEO, Admin) */}
          {canManageAllTasks ? (
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600 uppercase">Team Member / Dev</Label>
              <Select value={filterEmployee} onValueChange={(val) => setFilterEmployee(val || "ALL")}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Developers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Team Members</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600 uppercase">Search</Label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-3" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs bg-white"
                />
              </div>
            </div>
          )}

          {/* 3. Status Filter (Incomplete & Overdue for Management) */}
          {canManageAllTasks && (
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600 uppercase">Status Filter</Label>
              <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "ALL")}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="INCOMPLETE" className="text-amber-700 font-bold">⚠️ Incomplete Tasks ({countIncomplete})</SelectItem>
                  <SelectItem value="OVERDUE" className="text-red-600 font-bold">🚨 Overdue Tasks ({countOverdue})</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Planning">Planning</SelectItem>
                  <SelectItem value="Ready for Testing">Ready for Testing</SelectItem>
                  <SelectItem value="Testing">Testing</SelectItem>
                  <SelectItem value="Changes Required">Changes Required</SelectItem>
                  <SelectItem value="Tested (PASS)">Tested (PASS)</SelectItem>
                  <SelectItem value="Ready for Demo">Ready for Demo</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 4. Filter by Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-600 uppercase">Date Filter</Label>
            <Select 
              value={filterDateMode} 
              onValueChange={(val) => {
                setFilterDateMode(val || "ALL");
                if (val !== "CUSTOM") setFilterCustomDate("");
              }}
            >
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Dates" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Dates</SelectItem>
                <SelectItem value="TODAY">Today ({todayStr})</SelectItem>
                <SelectItem value="TOMORROW">Tomorrow ({tomorrowStr})</SelectItem>
                <SelectItem value="CUSTOM">Pick Specific Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 5. Custom Date Picker or Search */}
          {filterDateMode === "CUSTOM" ? (
            <div className="space-y-1 animate-fade-in">
              <Label className="text-[11px] font-bold text-slate-600 uppercase">Select Specific Date</Label>
              <Input
                type="date"
                value={filterCustomDate}
                onChange={(e) => setFilterCustomDate(e.target.value)}
                className="h-9 text-xs bg-white"
              />
            </div>
          ) : canManageAllTasks ? (
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600 uppercase">Search Tasks</Label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-3" />
                <Input
                  placeholder="Task title, keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs bg-white"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Categorized Filter Tabs (Horizontally Scrollable on Mobile) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-xl border border-slate-200 overflow-x-auto w-full whitespace-nowrap">
        <button
          onClick={() => setActiveTab("today")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "today"
              ? "bg-white text-sky-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-amber-500" />
          Today's Tasks ({countToday})
        </button>

        <button
          onClick={() => setActiveTab("tomorrow")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "tomorrow"
              ? "bg-white text-indigo-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <SunMedium className="h-3.5 w-3.5 text-indigo-500" />
          Plan for Tomorrow ({countTomorrow})
        </button>

        <button
          onClick={() => setActiveTab("assigned_pm")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "assigned_pm"
              ? "bg-white text-emerald-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
          Assigned by PM ({countPM})
        </button>

        <button
          onClick={() => setActiveTab("assigned_ceo")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "assigned_ceo"
              ? "bg-white text-purple-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Crown className="h-3.5 w-3.5 text-purple-600" />
          Assigned by CEO ({countCEO})
        </button>

        <button
          onClick={() => setActiveTab("from_tester")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "from_tester"
              ? "bg-white text-red-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-red-600" />
          {role === "Tester" ? `QA Testing & Issues (${countTester})` : `QA Changes Required (${countTester})`}
        </button>

        <button
          onClick={() => setActiveTab("submitted_testing")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "submitted_testing"
              ? "bg-purple-600 text-white shadow-xs border border-purple-700"
              : "text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200"
          }`}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Projects Submitted for Testing ({countProjectsSubmittedTesting})
        </button>

        <button
          onClick={() => setActiveTab("self_created")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "self_created"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <User className="h-3.5 w-3.5 text-slate-600" />
          Self Created ({countSelf})
        </button>

        {canManageAllTasks && (
          <>
            <button
              onClick={() => setActiveTab("incomplete")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === "incomplete"
                  ? "bg-amber-500 text-white shadow-xs border border-amber-600"
                  : "text-amber-800 bg-amber-50 hover:bg-amber-100/80 border border-amber-200"
              }`}
            >
              <AlertCircle className={`h-3.5 w-3.5 ${activeTab === "incomplete" ? "text-white" : "text-amber-600"}`} />
              Incomplete ({countIncomplete})
            </button>

            <button
              onClick={() => setActiveTab("overdue")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === "overdue"
                  ? "bg-red-600 text-white shadow-xs border border-red-700 animate-pulse"
                  : "text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200"
              }`}
            >
              <AlertTriangle className={`h-3.5 w-3.5 ${activeTab === "overdue" ? "text-white" : "text-red-600"}`} />
              Overdue ({countOverdue})
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "all"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All ({tasks.length})
        </button>
      </div>

      {/* Projects Submitted for Testing Executive Brief Banner */}
      {activeTab === "submitted_testing" && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200 text-xs space-y-2 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/80 pb-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-purple-600" />
              <span className="font-extrabold text-sm text-purple-950">Projects Submitted for QA Testing Brief</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="bg-purple-200 text-purple-950 px-2.5 py-0.5 rounded-md border border-purple-300">
                📁 {countProjectsSubmittedTesting} Projects Submitted
              </span>
              <span className="bg-amber-100 text-amber-950 px-2.5 py-0.5 rounded-md border border-amber-300">
                📋 {countTasksSubmittedTesting} Tasks Awaiting / In QA
              </span>
            </div>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            All tasks that developers have finished and handed off to the QA Testing Station. Includes preview links, developer handoff notes, and timestamps.
          </p>
        </div>
      )}

      {/* UPDATE TASK PROGRESS MODAL */}
      <Dialog open={progressModalOpen} onOpenChange={setProgressModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Edit3 className="h-5 w-5 text-sky-500" />
              Update Daily Task Progress
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveProgress} className="space-y-4 pt-2">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 font-medium border border-slate-200 space-y-1">
              <div>Task: <span className="font-bold text-slate-900">{selectedTaskForProgress?.title}</span></div>
              <div className="text-slate-500">Project: {selectedTaskForProgress?.project_name || "N/A"}</div>
            </div>

            {/* Progress Percentage Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-800 text-xs flex items-center gap-2">
                  <span>Completion Progress:</span>
                  <span className={`text-sm font-black ${progressPercentage === 100 ? "text-emerald-600" : "text-sky-600"}`}>
                    {progressPercentage}%
                  </span>
                  {progressPercentage === 100 && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                      Completed
                    </span>
                  )}
                </Label>
                <div className="flex gap-1">
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setProgressPercentage(pct);
                        if (pct === 100) {
                          setProgressStatus("Completed");
                        } else if (progressStatus === "Completed" && pct < 100) {
                          setProgressStatus("In Progress");
                        }
                      }}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                        progressPercentage === pct
                          ? pct === 100
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progressPercentage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setProgressPercentage(val);
                  if (val === 100) {
                    setProgressStatus("Completed");
                  } else if (progressStatus === "Completed" && val < 100) {
                    setProgressStatus("In Progress");
                  }
                }}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
              />

              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-300 ${
                    progressPercentage === 100
                      ? "bg-emerald-500"
                      : progressPercentage >= 50
                      ? "bg-sky-500"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Hours Spent & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="hoursSpent" className="font-semibold text-slate-700 text-xs">
                    Hours Spent Today *
                  </Label>
                  {parseFloat(selectedTaskForProgress?.hours_spent) > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      🔒 Locked (Timer)
                    </span>
                  )}
                </div>
                <Input
                  id="hoursSpent"
                  type={parseFloat(selectedTaskForProgress?.hours_spent) > 0 && !canManageAllTasks ? "text" : "number"}
                  min="0"
                  step="0.1"
                  value={
                    parseFloat(selectedTaskForProgress?.hours_spent) > 0 && !canManageAllTasks
                      ? formatHoursAndMinutes(hoursSpentToday)
                      : hoursSpentToday
                  }
                  readOnly={parseFloat(selectedTaskForProgress?.hours_spent) > 0 && !canManageAllTasks}
                  onChange={(e) => {
                    if (parseFloat(selectedTaskForProgress?.hours_spent) > 0 && !canManageAllTasks) return;
                    const val = parseFloat(e.target.value);
                    setHoursSpentToday(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className={
                    parseFloat(selectedTaskForProgress?.hours_spent) > 0 && !canManageAllTasks
                      ? "bg-slate-100 text-slate-800 cursor-not-allowed border-slate-300 font-bold"
                      : ""
                  }
                  required
                />
                {parseFloat(selectedTaskForProgress?.hours_spent) > 0 ? (
                  <p className="text-[10px] text-slate-500 font-medium">
                    {canManageAllTasks
                      ? `Recorded from timer (${formatHoursAndMinutes(hoursSpentToday)} / ${hoursSpentToday} hrs - PM editable).`
                      : `Recorded from task timer sessions (${hoursSpentToday} hrs total).`}
                  </p>
                ) : (
                  hoursSpentToday > 0 && (
                    <p className="text-[10px] text-sky-600 font-medium">
                      Equivalent: {formatHoursAndMinutes(hoursSpentToday)}
                    </p>
                  )
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">Task Status</Label>
                <Select 
                  value={progressStatus} 
                  onValueChange={(val) => {
                    const newStatus = val || "In Progress";
                    setProgressStatus(newStatus);
                    if (newStatus === "Completed") {
                      setProgressPercentage(100);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Planning">Planning</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Work Accomplished Today */}
            <div className="space-y-1.5">
              <Label htmlFor="dailySummary" className="font-semibold text-slate-700 text-xs">
                Work Done / Accomplishments Today
              </Label>
              <textarea
                id="dailySummary"
                rows={2}
                value={dailySummary}
                onChange={(e) => setDailySummary(e.target.value)}
                placeholder="Modules built, functions implemented, APIs integrated..."
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Blockers Reason */}
            {progressPercentage < 100 && (
              <div className="space-y-1.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200">
                <Label htmlFor="blockers" className="font-bold text-amber-900 text-xs flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  Why is this task not 100% done? (Blockers & Reasons)
                </Label>
                <Input
                  id="blockers"
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder="e.g. Waiting for 3rd-party API credentials / complex db schema rework..."
                  className="bg-white text-xs"
                />
              </div>
            )}

            {/* 100% Progress Celebration Notice */}
            {(progressPercentage === 100 || progressStatus === "Completed") && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2 font-semibold animate-pulse">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>🎉 100% Progress: This task will be marked Completed and any running timer will be stopped.</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={submittingProgress}
              className={`w-full font-bold py-2.5 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                progressPercentage === 100 || progressStatus === "Completed"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              {submittingProgress ? (
                "Updating Task..."
              ) : progressPercentage === 100 || progressStatus === "Completed" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Save & Finish Task (100% Completed)
                </>
              ) : (
                "Save Progress & Sync Daily Log"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* FINISH TASK CHOICE MODAL (Submit to QA vs Direct Complete) */}
      <Dialog open={finishChoiceModalOpen} onOpenChange={setFinishChoiceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Finish Task & Choose Next Step
            </DialogTitle>
          </DialogHeader>

          {taskToFinishChoice && (() => {
            const isTaskFastTrack = Boolean(taskToFinishChoice.project_is_fast_track || projectFastTrackMap[taskToFinishChoice.project_id]);
            return (
              <div className="space-y-4 pt-1">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-900 text-sm">{taskToFinishChoice.title}</div>
                  <div className="text-slate-500">Project: <strong>{taskToFinishChoice.project_name || "General"}</strong></div>
                  {isTaskFastTrack && (
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                      ⚡ Fastest Development Mode (Direct Demo to Admin, CEO, PM)
                    </div>
                  )}
                  <div className="text-emerald-700 font-semibold pt-1">
                    ⏱️ Recorded Work Today: {formatHoursAndMinutes(taskToFinishChoice.hours_spent)}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {isTaskFastTrack
                    ? "This project is in Fastest Development mode. You can submit your demo directly to Admin, CEO, and PM for review, or mark it 100% completed directly."
                    : "How would you like to conclude this task? You can submit it to the QA Testing Station for tester verification, or mark it 100% completed directly."}
                </p>

                <div className="space-y-2 pt-1">
                  {isTaskFastTrack ? (
                    <Button
                      type="button"
                      onClick={() => {
                        const task = taskToFinishChoice;
                        setFinishChoiceModalOpen(false);
                        setTaskToFinishChoice(null);
                        openDirectSubmitModal(task);
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Rocket className="h-4 w-4 text-indigo-200" />
                      🚀 Finish & Submit Demo (Admin, CEO, PM)
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        const task = taskToFinishChoice;
                        setFinishChoiceModalOpen(false);
                        setTaskToFinishChoice(null);
                        openSendToTestingModal(task);
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                      🧪 Finish & Submit for QA Testing
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDirectFinishTask(taskToFinishChoice)}
                    className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 font-bold py-2.5 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ✅ Mark 100% Completed (Direct)
                  </Button>
                </div>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFinishChoiceModalOpen(false);
                      setTaskToFinishChoice(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                  >
                    Cancel / Keep Working
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* DEDICATED SEND TO TESTING MODAL */}
      <Dialog open={testingModalOpen} onOpenChange={setTestingModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Send className="h-5 w-5 text-amber-500" />
              Hand Off Task to QA Testing
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSendToTestingSubmit} className="space-y-4 pt-2">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 font-medium border border-slate-200 space-y-1">
              <div>Task: <span className="font-bold text-slate-900">{selectedTaskForTesting?.title}</span></div>
              <div className="text-slate-500">Project: {selectedTaskForTesting?.project_name || "N/A"}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <LinkIcon className="h-4 w-4 text-sky-500" />
                  Task Preview & Deliverable Links * (PR / Staging / Figma)
                </Label>
                <button
                  type="button"
                  onClick={handleAddLinkInput}
                  className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Another Link
                </button>
              </div>

              <div className="space-y-2">
                {taskLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={link}
                      onChange={(e) => handleLinkChange(idx, e.target.value)}
                      placeholder={idx === 0 ? "https://github.com/.../pull/12 or http://staging.unitglo.com" : "Optional additional link (Figma, test API endpoint...)"}
                      className="bg-white text-xs"
                      required={idx === 0}
                    />
                    {taskLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLinkInput(idx)}
                        className="text-red-500 hover:text-red-700 p-1.5"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 bg-amber-50/80 p-3 rounded-xl border border-amber-200">
              <Label htmlFor="testingDeadline" className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                🎯 QA Testing Deadline (Separate Due Date for Tester) *
              </Label>
              <Input
                id="testingDeadline"
                type="datetime-local"
                value={testingDeadline}
                onChange={(e) => setTestingDeadline(e.target.value)}
                className="bg-white text-xs border-amber-300 font-semibold text-slate-800"
                required
              />
              <p className="text-[11px] text-amber-800 font-medium">
                Set deadline for QA tester to verify. Admin, CEO, and PM will be automatically alerted if testing is not finished by this time.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="font-semibold text-slate-700 text-xs">
                Hand-off Notes for QA Tester (Optional)
              </Label>
              <Input
                id="notes"
                value={testingNotes}
                onChange={(e) => setTestingNotes(e.target.value)}
                placeholder="e.g. Please test with admin credentials, tested on Firefox"
                className="text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={submittingTesting}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 shadow-md"
            >
              {submittingTesting ? "Handing Off to QA..." : "Submit to QA Testing Queue"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* FAST-TRACK DIRECT SUBMIT TO DEMO MODAL */}
      <Dialog open={directSubmitModalOpen} onOpenChange={setDirectSubmitModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Rocket className="h-5 w-5 text-indigo-600" />
              Fast-Track Direct Submit to Demo
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleDirectSubmitForm} className="space-y-4 pt-2">
            <div className="rounded-xl bg-indigo-50/80 p-3 text-xs text-indigo-950 font-medium border border-indigo-200 space-y-1">
              <div>Task: <span className="font-bold text-slate-900">{selectedTaskForDirectSubmit?.title}</span></div>
              <div className="text-slate-600">Project: {selectedTaskForDirectSubmit?.project_name || "N/A"}</div>
              <div className="text-indigo-700 font-semibold pt-1">
                🚀 This task will be flagged as <strong>Ready for Demo</strong> directly for Admin, CEO, and PM review.
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <LinkIcon className="h-4 w-4 text-indigo-600" />
                  Demo / Deliverable Links * (Live / Figma / PR)
                </Label>
                <button
                  type="button"
                  onClick={() => setDirectSubmitLinks(prev => [...prev, ""])}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Another Link
                </button>
              </div>

              <div className="space-y-2">
                {directSubmitLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={link}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDirectSubmitLinks(prev => {
                          const next = [...prev];
                          next[idx] = val;
                          return next;
                        });
                      }}
                      placeholder={idx === 0 ? "https://demo.unitglo.com or https://..." : "Additional link"}
                      className="bg-white text-xs"
                      required={idx === 0}
                    />
                    {directSubmitLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDirectSubmitLinks(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-1.5 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="directNotes" className="font-semibold text-slate-700 text-xs">
                Demo Instructions / Notes (Optional)
              </Label>
              <Input
                id="directNotes"
                value={directSubmitNotes}
                onChange={(e) => setDirectSubmitNotes(e.target.value)}
                placeholder="e.g. Ready for client showcase, test login credentials provided"
                className="text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={submittingDirectSubmit}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 shadow-md flex items-center justify-center gap-2"
            >
              <Rocket className="h-4 w-4" />
              {submittingDirectSubmit ? "Submitting to Demo..." : "Confirm & Submit for Demo"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT TASK MODAL */}
      <Dialog open={editTaskModalOpen} onOpenChange={setEditTaskModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-sky-500" />
              Edit Task Details
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEditTask} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="editTaskTitle" className="font-semibold text-slate-700">Task Title *</Label>
              <Input
                id="editTaskTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Implement Stripe Webhook Listener"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editTaskDescription" className="font-semibold text-slate-700">Description / Goal</Label>
              <textarea
                id="editTaskDescription"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Detailed description of task deliverables and requirements..."
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">Project *</Label>
                <Select value={editProjectId} onValueChange={(val) => setEditProjectId(val || "")}>
                  <SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} {p.creator_name ? `(By: ${p.creator_name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">Task Assigned By *</Label>
                <Select value={editAssignedByType} onValueChange={(val: any) => setEditAssignedByType(val || "PM")}>
                  <SelectTrigger><SelectValue placeholder="Assigned By" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PM">📋 PM (Project Manager)</SelectItem>
                    <SelectItem value="CEO">👑 CEO (Executive)</SelectItem>
                    <SelectItem value="Tester">🧪 Tester (QA Bug Fix)</SelectItem>
                    <SelectItem value="Self Tested">✍️ Self Tested</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">Priority</Label>
                <Select value={editPriority} onValueChange={(val) => setEditPriority(val || "Medium")}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">Status</Label>
                <Select value={editStatus} onValueChange={(val) => setEditStatus(val || "In Progress")}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
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

            {/* Assigned Team Members: Interactive multi-select for PM/CEO/Admin; Read-only badge for Dev/Tester */}
            {canManageAllTasks ? (
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs flex items-center justify-between">
                  <span>
                    <Users className="h-3.5 w-3.5 inline text-sky-500 mr-1" />
                    Assign Team Members * {editAssignedTo.length > 0 && `(${editAssignedTo.length} selected)`}
                    {editProjectId && (
                      <span className="ml-1 text-[10px] text-sky-700 font-bold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                        Project Members ({editProjectAssignedEmployees.length})
                      </span>
                    )}
                  </span>
                  {editAssignedTo.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditAssignedTo([])}
                      className="text-[10px] text-red-500 hover:underline font-bold"
                    >
                      Clear Selection
                    </button>
                  )}
                </Label>
                <div className="border border-slate-200 rounded-xl bg-white p-2 space-y-1 max-h-36 overflow-y-auto">
                  {editProjectAssignedEmployees.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-2 text-center">No team members assigned to this project.</p>
                  ) : (
                    editProjectAssignedEmployees.map((e) => {
                      const isSelected = editAssignedTo.includes(e.id.toString());
                      return (
                        <div
                          key={e.id}
                          onClick={() => {
                            setEditAssignedTo((prev) =>
                              isSelected
                                ? prev.filter((x) => x !== e.id.toString())
                                : [...prev, e.id.toString()]
                            );
                          }}
                          className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "bg-sky-50 text-sky-900 font-bold border border-sky-200"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-sky-600 h-3.5 w-3.5 cursor-pointer"
                            />
                            <span>{e.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-semibold text-slate-500">
                            {e.role}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-sky-500" /> Assigned Team Member(s)
                </Label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center">
                  {editAssignedTo.length > 0 ? (
                    employees
                      .filter((e) => editAssignedTo.includes(e.id.toString()))
                      .map((e) => (
                        <Badge key={e.id} variant="secondary" className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold py-1 px-2.5 flex items-center gap-1.5 shadow-xs">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                          <span>{e.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({e.role})</span>
                        </Badge>
                      ))
                  ) : editingTask?.assignee_name ? (
                    <Badge variant="secondary" className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold py-1 px-2.5 shadow-xs">
                      👤 {editingTask.assignee_name}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Self Assigned / Current User</span>
                  )}
                </div>
              </div>
            )}

            {/* Task Schedule Dates in Edit Modal */}
            <div className="space-y-3 p-3.5 bg-gradient-to-br from-slate-50 to-sky-50/30 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Calendar className="h-4 w-4 text-sky-600" /> Task Schedule & Dates
                </Label>
                <span className="text-[10px] text-slate-500 font-medium">
                  Adjust start and target completion dates
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Edit Start Date */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="editTaskStartDate" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Play className="h-3 w-3 text-emerald-600" /> Start Date *
                    </Label>
                    {editStartDate === todayStr && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">Today</span>
                    )}
                  </div>
                  <Input
                    id="editTaskStartDate"
                    type="date"
                    value={editStartDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditStartDate(val);
                      if (editExpectedDate && val && editExpectedDate < val) {
                        setEditExpectedDate(val);
                      }
                    }}
                    className="bg-white text-xs font-medium border-slate-300 focus:border-sky-500"
                    required
                  />
                </div>

                {/* Edit Expected Date */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="editTaskExpectedDate" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-sky-600" /> Expected Date *
                    </Label>
                    {editExpectedDate === todayStr ? (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">Today</span>
                    ) : editExpectedDate === tomorrowStr ? (
                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.2 rounded">Tomorrow</span>
                    ) : null}
                  </div>
                  <Input
                    id="editTaskExpectedDate"
                    type="date"
                    min={editStartDate || undefined}
                    value={editExpectedDate}
                    onChange={(e) => setEditExpectedDate(e.target.value)}
                    className="bg-white text-xs font-medium border-slate-300 focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              {/* Quick Preset Buttons for Expected Date */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 font-semibold mr-1">Quick Expected:</span>
                <button
                  type="button"
                  onClick={() => setEditExpectedDate(todayStr)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    editExpectedDate === todayStr
                      ? "bg-amber-500 text-white shadow-2xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Flame className="h-3 w-3" /> Due Today
                </button>
                <button
                  type="button"
                  onClick={() => setEditExpectedDate(tomorrowStr)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    editExpectedDate === tomorrowStr
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <SunMedium className="h-3 w-3" /> Due Tomorrow
                </button>
              </div>
            </div>

            {/* Task Attachments in Edit Task Modal */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <Label className="font-bold text-slate-900 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Paperclip className="h-4 w-4 text-sky-500" /> Task Attachments & Reference Links (Optional)
                </span>
                {editTaskAttachments.length > 0 && (
                  <span className="text-[10px] text-sky-600 font-bold">{editTaskAttachments.length} Attached</span>
                )}
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Attachment Title (e.g. Figma / Spec)"
                  value={editTaskAttTitle}
                  onChange={(e) => setEditTaskAttTitle(e.target.value)}
                  className="bg-white text-xs h-8"
                />
                <div className="flex gap-1.5">
                  <Input
                    placeholder="URL (e.g. https://...)"
                    value={editTaskAttUrl}
                    onChange={(e) => setEditTaskAttUrl(e.target.value)}
                    className="bg-white text-xs h-8 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddEditTaskAttachment();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddEditTaskAttachment}
                    className="h-8 px-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shrink-0 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>

              {editTaskAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200 max-h-32 overflow-y-auto">
                  {editTaskAttachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-medium text-slate-800"
                    >
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-sky-600 hover:underline flex items-center gap-1 max-w-[150px] truncate"
                      >
                        <Link2 className="h-3 w-3 shrink-0 text-sky-500" />
                        <span className="truncate">{att.title || att.url}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveEditTaskAttachment(idx)}
                        className="text-red-500 hover:text-red-700 p-0.5 rounded shrink-0 cursor-pointer"
                        title="Remove attachment"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subtasks / Checklist in Edit Task Modal */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <Label className="font-bold text-slate-900 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <ListTodo className="h-4 w-4 text-sky-500" /> Add Checklist Sub-tasks (Optional)
                </span>
                {editChecklists.length > 0 && (
                  <span className="text-[10px] text-sky-600 font-bold">{editChecklists.length} Sub-tasks</span>
                )}
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Write unit test cases / verify responsive UI"
                  value={editNewChecklistInput}
                  onChange={(e) => setEditNewChecklistInput(e.target.value)}
                  className="bg-white text-xs h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEditChecklist();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddEditChecklist}
                  className="h-8 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shrink-0"
                >
                  Add
                </Button>
              </div>

              {editChecklists.length > 0 && (
                <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                  {editChecklists.map((item, idx) => (
                    <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2">
                      {editingEditChecklistIdx === idx ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <Input
                            value={editingEditChecklistText}
                            onChange={(e) => setEditingEditChecklistText(e.target.value)}
                            className="h-7 text-xs bg-white flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveEditEditChecklist(idx);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSaveEditEditChecklist(idx)}
                            className="h-7 px-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shrink-0"
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-slate-800 font-medium whitespace-pre-wrap break-words [overflow-wrap:anywhere] flex-1 leading-relaxed">
                            ✓ {item.item_text}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditEditChecklist(idx, item.item_text)}
                              className="text-sky-600 hover:text-sky-800 hover:bg-sky-50 p-1 rounded cursor-pointer"
                              title="Edit sub-task text"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveEditChecklist(idx)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded cursor-pointer"
                              title="Delete sub-task"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editProgressPct" className="font-semibold text-slate-700 text-xs">Progress (% Done)</Label>
                <Input
                  id="editProgressPct"
                  type="number"
                  min="0"
                  max="100"
                  value={editProgressPercentage}
                  onChange={(e) => setEditProgressPercentage(parseInt(e.target.value) || 0)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editHours" className="font-semibold text-slate-700 text-xs">Hours Logged</Label>
                <Input
                  id="editHours"
                  type="text"
                  value={formatHoursAndMinutes(editHoursSpent)}
                  readOnly={true}
                  className="text-xs bg-slate-100 cursor-not-allowed font-medium text-slate-700"
                />
                {editHoursSpent > 0 && (
                  <p className="text-[10px] text-slate-500">
                    {editHoursSpent} hrs recorded via timer
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editBlockersInput" className="font-semibold text-slate-700 text-xs">Blockers (Optional)</Label>
              <Input
                id="editBlockersInput"
                value={editBlockers}
                onChange={(e) => setEditBlockers(e.target.value)}
                placeholder="Blockers or pending dependencies..."
                className="text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={savingEditTask}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 shadow-md mt-2"
            >
              {savingEditTask ? "Saving Changes..." : "Save Task Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE TASK CONFIRMATION MODAL */}
      <Dialog open={!!deleteConfirmTask} onOpenChange={(open) => !open && setDeleteConfirmTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-red-600">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Confirm Task Deletion
            </DialogTitle>
          </DialogHeader>
          {deleteConfirmTask && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-600">
                Are you sure you want to permanently delete task <span className="font-bold text-slate-900">{deleteConfirmTask.title}</span>?
              </p>
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                ⚠️ This will permanently remove the task and checklists. This action cannot be undone.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmTask(null)}
                  disabled={deletingTask}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  onClick={confirmDeleteTask}
                  disabled={deletingTask}
                >
                  {deletingTask ? "Deleting..." : "Permanently Delete"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Live Highlight Active Task Banner */}
      {highlightedTaskId && (
        <div className="flex items-center justify-between p-3.5 px-4 bg-emerald-600 text-white rounded-xl shadow-lg border border-emerald-500 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 text-xs font-bold min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <div className="min-w-0">
              <span className="font-extrabold uppercase tracking-wider text-[10px] text-emerald-200 block">
                Highlighted Ongoing Live Task
              </span>
              <span className="truncate text-xs">
                Focusing on Task #{highlightedTaskId}
                {highlightedEmployeeName ? ` (Active: ${highlightedEmployeeName})` : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                document.getElementById(`task-row-${highlightedTaskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="text-xs font-bold underline hover:text-emerald-100 transition cursor-pointer px-2 py-1"
            >
              Scroll to Task ↓
            </button>
            <button
              type="button"
              onClick={() => {
                setHighlightedTaskId(null);
                setHighlightedEmployeeName(null);
              }}
              className="text-xs font-extrabold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              Dismiss ✕
            </button>
          </div>
        </div>
      )}

      {/* Task List Table with Dedicated TASK ID and DATE Columns */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold w-20 text-center">Task ID</TableHead>
              <TableHead className="font-bold">Task & Progress</TableHead>
              <TableHead className="font-bold">Project & Assigner</TableHead>
              <TableHead className="font-bold">Schedule (Start / Expected)</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold text-right">Daily Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading daily tasks...</TableCell></TableRow>
            ) : filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-10">
                  No daily tasks found matching your filter selections.
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task) => {
                const checklists: any[] = task.checklists || [];
                const completedChecklists = checklists.filter((c) => c.is_completed).length;
                const checklistPct = checklists.length > 0 ? Math.round((completedChecklists / checklists.length) * 100) : 0;
                const isChecklistOpen = activeChecklistTaskId === task.id;
                const taskExpDate = task.expected_date ? task.expected_date.split("T")[0] : (task.target_date ? task.target_date.split("T")[0] : todayStr);
                const taskStartDate = task.start_date ? task.start_date.split("T")[0] : (task.created_at ? task.created_at.split("T")[0] : todayStr);
                const isCompleted = task.status === "Completed" || task.status === "Ready for Demo";
                const isToday = taskExpDate === todayStr;
                const isTomorrow = taskExpDate === tomorrowStr;
                const isOverdue = taskExpDate < todayStr && !isCompleted;
                const pct = task.progress_percentage || (checklists.length > 0 ? checklistPct : 0);
                const employeeSeqId = employeeTaskSeqMap[task.id] || task.id;

                const taskLinksList: string[] = Array.isArray(task.task_links) && task.task_links.length > 0
                  ? task.task_links
                  : task.task_link ? [task.task_link] : [];
                const isFastTrack = Boolean(task.project_is_fast_track || projectFastTrackMap[task.project_id]);

                return (
                  <TableRow 
                    key={task.id} 
                    id={`task-row-${task.id}`}
                    className={`transition-all duration-500 ${
                      highlightedTaskId === task.id
                        ? "ring-4 ring-emerald-500/90 bg-emerald-50/90 shadow-2xl relative z-20 scale-[1.002]"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    {/* DEDICATED AUTO-NUMBERED TASK ID COLUMN */}
                    <TableCell className="align-top text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge className="bg-sky-100 text-sky-900 border-sky-300 font-mono font-black text-xs px-2 py-0.5 shadow-2xs">
                          #{employeeSeqId}
                        </Badge>
                        <span className="text-[9px] text-slate-400 font-mono font-semibold" title={`Database Task ID: ${task.id}`}>
                          ID:{task.id}
                        </span>
                      </div>
                    </TableCell>

                    {/* Task Title, Description, and Checklist */}
                    <TableCell className="align-top max-w-md min-w-[240px]">
                      {highlightedTaskId === task.id && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs animate-bounce mb-2 w-fit">
                          <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                          <span>Live Ongoing Task Active Now {highlightedEmployeeName ? `(${highlightedEmployeeName})` : ""}</span>
                        </div>
                      )}
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                        <span className="break-words [overflow-wrap:anywhere] whitespace-pre-wrap min-w-0 max-w-full font-bold text-slate-900 text-sm leading-snug">{task.title}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">{task.priority}</Badge>
                      </div>
                      
                      {/* Text-wrapped task description */}
                      {task.description && (
                        <div className="text-xs text-slate-600 whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 max-w-full mt-1.5 leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 font-normal">
                          {task.description}
                        </div>
                      )}

                      {/* Visual Progress Bar */}
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-700">Progress: {pct}% Done</span>
                          {task.hours_spent > 0 && (
                            <span className="text-slate-500 font-semibold flex items-center gap-1">
                              <Clock className="h-3 w-3 text-sky-500" /> {formatHoursAndMinutes(task.hours_spent)} logged
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full transition-all duration-300 ${
                              pct === 100
                                ? "bg-emerald-500"
                                : pct >= 50
                                ? "bg-sky-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Task Attachments & Links */}
                      {task.attachments && task.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Task Attachments & Links:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {task.attachments.map((att: any, attIdx: number) => (
                              <a
                                key={attIdx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 hover:bg-sky-100 text-xs font-bold border border-sky-200 transition-all"
                              >
                                <Paperclip className="h-3 w-3 text-sky-600 shrink-0" />
                                <span className="truncate max-w-[150px]">{att.title || att.url}</span>
                                <ExternalLink className="h-2.5 w-2.5 opacity-60 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sub-tasks / Daily Checklist Section */}
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveChecklistTaskId(isChecklistOpen ? null : task.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-sky-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md border border-slate-200 transition-colors"
                          >
                            <ListTodo className="h-3 w-3 text-sky-500" />
                            {checklists.length > 0 ? `${completedChecklists}/${checklists.length} Checklist Items` : "+ Add Sub-tasks"}
                          </button>
                        </div>

                        {/* Expandable Checklist */}
                        {isChecklistOpen && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mt-1 max-w-md w-full shadow-xs">
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block border-b border-slate-200 pb-1">
                              Sub-tasks & Checklist
                            </span>
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                              {checklists.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic">No checklist sub-tasks yet.</p>
                              ) : (
                                checklists.map((c) => (
                                  <div
                                    key={c.id}
                                    className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-1.5"
                                  >
                                    <div
                                      onClick={() => handleToggleChecklist(c.id, c.is_completed)}
                                      className="flex items-start gap-2 cursor-pointer flex-1 min-w-0"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={c.is_completed}
                                        onChange={() => {}}
                                        className="rounded border-slate-300 text-sky-600 h-3.5 w-3.5 mt-0.5 shrink-0 cursor-pointer"
                                      />
                                      {editingSubTaskId === c.id ? (
                                        <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                          <Input
                                            value={editingSubTaskText}
                                            onChange={(e) => setEditingSubTaskText(e.target.value)}
                                            className="h-6 text-xs bg-white flex-1"
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                handleUpdateSubTaskText(c.id);
                                              }
                                            }}
                                          />
                                          <Button
                                            size="sm"
                                            onClick={() => handleUpdateSubTaskText(c.id)}
                                            className="h-6 px-2 text-[10px] bg-sky-600 text-white font-bold"
                                          >
                                            Save
                                          </Button>
                                        </div>
                                      ) : (
                                        <span className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] flex-1 leading-relaxed ${c.is_completed ? "line-through text-slate-400 font-normal" : "font-semibold text-slate-800"}`}>
                                          {c.item_text}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Edit Subtask Text Button */}
                                      {editingSubTaskId !== c.id && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingSubTaskId(c.id);
                                            setEditingSubTaskText(c.item_text);
                                          }}
                                          className="p-1 text-slate-400 hover:text-sky-600 rounded cursor-pointer"
                                          title="Edit sub-task text"
                                        >
                                          <Edit3 className="h-3.5 w-3.5" />
                                        </button>
                                      )}

                                      {/* Delete Subtask Button */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteSubTask(c.id);
                                        }}
                                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                        title="Delete sub-task"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 pt-1">
                              <Input
                                placeholder="New daily sub-task..."
                                value={newChecklistText}
                                onChange={(e) => setNewChecklistText(e.target.value)}
                                className="h-7 text-xs bg-white flex-1"
                                onKeyDown={(e) => e.key === "Enter" && handleAddChecklist(task.id)}
                              />
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => handleAddChecklist(task.id)}
                                className="h-7 px-2.5 text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold shrink-0"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Project & Assigner */}
                    <TableCell className="align-top space-y-1.5 min-w-[200px]">
                      <div className="flex flex-col gap-1">
                        {(() => {
                          const liveServerUrl = getProjectLiveServerUrl(task.project_id);
                          if (!task.project_id) {
                            return (
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{task.project_name || "N/A"}</span>
                              </div>
                            );
                          }

                          if (liveServerUrl) {
                            const formattedUrl = liveServerUrl.startsWith("http") ? liveServerUrl : `https://${liveServerUrl}`;
                            return (
                              <a
                                href={formattedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group inline-flex items-center gap-1.5 font-black text-slate-900 hover:text-emerald-600 text-xs transition-colors"
                                title={`Open Live Server: ${formattedUrl}`}
                              >
                                <Globe className="h-3.5 w-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="hover:underline underline-offset-2">{task.project_name || "N/A"}</span>
                                <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 text-emerald-600 transition-opacity" />
                              </a>
                            );
                          }

                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenProjectCredentials(task.project_id, task.project_name || "Project")}
                              className="group inline-flex items-center gap-1.5 font-black text-slate-900 hover:text-sky-600 text-xs text-left transition-colors cursor-pointer"
                              title="No live server URL configured yet (Click to view or add credentials)"
                            >
                              <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0 group-hover:text-sky-500 transition-colors" />
                              <span className="hover:underline underline-offset-2">{task.project_name || "N/A"}</span>
                            </button>
                          );
                        })()}

                        {/* View Project Credentials Button */}
                        {task.project_id && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenProjectCredentials(task.project_id, task.project_name || "Project")}
                              className={`h-6 px-2 text-[10px] font-bold gap-1 rounded-md transition-all shadow-2xs ${
                                projectCredentialsMap.has(task.project_id)
                                  ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 hover:border-amber-400"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                              title="Quick-view credentials and logins for this project"
                            >
                              <KeyRound className="h-3 w-3 text-amber-600" />
                              <span>View Credentials</span>
                              {projectCredentialsMap.has(task.project_id) && (
                                <span className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] bg-amber-200 text-amber-900 font-extrabold">
                                  {projectCredentialsMap.get(task.project_id)!.length}
                                </span>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
                        <UserCheck className="h-3 w-3 text-sky-500" />
                        <span>
                          Assigned By:{" "}
                          <strong>
                            {task.project_creator_name || task.creator_name || "Management"} ({task.project_creator_role || task.creator_role || "PM"})
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {task.assigned_by_type === "CEO" && (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-bold text-[10px] py-0 px-1.5">
                            👑 CEO Assigned
                          </Badge>
                        )}
                        {task.assigned_by_type === "PM" && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px] py-0 px-1.5">
                            📋 PM Assigned
                          </Badge>
                        )}
                        {task.assigned_by_type === "Tester" && (
                          <Badge className="bg-red-100 text-red-800 border-red-300 font-bold text-[10px] py-0 px-1.5">
                            🧪 Tester Bug Fix
                          </Badge>
                        )}
                        {(!task.assigned_by_type || task.assigned_by_type === "Self Tested") && (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-bold text-[10px] py-0 px-1.5">
                            ✍️ Self Tested
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <span className="font-semibold text-slate-700 block">Assigned Team:</span>
                        {task.assignees && task.assignees.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {task.assignees.map((a: any) => (
                              <Badge key={a.id} variant="secondary" className="bg-sky-50 text-sky-900 border-sky-200 text-[10px] py-0.5 px-1.5 font-bold flex items-center gap-1">
                                <User className="h-3 w-3 text-sky-600" />
                                <span>{a.name} ({a.role})</span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="font-medium text-slate-700">{task.assignee_name || "Unassigned"}</span>
                        )}
                      </div>
                    </TableCell>

                    {/* DEDICATED SCHEDULE DATES COLUMN (Start & Expected) */}
                    <TableCell className="align-top space-y-1.5 min-w-[150px]">
                      <div className="space-y-1">
                        {/* Start Date */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Play className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Start:</span>
                          <span className="font-semibold text-slate-800 text-[11px]">
                            {new Date(taskStartDate + "T00:00:00").toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>

                        {/* Expected Date */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="h-3 w-3 text-sky-600 shrink-0" />
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Expected:</span>
                          <span className="font-bold text-slate-900 text-[11px]">
                            {new Date(taskExpDate + "T00:00:00").toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      <div className="pt-0.5">
                        {isOverdue ? (
                          <Badge className="bg-rose-50 text-rose-800 border-rose-300 font-bold text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3 text-rose-600" /> Overdue
                          </Badge>
                        ) : isToday ? (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-[10px] gap-1">
                            <Flame className="h-3 w-3 text-amber-600" /> Due Today
                          </Badge>
                        ) : isTomorrow ? (
                          <Badge className="bg-indigo-50 text-indigo-800 border-indigo-300 font-bold text-[10px] gap-1">
                            <SunMedium className="h-3 w-3 text-indigo-600" /> Due Tomorrow
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-slate-600">
                            Scheduled
                          </Badge>
                        )}
                      </div>

                      {/* QA Issues Report */}
                      {task.status === "Changes Required" && (
                        <div className="p-2 rounded-md bg-red-50 border border-red-200 text-[11px] text-red-700 space-y-1">
                          <div className="font-bold flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                            QA Found {task.issues_count || 1} Issue(s)
                          </div>
                          {task.test_sheet_link && (
                            <a
                              href={task.test_sheet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-red-800 font-bold underline hover:text-red-950"
                            >
                              <ExternalLink className="h-3 w-3" /> View QA Test Sheet
                            </a>
                          )}
                        </div>
                      )}

                      {/* Blockers */}
                      {task.blockers && (
                        <div className="p-1.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">
                          <span className="font-bold">⚠️ Blocker:</span> {task.blockers}
                        </div>
                      )}

                      {/* Multiple Deliverable Links */}
                      {taskLinksList.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {taskLinksList.map((link, lIdx) => (
                            <a
                              key={lIdx}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 text-[10px] font-bold border border-sky-200"
                            >
                              <ExternalLink className="h-2.5 w-2.5" /> Link {lIdx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="align-top">{getStatusBadge(task.status)}</TableCell>

                    {/* Action Buttons */}
                    <TableCell className="align-top text-right space-y-1.5">
                      {/* Task Start / Pause / Finish Timer Controls */}
                      {activeUserTimer?.task_id === task.id ? (
                        <div className="flex items-center gap-1 w-full">
                          <Button
                            size="sm"
                            onClick={() => handleQuickPauseTimer(task.id)}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1 shadow-xs flex-1 justify-center cursor-pointer"
                            title="Pause timer to go on break"
                          >
                            <Pause className="h-3.5 w-3.5 fill-current" /> Pause
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleQuickFinishTask(task)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 shadow-xs flex-1 justify-center cursor-pointer"
                            title="Finish task and lock hours"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Finish
                          </Button>
                        </div>
                      ) : task.running_timer ? (
                        <div 
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold w-full select-none shadow-xs"
                          title={`Timer is actively running by ${task.running_timer.runner_name} (${task.running_timer.runner_role})`}
                        >
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                          </span>
                          <span className="truncate">Running ({task.running_timer.runner_name})</span>
                        </div>
                      ) : task.status === "Completed" ? (
                        <div 
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold w-full select-none cursor-not-allowed"
                          title="Task completed and logged. Once logged, this task cannot be started again."
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Logged ({formatHoursAndMinutes(task.hours_spent)})
                        </div>
                      ) : task.status === "Ready for Demo" ? (
                        <div 
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold w-full select-none cursor-not-allowed"
                          title="Task submitted and ready for Demo. Timer is locked."
                        >
                          <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Demo Ready ({formatHoursAndMinutes(task.hours_spent)})
                        </div>
                      ) : task.status === "Ready for Testing" || task.status === "Testing" ? (
                        <div 
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold w-full select-none cursor-not-allowed"
                          title="Task submitted to QA for testing. Timer is locked."
                        >
                          <Clock className="h-3.5 w-3.5 text-amber-600" /> In QA ({formatHoursAndMinutes(task.hours_spent)})
                        </div>
                      ) : task.status === "Tested (PASS)" ? (
                        <div 
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold w-full select-none cursor-not-allowed"
                          title="Task passed QA testing. Timer is locked."
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> QA Passed ({formatHoursAndMinutes(task.hours_spent)})
                        </div>
                      ) : parseFloat(task.hours_spent) > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartTimerDirect(task)}
                          disabled={!!activeUserTimer && activeUserTimer.task_id !== task.id}
                          className={`border-emerald-400 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 font-bold text-xs gap-1.5 shadow-2xs w-full justify-center ${
                            !!activeUserTimer && activeUserTimer.task_id !== task.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                          }`}
                          title={
                            !!activeUserTimer && activeUserTimer.task_id !== task.id
                              ? `Active timer is running on "${activeUserTimer.task_title}". Pause or finish it first.`
                              : "Resume timer on this task"
                          }
                        >
                          <Play className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" /> Resume Timer ({formatHoursAndMinutes(task.hours_spent)})
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartTimerDirect(task)}
                          disabled={!!activeUserTimer && activeUserTimer.task_id !== task.id}
                          className={`border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs gap-1.5 shadow-2xs w-full justify-center ${
                            !!activeUserTimer && activeUserTimer.task_id !== task.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                          }`}
                          title={
                            !!activeUserTimer && activeUserTimer.task_id !== task.id
                              ? `Active timer is running on "${activeUserTimer.task_title}". Pause or finish it first.`
                              : "Start timer on this task"
                          }
                        >
                          <Play className="h-3.5 w-3.5 text-slate-500" /> Start Timer
                        </Button>
                      )}

                      {/* Update Progress Button */}
                      <div>
                        <Button
                          size="sm"
                          onClick={() => openProgressModal(task)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 shadow-xs w-full justify-center"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-sky-400" /> Update Progress
                        </Button>
                      </div>

                      {/* Start Plan */}
                      {(task.status === "Created" || task.status === "Assigned") && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task.id, "Planning")}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-xs w-full justify-center"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Start Plan
                        </Button>
                      )}

                      {/* Start Work */}
                      {task.status === "Planning" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task.id, "In Progress")}
                          className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 shadow-xs w-full justify-center"
                        >
                          <Play className="h-3.5 w-3.5" /> Start Work
                        </Button>
                      )}

                      {/* SUBMIT FOR TESTING: Only for standard QA projects (Fastest development submits demo directly to Admin, CEO, PM) */}
                      {!isFastTrack && (task.status === "In Progress" || task.status === "Changes Required" || task.status === "Completed") && (
                        <Button
                          size="sm"
                          onClick={() => openSendToTestingModal(task)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5 shadow-xs w-full justify-center"
                          title="Submit this task to QA Testing Station for verification"
                        >
                          <Send className="h-3.5 w-3.5" /> Submit for Testing
                        </Button>
                      )}

                      {/* FAST-TRACK DEMO SUBMISSION (If project has fast track mode: submit demo directly to Admin, CEO, PM) */}
                      {isFastTrack && (task.status === "In Progress" || task.status === "Changes Required" || task.status === "Completed" || task.status === "Planning") && (
                        <Button
                          size="sm"
                          onClick={() => openDirectSubmitModal(task)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-xs w-full justify-center"
                          title="Submit demo directly to Admin, CEO, and PM"
                        >
                          <Rocket className="h-3.5 w-3.5 text-indigo-200" /> Send for Demo
                        </Button>
                      )}

                      {/* Tested (PASS) -> Ready for Demo */}
                      {task.status === "Tested (PASS)" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task.id, "Ready for Demo")}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-md animate-bounce w-full justify-center"
                        >
                          <Rocket className="h-3.5 w-3.5" /> Submit to Demo
                        </Button>
                      )}

                      {task.status === "Ready for Demo" && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 inline-block">
                          ✨ Demo Flagged (Alert Sent)
                        </span>
                      )}

                      {/* Edit & Delete Options: PM/CEO/Admin always; Developers & Testers before completed status */}
                      {(canManageAllTasks || ((role === "Developer" || role === "Tester") && task.status !== "Completed")) && (
                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100 mt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditTaskModal(task)}
                            className="text-sky-600 hover:text-sky-800 hover:bg-sky-50 h-7 px-2 text-xs font-semibold gap-1"
                            title="Edit Task Details"
                          >
                            <Edit3 className="h-3 w-3" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirmTask(task)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs font-semibold gap-1"
                            title="Delete Task"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* TIME LOGS HISTORY MODAL (With PM / Admin Edit Controls) */}
      <Dialog open={timeLogsModalOpen} onOpenChange={setTimeLogsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Clock className="h-5 w-5 text-sky-500" /> Task Time Tracking Sessions
            </DialogTitle>
          </DialogHeader>

          {selectedTaskForTimeLogs && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{selectedTaskForTimeLogs.title}</span>
                  <Badge className="bg-sky-50 text-sky-800 border-sky-200 font-bold">
                    Total: {formatHoursAndMinutes(selectedTaskForTimeLogs.hours_spent)}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">Project: {selectedTaskForTimeLogs.project_name || "N/A"}</p>
                {canManageAllTasks && (
                  <p className="text-[11px] text-emerald-700 font-semibold pt-1">
                    🛡️ Management Privileges: As {role}, you can adjust or delete recorded employee session times.
                  </p>
                )}
              </div>

              {loadingTimeLogs ? (
                <div className="text-center py-8 text-xs text-slate-500">Loading session history...</div>
              ) : taskTimeLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 border border-dashed rounded-xl">
                  No timer sessions recorded for this task yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {taskTimeLogs.map((log) => {
                    const isEditingThis = editingLogId === log.id;
                    const durationHours = (log.duration_minutes / 60).toFixed(2);

                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-xl border text-xs transition-all ${
                          log.is_active
                            ? "bg-emerald-50/60 border-emerald-300"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {isEditingThis ? (
                          /* PM / ADMIN INLINE EDIT FORM */
                          <div className="space-y-2.5 p-1">
                            <div className="font-bold text-slate-900 text-xs text-sky-800">
                              Adjust Session Times (PM/Admin)
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">Started At</label>
                                <Input
                                  type="datetime-local"
                                  value={editLogStart}
                                  onChange={(e) => setEditLogStart(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">Ended At</label>
                                <Input
                                  type="datetime-local"
                                  value={editLogEnd}
                                  onChange={(e) => setEditLogEnd(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">Session Notes</label>
                              <Input
                                value={editLogSummary}
                                onChange={(e) => setEditLogSummary(e.target.value)}
                                placeholder="Summary notes..."
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingLogId(null)}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveEditTimeLog(log.id)}
                                disabled={savingEditLog}
                                className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white font-bold"
                              >
                                {savingEditLog ? "Saving..." : "Save Correction"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* NORMAL VIEW */
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{log.user_name}</span>
                                <Badge variant="outline" className="text-[10px] font-medium text-slate-500">
                                  {log.user_role}
                                </Badge>
                                {log.is_active ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 animate-pulse">
                                    Currently Running
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-slate-700">
                                    {log.duration_minutes} mins ({durationHours}h)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span>▶ {new Date(log.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                <span>→</span>
                                <span>{log.ended_at ? new Date(log.ended_at).toLocaleTimeString([], { timeStyle: 'short' }) : "Ongoing"}</span>
                              </div>
                              {log.session_summary && (
                                <p className="text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded mt-1">
                                  "{log.session_summary}"
                                </p>
                              )}
                            </div>

                            {/* PM / Admin / CEO Edit & Delete Controls */}
                            {canManageAllTasks && !log.is_active && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditLog(log)}
                                  className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  title="Adjust session time (Admin, CEO, PM)"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTimeLog(log.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Delete time session"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Project Credentials Modal */}
      <Dialog open={projectCredsModalOpen} onOpenChange={setProjectCredsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 border border-slate-200 shadow-2xl rounded-2xl">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shadow-inner">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Credentials & Logins</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-xs font-bold">
                    {selectedProjectForCreds?.name || "Project"}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Secure access points, environments, and test accounts for this project.
                </p>
              </div>
            </div>

            {selectedProjectForCreds?.id && (
              <Link
                href={`/dashboard/credentials?projectId=${selectedProjectForCreds.id}`}
                target="_blank"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors"
                title="Open full project in Credentials Hub"
              >
                <span>Credentials Hub</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="p-6 space-y-4">
            {(() => {
              const projectCreds = selectedProjectForCreds
                ? projectCredentialsMap.get(selectedProjectForCreds.id) || []
                : [];

              if (projectCreds.length === 0) {
                return (
                  <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                      <KeyRound className="h-7 w-7 stroke-[1.5]" />
                    </div>
                    <div className="max-w-sm space-y-1">
                      <h4 className="font-bold text-slate-800 text-sm">No Credentials Added Yet</h4>
                      <p className="text-xs text-slate-500">
                        There are no credentials or test environments saved for{" "}
                        <span className="font-semibold text-slate-700">{selectedProjectForCreds?.name}</span>.
                      </p>
                    </div>
                    {canManageAllTasks && selectedProjectForCreds?.id && (
                      <Link
                        href={`/dashboard/credentials?projectId=${selectedProjectForCreds.id}&openModal=true`}
                        onClick={() => setProjectCredsModalOpen(false)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Project Credentials</span>
                      </Link>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {projectCreds.map((cred: any, idx: number) => {
                    const parsedAccounts = parseCredentialSections(cred.credentials_text || "", cred.credential_type || "Account");

                    return (
                      <div
                        key={cred.id || idx}
                        className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs hover:border-amber-300 transition-colors space-y-3"
                      >
                        {/* Header: Title, Type badge, and Copy All button */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{cred.title || cred.project_title || "Project Credentials"}</span>
                            {(cred.role || cred.credential_type) && (
                              <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                                {cred.role || cred.credential_type}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {cred.credentials_text && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyCredText(cred.credentials_text, `full-${cred.id}`, "Full Credentials")}
                                className="h-7 px-2 text-xs text-slate-600 hover:text-amber-700 hover:bg-amber-50 gap-1 rounded-md"
                                title="Copy all login details"
                              >
                                {credsCopiedKey === `full-${cred.id}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                <span className="font-semibold text-[11px]">
                                  {credsCopiedKey === `full-${cred.id}` ? "Copied All" : "Copy All"}
                                </span>
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* URLs: Live & Demo Links */}
                        {(cred.live_link || cred.url || cred.demo_link || cred.demo_url) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                            {(cred.live_link || cred.url) && (
                              <a
                                href={(cred.live_link || cred.url).startsWith("http") ? (cred.live_link || cred.url) : `https://${cred.live_link || cred.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/70 hover:bg-emerald-100/70 text-emerald-900 transition-colors text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <Globe className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Live Server URL</p>
                                    <p className="font-medium truncate text-emerald-950 text-xs">{cred.live_link || cred.url}</p>
                                  </div>
                                </div>
                                <ExternalLink className="h-3.5 w-3.5 text-emerald-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                              </a>
                            )}
                            {(cred.demo_link || cred.demo_url) && (
                              <a
                                href={(cred.demo_link || cred.demo_url).startsWith("http") ? (cred.demo_link || cred.demo_url) : `https://${cred.demo_link || cred.demo_url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-center justify-between p-2 rounded-lg bg-purple-50/70 border border-purple-200/70 hover:bg-purple-100/70 text-purple-900 transition-colors text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <Laptop className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">Demo / Staging URL</p>
                                    <p className="font-medium truncate text-purple-950 text-xs">{cred.demo_link || cred.demo_url}</p>
                                  </div>
                                </div>
                                <ExternalLink className="h-3.5 w-3.5 text-purple-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Parsed Accounts / Login Details */}
                        {parsedAccounts.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Accounts & Roles ({parsedAccounts.length})
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {parsedAccounts.map((acc, aIdx) => {
                                const credKey = `${cred.id}-${aIdx}`;
                                const isPassVisible = !!credsVisiblePasswords[credKey];

                                return (
                                  <div
                                    key={aIdx}
                                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors text-xs space-y-2"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-800 text-xs px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[11px]">
                                        {acc.role || `Account #${aIdx + 1}`}
                                      </span>
                                    </div>

                                    {/* Username field */}
                                    {acc.username && (
                                      <div className="flex items-center justify-between gap-1 bg-white p-1.5 px-2 rounded border border-slate-200">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[9px] uppercase font-bold text-slate-400">Username / Email</p>
                                          <p className="font-mono text-slate-800 text-[11px] truncate select-all">{acc.username}</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyCredText(acc.username!, `u-${credKey}`, "Username")}
                                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition"
                                          title="Copy username"
                                        >
                                          {credsCopiedKey === `u-${credKey}` ? (
                                            <Check className="h-3 w-3 text-emerald-600" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </button>
                                      </div>
                                    )}

                                    {/* Password field */}
                                    {acc.password && (
                                      <div className="flex items-center justify-between gap-1 bg-white p-1.5 px-2 rounded border border-slate-200">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[9px] uppercase font-bold text-slate-400">Password</p>
                                          <p className="font-mono text-slate-800 text-[11px] truncate">
                                            {isPassVisible ? acc.password : "••••••••••••"}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleCredPassword(credKey)}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition"
                                            title={isPassVisible ? "Hide password" : "Show password"}
                                          >
                                            {isPassVisible ? (
                                              <EyeOff className="h-3 w-3" />
                                            ) : (
                                              <Eye className="h-3 w-3" />
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyCredText(acc.password!, `p-${credKey}`, "Password")}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition"
                                            title="Copy password"
                                          >
                                            {credsCopiedKey === `p-${credKey}` ? (
                                              <Check className="h-3 w-3 text-emerald-600" />
                                            ) : (
                                              <Copy className="h-3 w-3" />
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Raw details fallback if no specific username/pass */}
                                    {!acc.username && !acc.password && (
                                      <pre className="font-mono text-[10px] text-slate-700 bg-white p-2 rounded border border-slate-200 whitespace-pre-wrap select-all">
                                        {acc.raw}
                                      </pre>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : cred.credentials_text ? (
                          <div className="pt-1">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Details & Notes
                            </p>
                            <pre className="font-mono text-[11px] text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap select-all">
                              {cred.credentials_text}
                            </pre>
                          </div>
                        ) : null}

                        {/* Extra description */}
                        {cred.description && (
                          <p className="text-[11px] text-slate-500 italic bg-amber-50/50 border border-amber-100 p-2 rounded-lg">
                            {cred.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200/80 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {selectedProjectForCreds ? `${projectCredentialsMap.get(selectedProjectForCreds.id)?.length || 0} credential record(s)` : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProjectCredsModalOpen(false)}
                className="h-8 text-xs font-semibold"
              >
                Close
              </Button>
              {selectedProjectForCreds?.id && (
                <Link
                  href={`/dashboard/credentials?projectId=${selectedProjectForCreds.id}`}
                  onClick={() => setProjectCredsModalOpen(false)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                >
                  <span>Open Full Credentials</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
