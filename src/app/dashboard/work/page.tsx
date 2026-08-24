"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock, 
  Briefcase, 
  CheckSquare, 
  Calendar, 
  User, 
  FileText, 
  CheckCircle2, 
  Filter 
} from "lucide-react";
import { formatHoursAndMinutes } from "@/lib/timeUtils";

export default function DailyWorkPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isManager = role === "CEO" || role === "PM";

  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for managers
  const [filterEmployee, setFilterEmployee] = useState("ALL");
  const [filterProject, setFilterProject] = useState("ALL");

  useEffect(() => {
    fetchWorkLogs();
    fetchProjects();
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

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err) {
      console.error(err);
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
            Work Accomplishments & Audit Log
          </h1>
          <p className="text-slate-500 mt-1">
            {isManager
              ? "Review company-wide daily work logs, task deliverables, and developer hours."
              : "Audit history of daily work logged through Daily Tasks."}
          </p>
        </div>
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
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading work records...</TableCell></TableRow>
            ) : workLogs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-10">No work logs recorded.</TableCell></TableRow>
            ) : (
              workLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="text-xs text-slate-700 font-semibold align-top">{new Date(log.date).toLocaleDateString()}</TableCell>
                  <TableCell className="align-top">
                    <div className="font-bold text-slate-900 text-xs">{log.employee_name}</div>
                    <Badge variant="outline" className="text-[10px] mt-0.5">{log.employee_role}</Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="font-semibold text-xs text-slate-800 break-words [overflow-wrap:anywhere]">{log.project_name || "General Work"}</div>
                    {log.task_title && (
                      <div className="text-[11px] text-sky-600 flex items-center gap-1 mt-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0">
                        <CheckSquare className="h-3 w-3 shrink-0" /> <span className="break-words [overflow-wrap:anywhere]">{log.task_title}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 text-xs align-top">{formatHoursAndMinutes(log.hours_worked)}</TableCell>
                  <TableCell className="align-top max-w-md min-w-[200px]">
                    <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 max-w-full leading-relaxed">{log.work_description}</p>
                    {log.remarks && (
                      <p className="text-[11px] text-slate-500 mt-1.5 italic whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 max-w-full bg-slate-50 p-2 rounded-lg border border-slate-100">Note: {log.remarks}</p>
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
