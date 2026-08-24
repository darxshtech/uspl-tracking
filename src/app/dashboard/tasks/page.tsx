"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess, showWarning, showToast } from "@/lib/swal";
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
  Hash
} from "lucide-react";
import { formatHoursAndMinutes } from "@/lib/timeUtils";

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
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow" | "assigned_pm" | "assigned_ceo" | "from_tester" | "self_created" | "all">("today");

  // Advanced Filters State
  const [filterProject, setFilterProject] = useState<string>("ALL");
  const [filterDateMode, setFilterDateMode] = useState<string>("ALL");
  const [filterCustomDate, setFilterCustomDate] = useState<string>("");
  const [filterEmployee, setFilterEmployee] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create Task Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [assignedByType, setAssignedByType] = useState<"PM" | "CEO" | "Tester" | "Self Tested">("Self Tested");
  const [timeline, setTimeline] = useState<"today" | "tomorrow" | "custom">("today");
  const [customDate, setCustomDate] = useState("");
  const [initialChecklists, setInitialChecklists] = useState<string[]>([]);
  const [newChecklistInput, setNewChecklistInput] = useState("");
  const [assignToAll, setAssignToAll] = useState(false);
  const [isMockTask, setIsMockTask] = useState(false);

  // Sub-task creation in table
  const [activeChecklistTaskId, setActiveChecklistTaskId] = useState<number | null>(null);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Update Task Progress Modal state
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [selectedTaskForProgress, setSelectedTaskForProgress] = useState<any>(null);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [hoursSpentToday, setHoursSpentToday] = useState<number>(2.0);
  const [dailySummary, setDailySummary] = useState<string>("");
  const [blockers, setBlockers] = useState<string>("");
  const [progressStatus, setProgressStatus] = useState<string>("In Progress");
  const [submittingProgress, setSubmittingProgress] = useState(false);

  // Dedicated Send to Testing Modal state
  const [testingModalOpen, setTestingModalOpen] = useState(false);
  const [selectedTaskForTesting, setSelectedTaskForTesting] = useState<any>(null);
  const [taskLinks, setTaskLinks] = useState<string[]>([""]);
  const [testingNotes, setTestingNotes] = useState<string>("");
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
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editStatus, setEditStatus] = useState("In Progress");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editAssignedByType, setEditAssignedByType] = useState("PM");
  const [editProgressPercentage, setEditProgressPercentage] = useState(0);
  const [editHoursSpent, setEditHoursSpent] = useState(0);
  const [editBlockers, setEditBlockers] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [savingEditTask, setSavingEditTask] = useState(false);

  // Delete Task Confirmation State (CEO, PM, Admin)
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<any>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchEmployees();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchTasks();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

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

  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

  const handleAddInitialChecklist = () => {
    if (!newChecklistInput.trim()) return;
    setInitialChecklists((prev) => [...prev, newChecklistInput.trim()]);
    setNewChecklistInput("");
  };

  const handleRemoveInitialChecklist = (index: number) => {
    setInitialChecklists((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !projectId) {
      showWarning("Missing Fields", "Please enter a title and select a project.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          project_id: projectId,
          assigned_to: canManageAllTasks ? (assignedTo || currentUserId) : currentUserId,
          priority,
          assigned_by_type: assignedByType,
          timeline,
          target_date: timeline === "custom" ? customDate : undefined,
          checklists: initialChecklists,
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
        setAssignedTo("");
        setPriority("Medium");
        setAssignedByType("Self Tested");
        setTimeline("today");
        setCustomDate("");
        setInitialChecklists([]);
        setNewChecklistInput("");
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

  // Open Edit Task Modal (PM, CEO, Admin)
  const openEditTaskModal = (task: any) => {
    setEditingTask(task);
    setEditTitle(task.title || "");
    setEditDescription(task.description || "");
    setEditProjectId(task.project_id ? task.project_id.toString() : "");
    setEditAssignedTo(task.assigned_to ? task.assigned_to.toString() : "");
    setEditPriority(task.priority || "Medium");
    setEditStatus(task.status || "In Progress");
    setEditTargetDate(task.target_date ? task.target_date.split("T")[0] : "");
    setEditAssignedByType(task.assigned_by_type || "PM");
    setEditProgressPercentage(task.progress_percentage || 0);
    setEditHoursSpent(parseFloat(task.hours_spent) || 0);
    setEditBlockers(task.blockers || "");
    setEditRemarks(task.remarks || "");
    setEditTaskModalOpen(true);
  };

  // Save Edit Task (PM, CEO, Admin)
  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

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
          assigned_to: editAssignedTo ? parseInt(editAssignedTo) : undefined,
          priority: editPriority,
          status: editStatus,
          target_date: editTargetDate || undefined,
          assigned_by_type: editAssignedByType,
          progress_percentage: editProgressPercentage,
          hours_spent: editHoursSpent,
          blockers: editBlockers.trim() || null,
          remarks: editRemarks.trim() || null,
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
    setHoursSpentToday(Math.max(0, parseFloat(task.hours_spent) || 2.0));
    setDailySummary(task.daily_summary || "");
    setBlockers(task.blockers || "");
    
    const validStatuses = ["Planning", "In Progress", "Completed"];
    setProgressStatus(validStatuses.includes(task.status) ? task.status : "In Progress");
    setProgressModalOpen(true);
  };

  // Save Progress
  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForProgress) return;

    setSubmittingProgress(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTaskForProgress.id,
          status: progressStatus,
          progress_percentage: progressPercentage,
          hours_spent: Math.max(0, Number(hoursSpentToday) || 0),
          daily_summary: dailySummary.trim(),
          blockers: blockers.trim() || null,
        }),
      });

      if (res.ok) {
        setProgressModalOpen(false);
        setSelectedTaskForProgress(null);
        fetchTasks();
        showToast("Progress updated!");
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

  // Open Dedicated Send to Testing Modal
  const openSendToTestingModal = (task: any) => {
    setSelectedTaskForTesting(task);
    const existingLinks = Array.isArray(task.task_links) && task.task_links.length > 0
      ? task.task_links
      : task.task_link ? [task.task_link] : [""];
    setTaskLinks(existingLinks);
    setTestingNotes("");
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
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTaskForTesting.id,
          action: "send_to_testing",
          task_links: validLinks,
          remarks: testingNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        setTestingModalOpen(false);
        setSelectedTaskForTesting(null);
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
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      if (res.ok) {
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

  const getStatusBadge = (status: string) => {
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
      const taskDate = t.target_date ? t.target_date.split("T")[0] : todayStr;
      const isCompleted = t.status === "Completed" || t.status === "Ready for Demo";

      // 1. Tab filtering
      let matchTab = true;
      if (activeTab === "today") {
        matchTab = taskDate <= todayStr || !isCompleted;
      } else if (activeTab === "tomorrow") {
        matchTab = taskDate > todayStr;
      } else if (activeTab === "assigned_pm") {
        matchTab = t.assigned_by_type === "PM" || t.creator_role === "PM" || t.project_creator_role === "PM";
      } else if (activeTab === "assigned_ceo") {
        matchTab = t.assigned_by_type === "CEO" || t.creator_role === "CEO" || t.project_creator_role === "CEO";
      } else if (activeTab === "from_tester") {
        matchTab = t.assigned_by_type === "Tester" || t.status === "Changes Required" || t.creator_role === "Tester";
      } else if (activeTab === "self_created") {
        matchTab = t.assigned_by_type === "Self Tested" || t.created_by === currentUserId;
      }

      if (!matchTab) return false;

      // 2. Project filter
      if (filterProject !== "ALL" && String(t.project_id) !== String(filterProject)) {
        return false;
      }

      // 3. Employee / Developer Advance filter (for PM/CEO/Admin)
      if (filterEmployee !== "ALL" && String(t.assigned_to) !== String(filterEmployee)) {
        return false;
      }

      // 4. Date filter
      if (filterDateMode === "TODAY" && taskDate !== todayStr) {
        return false;
      }
      if (filterDateMode === "TOMORROW" && taskDate !== tomorrowStr) {
        return false;
      }
      if (filterDateMode === "CUSTOM" && filterCustomDate && taskDate !== filterCustomDate) {
        return false;
      }

      // 5. Search query filter (title, description, project name)
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
  }, [tasks, activeTab, filterProject, filterEmployee, filterDateMode, filterCustomDate, searchQuery, todayStr, tomorrowStr, currentUserId]);

  const projectFastTrackMap = useMemo(() => {
    const map: Record<number, boolean> = {};
    if (Array.isArray(projects)) {
      projects.forEach((p: any) => {
        map[p.id] = Boolean(p.is_fast_track);
      });
    }
    return map;
  }, [projects]);

  const countToday = tasks.filter((t) => {
    const taskDate = t.target_date ? t.target_date.split("T")[0] : todayStr;
    const isCompleted = t.status === "Completed" || t.status === "Ready for Demo";
    return taskDate <= todayStr || !isCompleted;
  }).length;

  const countTomorrow = tasks.filter((t) => (t.target_date ? t.target_date.split("T")[0] : todayStr) > todayStr).length;
  const countPM = tasks.filter((t) => t.assigned_by_type === "PM" || t.creator_role === "PM" || t.project_creator_role === "PM").length;
  const countCEO = tasks.filter((t) => t.assigned_by_type === "CEO" || t.creator_role === "CEO" || t.project_creator_role === "CEO").length;
  const countTester = tasks.filter((t) => t.assigned_by_type === "Tester" || t.status === "Changes Required" || t.creator_role === "Tester").length;
  const countSelf = tasks.filter((t) => t.assigned_by_type === "Self Tested" || t.created_by === currentUserId).length;

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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

                  {canManageAllTasks ? (
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-slate-700">
                        {assignToAll ? "Assignee Target" : "Assign Team Member *"}
                      </Label>
                      {assignToAll ? (
                        <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-sky-50 border border-sky-200 text-xs font-bold text-sky-900">
                          <Sparkles className="h-3.5 w-3.5 text-sky-600 animate-pulse" />
                          <span>All Available Employees ({employees.length} Members)</span>
                        </div>
                      ) : (
                        <Select value={assignedTo} onValueChange={(val) => setAssignedTo(val || "")}>
                          <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                          <SelectContent>
                            {employees.map((e) => (
                              <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ) : (
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

                {/* Timeline Selection */}
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <Calendar className="h-4 w-4 text-sky-500" /> Target Date & Schedule
                  </Label>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setTimeline("today")}
                      className={`p-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                        timeline === "today"
                          ? "bg-sky-50 border-sky-400 text-sky-900 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Flame className="h-4 w-4 text-amber-500" />
                      <span>⚡ To Do Today</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTimeline("tomorrow")}
                      className={`p-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                        timeline === "tomorrow"
                          ? "bg-indigo-50 border-indigo-400 text-indigo-900 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <SunMedium className="h-4 w-4 text-indigo-500" />
                      <span>🌅 For Tomorrow</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTimeline("custom")}
                      className={`p-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                        timeline === "custom"
                          ? "bg-purple-50 border-purple-400 text-purple-900 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Calendar className="h-4 w-4 text-purple-500" />
                      <span>📅 Specific Date</span>
                    </button>
                  </div>

                  {timeline === "custom" && (
                    <div className="pt-2">
                      <Input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="bg-white text-xs"
                        required
                      />
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
                      className="h-8 bg-sky-600 text-white font-semibold text-xs"
                    >
                      Add
                    </Button>
                  </div>

                  {initialChecklists.length > 0 && (
                    <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                      {initialChecklists.map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs">
                          <span className="text-slate-800 font-medium whitespace-pre-wrap break-words [overflow-wrap:anywhere] flex-1 leading-relaxed">
                            ✓ {item}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveInitialChecklist(idx)}
                            className="text-red-500 hover:text-red-700 p-0.5 shrink-0 mt-0.5"
                            title="Remove sub-task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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

      {/* ADVANCED MULTI-FILTER BAR (Project, Date, Developer Name, Search) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Filter className="h-4 w-4 text-sky-500" /> Filter & Search Tasks
          </div>
          {(filterProject !== "ALL" || filterEmployee !== "ALL" || filterDateMode !== "ALL" || searchQuery) && (
            <button
              onClick={() => {
                setFilterProject("ALL");
                setFilterEmployee("ALL");
                setFilterDateMode("ALL");
                setFilterCustomDate("");
                setSearchQuery("");
              }}
              className="text-xs font-bold text-sky-600 hover:text-sky-800 underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
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

          {/* 3. Filter by Date */}
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

          {/* 4. Custom Date Picker or Search */}
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
          QA Changes Required ({countTester})
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
                <Label className="font-bold text-slate-800 text-xs">
                  Completion Progress: <span className="text-sky-600 text-sm font-black">{progressPercentage}%</span>
                </Label>
                <div className="flex gap-1">
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setProgressPercentage(pct)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all ${
                        progressPercentage === pct
                          ? "bg-sky-600 text-white border-sky-600"
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
                onChange={(e) => setProgressPercentage(parseInt(e.target.value))}
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
                <Label htmlFor="hoursSpent" className="font-semibold text-slate-700 text-xs">
                  Hours Spent Today *
                </Label>
                <Input
                  id="hoursSpent"
                  type="number"
                  min="0"
                  step="0.5"
                  value={hoursSpentToday}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setHoursSpentToday(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">Task Status</Label>
                <Select 
                  value={progressStatus} 
                  onValueChange={(val) => setProgressStatus(val || "In Progress")}
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

            <Button
              type="submit"
              disabled={submittingProgress}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 shadow-md"
            >
              {submittingProgress ? "Updating Task..." : "Save Progress & Sync Daily Log"}
            </Button>
          </form>
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
                🚀 This task will be flagged as <strong>Ready for Demo</strong> directly for PM and CEO review.
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
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Edit3 className="h-5 w-5 text-sky-500" />
              Edit Task Details
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEditTask} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="editTaskTitle" className="font-semibold text-slate-700 text-xs">Task Title *</Label>
              <Input
                id="editTaskTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editTaskDescription" className="font-semibold text-slate-700 text-xs">Description & Scope</Label>
              <textarea
                id="editTaskDescription"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">Project</Label>
                <Select value={editProjectId} onValueChange={(val) => setEditProjectId(val || "")}>
                  <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">Assigned Member</Label>
                <Select value={editAssignedTo} onValueChange={(val) => setEditAssignedTo(val || "")}>
                  <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                    ))}
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

              <div className="space-y-1.5">
                <Label htmlFor="editTaskTargetDate" className="font-semibold text-slate-700 text-xs">Scheduled Target Date</Label>
                <Input
                  id="editTaskTargetDate"
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">Assigned By Tag</Label>
                <Select value={editAssignedByType} onValueChange={(val) => setEditAssignedByType(val || "PM")}>
                  <SelectTrigger><SelectValue placeholder="Assigned By" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PM">📋 PM</SelectItem>
                    <SelectItem value="CEO">👑 CEO</SelectItem>
                    <SelectItem value="Tester">🧪 Tester</SelectItem>
                    <SelectItem value="Self Tested">✍️ Self Tested</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                  type="number"
                  min="0"
                  step="0.5"
                  value={editHoursSpent}
                  onChange={(e) => setEditHoursSpent(parseFloat(e.target.value) || 0)}
                  className="text-xs"
                />
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

      {/* Task List Table with Dedicated TASK ID and DATE Columns */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold w-20 text-center">Task ID</TableHead>
              <TableHead className="font-bold">Task & Progress</TableHead>
              <TableHead className="font-bold">Project & Assigner</TableHead>
              <TableHead className="font-bold">Schedule Date</TableHead>
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
                const taskDate = task.target_date ? task.target_date.split("T")[0] : todayStr;
                const isToday = taskDate <= todayStr;
                const isTomorrow = taskDate === tomorrowStr;
                const pct = task.progress_percentage || (checklists.length > 0 ? checklistPct : 0);
                const employeeSeqId = employeeTaskSeqMap[task.id] || task.id;

                const taskLinksList: string[] = Array.isArray(task.task_links) && task.task_links.length > 0
                  ? task.task_links
                  : task.task_link ? [task.task_link] : [];
                const isFastTrack = Boolean(task.project_is_fast_track || projectFastTrackMap[task.project_id]);

                return (
                  <TableRow key={task.id} className="hover:bg-slate-50/80 transition-colors">
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
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {checklists.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic">No checklist sub-tasks yet.</p>
                              ) : (
                                checklists.map((c) => (
                                  <div
                                    key={c.id}
                                    onClick={() => handleToggleChecklist(c.id, c.is_completed)}
                                    className="flex items-start gap-2 text-xs cursor-pointer text-slate-800 hover:text-sky-700 p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={c.is_completed}
                                      onChange={() => {}}
                                      className="rounded border-slate-300 text-sky-600 h-3.5 w-3.5 mt-0.5 shrink-0 cursor-pointer"
                                    />
                                    <span className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 max-w-full flex-1 leading-relaxed ${c.is_completed ? "line-through text-slate-400 font-normal" : "font-semibold text-slate-800"}`}>
                                      {c.item_text}
                                    </span>
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
                    <TableCell className="align-top space-y-1">
                      <div className="font-bold text-slate-900 text-xs">{task.project_name || "N/A"}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
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
                      <div className="text-[11px] text-slate-500">
                        Assignee: <span className="font-medium text-slate-700">{task.assignee_name || "Unassigned"}</span>
                      </div>
                    </TableCell>

                    {/* DEDICATED SCHEDULE DATE COLUMN */}
                    <TableCell className="align-top space-y-1.5">
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-sky-500" />
                        {new Date(taskDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>

                      <div>
                        {isToday ? (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-[10px] gap-1">
                            <Flame className="h-3 w-3 text-amber-600" /> Today's Task
                          </Badge>
                        ) : isTomorrow ? (
                          <Badge className="bg-indigo-50 text-indigo-800 border-indigo-300 font-bold text-[10px] gap-1">
                            <SunMedium className="h-3 w-3 text-indigo-600" /> Tomorrow
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

                      {/* Project-dependent action button: Send for Demo (Fastest Dev) vs Send to Testing (Standard QA) */}
                      {isFastTrack ? (
                        /* FASTEST DEVELOPMENT: Show Send for Demo instead of Send to Testing */
                        (task.status === "In Progress" || task.status === "Changes Required" || task.status === "Completed" || task.status === "Planning") && (
                          <Button
                            size="sm"
                            onClick={() => openDirectSubmitModal(task)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-xs w-full justify-center"
                          >
                            <Rocket className="h-3.5 w-3.5 text-indigo-200" /> Send for Demo
                          </Button>
                        )
                      ) : (
                        /* STANDARD QA: Show Send to Testing */
                        (task.status === "In Progress" || task.status === "Changes Required" || task.status === "Completed") && (
                          <Button
                            size="sm"
                            onClick={() => openSendToTestingModal(task)}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5 shadow-xs w-full justify-center"
                          >
                            <Send className="h-3.5 w-3.5" /> Send to Testing
                          </Button>
                        )
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
    </div>
  );
}
