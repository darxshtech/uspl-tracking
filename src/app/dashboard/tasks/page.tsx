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
  XCircle 
} from "lucide-react";

export default function TasksPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const canCreateTask = role === "CEO" || role === "PM";

  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sub-task creation state
  const [activeChecklistTaskId, setActiveChecklistTaskId] = useState<number | null>(null);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    if (canCreateTask) fetchEmployees();
  }, [canCreateTask]);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTask) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          project_id: projectId,
          assigned_to: assignedTo,
          priority,
          due_date: dueDate || null,
        }),
      });

      if (res.ok) {
        setOpen(false);
        fetchTasks();
        setTitle("");
        setDescription("");
        setProjectId("");
        setAssignedTo("");
        setDueDate("");
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
        return <Badge className="bg-red-600 text-white font-bold">Changes Required (QA Failed)</Badge>;
      case "Tested (PASS)":
        return <Badge className="bg-emerald-600 text-white font-bold">QA Passed (Ready for Demo)</Badge>;
      case "Ready for Demo":
        return <Badge className="bg-indigo-600 text-white font-bold shadow-md animate-pulse">🚀 Ready for Demo (Alert Sent)</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-500 text-white font-bold">Completed</Badge>;
      default:
        return <Badge variant="outline" className="font-semibold">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-sky-500" />
            Task Lifecycle & Progress Tracking
          </h1>
          <p className="text-slate-500 mt-1">
            Complete development lifecycle: Start Plan &rarr; Start Work &rarr; Daily Tasks Checklist &rarr; QA Testing &rarr; Submit to Demo.
          </p>
        </div>

        {canCreateTask && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md flex items-center gap-2" />}>
              <Plus className="h-4 w-4" /> Create & Assign Task
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-sky-500" /> Assign New Development Task
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreate} className="space-y-4 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="font-semibold text-slate-700">Task Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Build Payment Webhook Listener"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="font-semibold text-slate-700">Description & Acceptance Criteria</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed requirements for the developer"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Project *</Label>
                    <Select value={projectId} onValueChange={(val) => setProjectId(val || "")}>
                      <SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                  <div className="space-y-1.5">
                    <Label htmlFor="dueDate" className="font-semibold text-slate-700">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2"
                >
                  {submitting ? "Assigning Task..." : "Create & Assign Task"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Task List Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Task & Checklist</TableHead>
              <TableHead className="font-bold">Project</TableHead>
              <TableHead className="font-bold">Assignee</TableHead>
              <TableHead className="font-bold">Priority</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold text-right">Developer & QA Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading tasks...</TableCell></TableRow>
            ) : tasks.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-10">No tasks found.</TableCell></TableRow>
            ) : (
              tasks.map((task) => {
                const checklists: any[] = task.checklists || [];
                const completedChecklists = checklists.filter((c) => c.is_completed).length;
                const progressPct = checklists.length > 0 ? Math.round((completedChecklists / checklists.length) * 100) : 0;
                const isChecklistOpen = activeChecklistTaskId === task.id;

                return (
                  <TableRow key={task.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="align-top">
                      <div className="font-bold text-slate-900 text-sm">{task.title}</div>
                      {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}

                      {/* Sub-tasks / Daily Checklist Section */}
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveChecklistTaskId(isChecklistOpen ? null : task.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-sky-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                          >
                            <ListTodo className="h-3 w-3 text-sky-500" />
                            {checklists.length > 0 ? `${completedChecklists}/${checklists.length} Sub-tasks (${progressPct}%)` : "+ Add Sub-tasks"}
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

                            {/* Add new checklist item input */}
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

                    <TableCell className="align-top text-slate-700 text-xs font-semibold">{task.project_name || "N/A"}</TableCell>
                    <TableCell className="align-top text-slate-700 text-xs font-semibold">{task.assignee_name || "Unassigned"}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className="font-semibold text-[11px]">{task.priority}</Badge>
                    </TableCell>
                    <TableCell className="align-top">{getStatusBadge(task.status)}</TableCell>

                    {/* Developer & QA Action Buttons */}
                    <TableCell className="align-top text-right space-y-1">
                      {/* 1. Start Plan */}
                      {(task.status === "Created" || task.status === "Assigned") && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task.id, "Planning")}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Start Plan
                        </Button>
                      )}

                      {/* 2. Start Work */}
                      {task.status === "Planning" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task.id, "In Progress")}
                          className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                        >
                          <Play className="h-3.5 w-3.5" /> Start Work
                        </Button>
                      )}

                      {/* 3. Send for Testing */}
                      {(task.status === "In Progress" || task.status === "Changes Required") && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task.id, "Ready for Testing")}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5 shadow-xs"
                        >
                          <Send className="h-3.5 w-3.5" /> Send for Testing
                        </Button>
                      )}

                      {/* 4. Tested (PASS) -> SUBMIT TO DEMO */}
                      {task.status === "Tested (PASS)" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task.id, "Ready for Demo")}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-md animate-bounce"
                        >
                          <Rocket className="h-3.5 w-3.5" /> Submit to Demo
                        </Button>
                      )}

                      {/* 5. Ready for Demo Notice */}
                      {task.status === "Ready for Demo" && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 inline-block">
                          ✨ Demo Flagged (Alert Sent)
                        </span>
                      )}

                      {task.status === "Completed" && (
                        <span className="text-xs text-emerald-600 font-bold flex items-center justify-end gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Done
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
