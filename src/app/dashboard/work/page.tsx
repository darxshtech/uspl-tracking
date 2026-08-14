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
  Clock, 
  Plus, 
  Briefcase, 
  CheckSquare, 
  Calendar, 
  User, 
  FileText, 
  CheckCircle2, 
  Filter 
} from "lucide-react";

export default function DailyWorkPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isManager = role === "CEO" || role === "PM";

  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for managers
  const [filterEmployee, setFilterEmployee] = useState("ALL");
  const [filterProject, setFilterProject] = useState("ALL");

  // Log Work Form Modal State
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [hoursWorked, setHoursWorked] = useState("8.0");
  const [workDescription, setWorkDescription] = useState("");
  const [status, setStatus] = useState("Completed");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWorkLogs();
    fetchProjects();
    fetchTasks();
    if (isManager) fetchEmployees();
  }, [isManager, filterEmployee, filterProject]);

  const fetchWorkLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        employee_id: filterEmployee,
        project_id: filterProject,
      });
      const res = await fetch(`/api/work?${query.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) setWorkLogs(data);
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

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
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

  const handleLogWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId || null,
          task_id: taskId || null,
          hours_worked: parseFloat(hoursWorked),
          work_description: workDescription,
          status,
          remarks,
        }),
      });

      if (res.ok) {
        setOpen(false);
        fetchWorkLogs();
        setWorkDescription("");
        setRemarks("");
        setHoursWorked("8.0");
      } else {
        const data = await res.json();
        alert(`Failed to log work: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit work log.");
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate totals
  const totalHoursLogged = workLogs.reduce((acc, l) => acc + (parseFloat(l.hours_worked) || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Clock className="h-8 w-8 text-sky-500" />
            Daily Work & Accomplishments Hub
          </h1>
          <p className="text-slate-500 mt-1">
            {isManager
              ? "Review company-wide daily work logs, task achievements, and developer hours."
              : "Log daily work hours, project progress, and task deliverables."}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md flex items-center gap-2" />}>
            <Plus className="h-4 w-4" /> Log Daily Work
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-sky-500" /> Log Daily Accomplishments
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleLogWork} className="space-y-4 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700">Project</Label>
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
                  <Label className="font-semibold text-slate-700">Related Task</Label>
                  <Select value={taskId} onValueChange={(val) => setTaskId(val || "")}>
                    <SelectTrigger><SelectValue placeholder="Select Task" /></SelectTrigger>
                    <SelectContent>
                      {tasks.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hoursWorked" className="font-semibold text-slate-700">Hours Worked *</Label>
                  <Input
                    id="hoursWorked"
                    type="number"
                    step="0.5"
                    value={hoursWorked}
                    onChange={(e) => setHoursWorked(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700">Progress Status</Label>
                  <Select value={status} onValueChange={(val) => setStatus(val || "Completed")}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="workDesc" className="font-semibold text-slate-700">Work Description & Deliverables *</Label>
                <textarea
                  id="workDesc"
                  rows={3}
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder="Summary of modules created, bugs fixed, PRs reviewed, or testing executed..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="remarks" className="font-semibold text-slate-700">Blockers or Additional Remarks</Label>
                <Input
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes or dependencies..."
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2"
              >
                {submitting ? "Saving Work Log..." : "Submit Daily Work Log"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Manager Filter Bar */}
      {isManager && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
            <Filter className="h-4 w-4 text-sky-500" /> Filter Team Daily Work
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 uppercase">Team Member</Label>
              <Select value={filterEmployee} onValueChange={(val) => setFilterEmployee(val || "ALL")}>
                <SelectTrigger><SelectValue placeholder="All Members" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Team Members</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 uppercase">Project</Label>
              <Select value={filterProject} onValueChange={(val) => setFilterProject(val || "ALL")}>
                <SelectTrigger><SelectValue placeholder="All Projects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Summary metric banner */}
      <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/60 flex items-center justify-between">
        <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Total Recorded Hours</span>
        <span className="text-xl font-black text-sky-900">{totalHoursLogged.toFixed(1)} Hours Total</span>
      </div>

      {/* Daily Work Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Date</TableHead>
              <TableHead className="font-bold">Team Member</TableHead>
              <TableHead className="font-bold">Project & Task</TableHead>
              <TableHead className="font-bold">Hours</TableHead>
              <TableHead className="font-bold">Work Summary</TableHead>
              <TableHead className="font-bold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading daily work logs...</TableCell></TableRow>
            ) : workLogs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-10">No daily work logs recorded.</TableCell></TableRow>
            ) : (
              workLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="text-xs text-slate-700 font-semibold align-top">{new Date(log.date).toLocaleDateString()}</TableCell>
                  <TableCell className="align-top">
                    <div className="font-bold text-slate-900 text-xs">{log.employee_name}</div>
                    <Badge variant="outline" className="text-[10px] mt-0.5">{log.employee_role}</Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="font-semibold text-xs text-slate-800">{log.project_name || "General Work"}</div>
                    {log.task_title && (
                      <div className="text-[11px] text-sky-600 flex items-center gap-1 mt-0.5">
                        <CheckSquare className="h-3 w-3" /> {log.task_title}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 text-xs align-top">{parseFloat(log.hours_worked).toFixed(1)} hrs</TableCell>
                  <TableCell className="align-top">
                    <p className="text-xs text-slate-800 font-medium whitespace-pre-line max-w-md">{log.work_description}</p>
                    {log.remarks && (
                      <p className="text-[11px] text-slate-400 mt-1 italic">Note: {log.remarks}</p>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge className={log.status === "Completed" ? "bg-emerald-500 text-white font-bold" : "bg-sky-500 text-white"}>
                      {log.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
