"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, CheckCircle2, Briefcase, Clock, ShieldCheck, User } from "lucide-react";

export default function CEOFilterDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedAssignee, setSelectedAssignee] = useState("ALL");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tRes, pRes, eRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/projects"),
        fetch("/api/employees"),
      ]);

      const [tData, pData, eData] = await Promise.all([
        tRes.json(),
        pRes.json(),
        eRes.json(),
      ]);

      if (Array.isArray(tData)) setTasks(tData);
      if (Array.isArray(pData)) setProjects(pData);
      if (Array.isArray(eData)) setEmployees(eData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks based on selections
  const filteredTasks = tasks.filter((t) => {
    const matchProject = selectedProject === "ALL" || t.project_id?.toString() === selectedProject;
    const matchStatus = selectedStatus === "ALL" || t.status === selectedStatus;
    const matchAssignee = selectedAssignee === "ALL" || t.assigned_to?.toString() === selectedAssignee;
    return matchProject && matchStatus && matchAssignee;
  });

  const completedCount = filteredTasks.filter((t) => t.status === "Completed").length;
  const inProgressCount = filteredTasks.filter((t) => t.status === "In Progress" || t.status === "Assigned").length;
  const readyForTestingCount = filteredTasks.filter((t) => t.status === "Ready for Testing").length;
  const changesRequiredCount = filteredTasks.filter((t) => t.status === "Changes Required").length;
  const completionRate = filteredTasks.length > 0 ? Math.round((completedCount / filteredTasks.length) * 100) : 0;

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
    <div className="space-y-6 animate-fade-in">
      {/* Filter Control Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Filter className="h-5 w-5 text-sky-500" />
            CEO & PM Executive Project & Task Filter
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Project Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-sky-500" /> Filter by Project
            </label>
            <Select value={selectedProject} onValueChange={(val) => setSelectedProject(val || "ALL")}>
              <SelectTrigger className="w-full bg-slate-50">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Projects ({projects.length})</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task Status Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Filter by Status
            </label>
            <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val || "ALL")}>
              <SelectTrigger className="w-full bg-slate-50">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Task Statuses</SelectItem>
                <SelectItem value="Planning">Planning</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Ready for Testing">Ready for Testing</SelectItem>
                <SelectItem value="Tested (PASS)">QA Passed</SelectItem>
                <SelectItem value="Ready for Demo">Ready for Demo</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Changes Required">Changes Required (Failed)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assignee / Employee Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-500" /> Filter by Team Member
            </label>
            <Select value={selectedAssignee} onValueChange={(val) => setSelectedAssignee(val || "ALL")}>
              <SelectTrigger className="w-full bg-slate-50">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Team Members</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Dynamic Filtered Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Completed Tasks</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{completedCount}</div>
          <span className="text-[11px] text-emerald-600 font-semibold">{completionRate}% Completion Rate</span>
        </div>

        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50">
          <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">In Progress</span>
          <div className="text-2xl font-black text-sky-900 mt-1">{inProgressCount}</div>
          <span className="text-[11px] text-sky-600 font-semibold">Active Development</span>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Testing Queue</span>
          <div className="text-2xl font-black text-amber-900 mt-1">{readyForTestingCount}</div>
          <span className="text-[11px] text-amber-600 font-semibold">Awaiting QA Audit</span>
        </div>

        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50">
          <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Changes Required</span>
          <div className="text-2xl font-black text-red-900 mt-1">{changesRequiredCount}</div>
          <span className="text-[11px] text-red-600 font-semibold">QA Rejections</span>
        </div>
      </div>

      {/* Filtered Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Task Title</TableHead>
              <TableHead className="font-bold">Project</TableHead>
              <TableHead className="font-bold">Assigned To</TableHead>
              <TableHead className="font-bold">Priority</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold">Created By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6">Loading tasks...</TableCell></TableRow>
            ) : filteredTasks.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No tasks match the selected filters.</TableCell></TableRow>
            ) : (
              filteredTasks.map((t) => (
                <TableRow key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-bold text-slate-900">{t.title}</TableCell>
                  <TableCell className="text-slate-600">{t.project_name || "N/A"}</TableCell>
                  <TableCell className="text-slate-600">{t.assignee_name || "Unassigned"}</TableCell>
                  <TableCell><Badge variant="outline">{t.priority}</Badge></TableCell>
                  <TableCell>{getStatusBadge(t.status)}</TableCell>
                  <TableCell className="text-slate-500 text-xs">{t.creator_name || "System"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
