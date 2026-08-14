"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Link as LinkIcon
} from "lucide-react";

export default function DailyTasksPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const currentUserId = (session?.user as any)?.id;
  const canManageAllTasks = role === "CEO" || role === "PM";

  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow" | "assigned_pm" | "assigned_ceo" | "from_tester" | "self_created" | "all">("today");

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

  // Sub-task creation in table
  const [activeChecklistTaskId, setActiveChecklistTaskId] = useState<number | null>(null);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Update Task Progress Modal state (Status limited to Planning, In Progress, Completed)
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [selectedTaskForProgress, setSelectedTaskForProgress] = useState<any>(null);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [hoursSpentToday, setHoursSpentToday] = useState<number>(2.0);
  const [dailySummary, setDailySummary] = useState<string>("");
  const [blockers, setBlockers] = useState<string>("");
  const [progressStatus, setProgressStatus] = useState<string>("In Progress");
  const [submittingProgress, setSubmittingProgress] = useState(false);

  // Dedicated Send to Testing Modal state (Multiple preview links)
  const [testingModalOpen, setTestingModalOpen] = useState(false);
  const [selectedTaskForTesting, setSelectedTaskForTesting] = useState<any>(null);
  const [taskLinks, setTaskLinks] = useState<string[]>([""]);
  const [testingNotes, setTestingNotes] = useState<string>("");
  const [submittingTesting, setSubmittingTesting] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchEmployees();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

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
      alert("Please enter a title and select a project.");
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
        }),
      });

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
      } else {
        const data = await res.json();
        alert(`Failed to create task: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit task.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Update Progress Modal
  const openProgressModal = (task: any) => {
    setSelectedTaskForProgress(task);
    setProgressPercentage(task.progress_percentage || 0);
    setHoursSpentToday(Math.max(0, parseFloat(task.hours_spent) || 2.0));
    setDailySummary(task.daily_summary || "");
    setBlockers(task.blockers || "");
    
    // Only allow Planning, In Progress, Completed
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
      } else {
        const data = await res.json();
        alert(`Failed to update task progress: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while updating task progress.");
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
      alert("Please provide at least one valid preview / PR link for the QA tester.");
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
      } else {
        const data = await res.json();
        alert(`Failed to submit for QA testing: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while submitting task to testing.");
    } finally {
      setSubmittingTesting(false);
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
        alert("Failed to update status.");
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
        return <Badge className="bg-red-600 text-white font-bold">Changes Required (QA Issues)</Badge>;
      case "Tested (PASS)":
        return <Badge className="bg-emerald-600 text-white font-bold">QA Passed (Fully Fixed)</Badge>;
      case "Ready for Demo":
        return <Badge className="bg-indigo-600 text-white font-bold shadow-md animate-pulse">🚀 Ready for Demo (Alert Sent)</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-500 text-white font-bold">Completed</Badge>;
      default:
        return <Badge variant="outline" className="font-semibold">{status}</Badge>;
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // Filtering based on active category
  const filteredTasks = tasks.filter((t) => {
    const taskDate = t.target_date ? t.target_date.split("T")[0] : todayStr;
    const isCompleted = t.status === "Completed" || t.status === "Ready for Demo";

    if (activeTab === "today") {
      return taskDate <= todayStr || !isCompleted;
    }
    if (activeTab === "tomorrow") {
      return taskDate > todayStr;
    }
    if (activeTab === "assigned_pm") {
      return t.assigned_by_type === "PM" || t.creator_role === "PM" || t.project_creator_role === "PM";
    }
    if (activeTab === "assigned_ceo") {
      return t.assigned_by_type === "CEO" || t.creator_role === "CEO" || t.project_creator_role === "CEO";
    }
    if (activeTab === "from_tester") {
      return t.assigned_by_type === "Tester" || t.status === "Changes Required" || t.creator_role === "Tester";
    }
    if (activeTab === "self_created") {
      return t.assigned_by_type === "Self Tested" || t.created_by === currentUserId;
    }
    return true;
  });

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
            {role === "Developer"
              ? "Plan daily tasks, update progress (% done & hours spent), document blockers, and submit preview links for QA testing."
              : "Track developer daily tasks, review blockers, monitor QA verification cycles, and manage client demo releases."}
          </p>
        </div>

        {/* Create Task Button */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogTrigger render={<Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md flex items-center gap-2" />}>
            <Plus className="h-4 w-4" /> {role === "Developer" ? "Create Daily Task" : "Create & Assign Task"}
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-sky-500" /> 
                {role === "Developer" ? "Create Daily Task for Assigned Project" : "Create & Assign Task"}
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
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of code deliverables"
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
                      <SelectItem value="Self Tested">✍️ Self Tested (Developer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {canManageAllTasks ? (
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Assign Developer *</Label>
                    <Select value={assignedTo} onValueChange={(val) => setAssignedTo(val || "")}>
                      <SelectTrigger><SelectValue placeholder="Select Developer" /></SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => e.role === "Developer" || e.role === "Tester")
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
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

              {/* Timeline Selection */}
              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <Label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Calendar className="h-4 w-4 text-sky-500" /> When will you work on this task?
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

                <p className="text-[11px] text-slate-500 mt-1">
                  {timeline === "today"
                    ? "✓ Active today. If not finished 100%, it will automatically roll over to tomorrow's tasks."
                    : timeline === "tomorrow"
                    ? "✓ Scheduled for tomorrow. When you check in tomorrow, it will automatically show in Today's Tasks."
                    : "✓ Scheduled for selected date."}
                </p>
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
                  <div className="space-y-1.5 pt-1">
                    {initialChecklists.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200 text-xs">
                        <span className="text-slate-800 font-medium">✓ {item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveInitialChecklist(idx)}
                          className="text-red-500 hover:text-red-700 p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
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

      {/* Categorized Filter Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab("today")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "all"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All ({tasks.length})
        </button>
      </div>

      {/* UPDATE TASK PROGRESS MODAL (Status: Planning, In Progress, Completed) */}
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

            {/* Hours Spent (Non-negative) & Status */}
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
                <p className="text-[10px] text-amber-700">
                  Management and team will see this blocker note on the daily dashboard.
                </p>
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

      {/* DEDICATED SEND TO TESTING MODAL (MULTIPLE PREVIEW LINKS) */}
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

            {/* Multiple Task Links */}
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
              <p className="text-[11px] text-slate-500">
                Testers will use these exact URLs on their QA dashboard during testing check-in.
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

      {/* Task List Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Task & Progress</TableHead>
              <TableHead className="font-bold">Project & Assigner</TableHead>
              <TableHead className="font-bold">Schedule & QA Notes</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold text-right">Daily Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading daily tasks...</TableCell></TableRow>
            ) : filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-10">
                  No daily tasks found in this section.
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
                const pct = task.progress_percentage || (checklists.length > 0 ? checklistPct : 0);

                const taskLinksList: string[] = Array.isArray(task.task_links) && task.task_links.length > 0
                  ? task.task_links
                  : task.task_link ? [task.task_link] : [];

                return (
                  <TableRow key={task.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="align-top max-w-sm">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span>{task.title}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">{task.priority}</Badge>
                      </div>
                      {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}

                      {/* Visual Progress Bar */}
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-700">Progress: {pct}% Done</span>
                          {task.hours_spent > 0 && (
                            <span className="text-slate-500 font-semibold flex items-center gap-1">
                              <Clock className="h-3 w-3 text-sky-500" /> {task.hours_spent} hrs logged
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
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-sky-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                          >
                            <ListTodo className="h-3 w-3 text-sky-500" />
                            {checklists.length > 0 ? `${completedChecklists}/${checklists.length} Checklist Items` : "+ Add Sub-tasks"}
                          </button>
                        </div>

                        {/* Expandable Checklist */}
                        {isChecklistOpen && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 mt-1 max-w-md">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Sub-tasks & Checklist</span>
                            {checklists.map((c) => (
                              <div
                                key={c.id}
                                onClick={() => handleToggleChecklist(c.id, c.is_completed)}
                                className="flex items-center gap-2 text-xs cursor-pointer text-slate-800 hover:text-sky-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={c.is_completed}
                                  onChange={() => {}}
                                  className="rounded border-slate-300 text-sky-600 h-3.5 w-3.5"
                                />
                                <span className={c.is_completed ? "line-through text-slate-400" : "font-medium"}>
                                  {c.item_text}
                                </span>
                              </div>
                            ))}

                            <div className="flex items-center gap-1.5 pt-1">
                              <Input
                                placeholder="New daily sub-task..."
                                value={newChecklistText}
                                onChange={(e) => setNewChecklistText(e.target.value)}
                                className="h-7 text-xs bg-white"
                                onKeyDown={(e) => e.key === "Enter" && handleAddChecklist(task.id)}
                              />
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => handleAddChecklist(task.id)}
                                className="h-7 px-2 text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>

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
                        Dev: <span className="font-medium text-slate-700">{task.assignee_name || "Unassigned"}</span>
                      </div>
                    </TableCell>

                    <TableCell className="align-top space-y-1.5">
                      <div>
                        {isToday ? (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-[10px] gap-1">
                            <Flame className="h-3 w-3 text-amber-600" /> Today's Task
                          </Badge>
                        ) : (
                          <Badge className="bg-indigo-50 text-indigo-800 border-indigo-300 font-bold text-[10px] gap-1">
                            <SunMedium className="h-3 w-3 text-indigo-600" /> Tomorrow ({taskDate})
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

                      {/* Dedicated SEND TO TESTING Button */}
                      {(task.status === "In Progress" || task.status === "Changes Required" || task.status === "Completed") && (
                        <Button
                          size="sm"
                          onClick={() => openSendToTestingModal(task)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5 shadow-xs w-full justify-center"
                        >
                          <Send className="h-3.5 w-3.5" /> Send to Testing
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
