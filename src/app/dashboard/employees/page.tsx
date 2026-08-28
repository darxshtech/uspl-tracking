"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess, showWarning, showToast } from "@/lib/swal";
import AttendanceCalendarView from "@/components/AttendanceCalendarView";
import { 
  Users, 
  UserPlus, 
  Calendar, 
  Edit3, 
  Trash2, 
  Power, 
  PowerOff, 
  Shield, 
  KeyRound, 
  Phone, 
  UserCheck, 
  AlertTriangle,
  Briefcase,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertCircle,
  Percent,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  TrendingUp,
  Sparkles,
  Timer,
  Check,
  Plus
} from "lucide-react";
import { getRoleDisplayName, getRoleBadgeClass, getRoleIconEmoji } from "@/lib/roleUtils";
import { formatHoursAndMinutes } from "@/lib/timeUtils";

export default function EmployeesPage() {
  const { data: session } = useSession();
  const currentRole = (session?.user as any)?.role;
  const currentUserId = (session?.user as any)?.id;
  const isSuperAdminOrCEO = currentRole === "Admin" || currentRole === "CEO";
  const isManager = ["Admin", "CEO", "PM"].includes(currentRole);

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);

  // Form state for Create
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Developer");
  const [submitting, setSubmitting] = useState(false);

  // Form state for Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("Developer");
  const [editPhone, setEditPhone] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Employee Tasks Breakdown Modal State
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tasksModalLoading, setTasksModalLoading] = useState(false);
  const [tasksBreakdownData, setTasksBreakdownData] = useState<any>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskProjectFilter, setTaskProjectFilter] = useState("all");
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (Array.isArray(data)) {
        setEmployees(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, phone, is_active: true }),
      });
      if (res.ok) {
        setCreateOpen(false);
        fetchEmployees();
        setName("");
        setEmail("");
        setPassword("");
        setPhone("");
        setRole("Developer");
        showToast("Employee created successfully!");
      } else {
        const data = await res.json();
        showError("Failed to Create Employee", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error creating employee");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (emp: any) => {
    setEditingEmp(emp);
    setEditName(emp.name || "");
    setEditEmail(emp.email || "");
    setEditRole(emp.role || "Developer");
    setEditPhone(emp.phone || "");
    setEditBio(emp.bio || "");
    setEditIsActive(emp.is_active !== 0 && emp.is_active !== false);
    setEditPassword("");
    setEditOpen(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;

    setSavingEdit(true);
    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingEmp.id,
          name: editName,
          email: editEmail,
          role: editRole,
          phone: editPhone,
          bio: editBio,
          is_active: editIsActive,
          password: editPassword.trim() || undefined,
        }),
      });

      if (res.ok) {
        setEditOpen(false);
        setEditingEmp(null);
        fetchEmployees();
        showToast("Employee updated successfully!");
      } else {
        const data = await res.json();
        showError("Failed to Update Employee", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error updating employee");
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Employee Tasks Breakdown Modal
  const openEmployeeTasksBreakdown = async (employeeId: number) => {
    setTasksModalLoading(true);
    setTasksModalOpen(true);
    setTasksBreakdownData(null);
    setTaskSearchQuery("");
    setTaskStatusFilter("all");
    setTaskProjectFilter("all");
    setExpandedTaskId(null);

    try {
      const res = await fetch(`/api/employees/tasks-breakdown?employeeId=${employeeId}`);
      const data = await res.json();
      if (res.ok) {
        setTasksBreakdownData(data);
        if (data.tasks && data.tasks.length > 0) {
          setExpandedTaskId(data.tasks[0].id);
        }
      } else {
        showError("Failed to Load Tasks Breakdown", data.error || "Unknown error");
        setTasksModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Could not load employee tasks breakdown.");
      setTasksModalOpen(false);
    } finally {
      setTasksModalLoading(false);
    }
  };

  // Quick toggle active / inactive status
  const handleToggleActive = async (emp: any) => {
    const newStatus = !emp.is_active;

    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id, is_active: newStatus }),
      });

      if (res.ok) {
        fetchEmployees();
        showToast(`Employee ${newStatus ? "activated" : "deactivated"}!`);
      } else {
        const data = await res.json();
        showError("Failed to update status", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error toggling account status");
    }
  };

  // Confirm delete employee permanently
  const confirmDeleteEmployee = async () => {
    if (!deleteConfirmEmp) return;
    if (deleteConfirmEmp.id === currentUserId) {
      showWarning("Action Prohibited", "You cannot delete your own logged-in account.");
      setDeleteConfirmEmp(null);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/employees?id=${deleteConfirmEmp.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirmEmp(null);
        fetchEmployees();
        showToast("Employee deleted successfully!");
      } else {
        const data = await res.json();
        showError("Failed to delete employee", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error deleting employee.");
    } finally {
      setDeleting(false);
    }
  };

  // Filter tasks inside breakdown modal
  const filteredBreakdownTasks = useMemo(() => {
    if (!tasksBreakdownData || !tasksBreakdownData.tasks) return [];
    return tasksBreakdownData.tasks.filter((t: any) => {
      // Status Filter
      if (taskStatusFilter !== "all") {
        if (taskStatusFilter === "Completed" && !["Completed", "Tested (PASS)", "Ready for Demo"].includes(t.status)) {
          return false;
        }
        if (taskStatusFilter === "In Progress" && !["In Progress", "Planning"].includes(t.status)) {
          return false;
        }
        if (taskStatusFilter === "QA" && !["Ready for Testing", "Testing"].includes(t.status)) {
          return false;
        }
        if (taskStatusFilter === "Changes Required" && t.status !== "Changes Required") {
          return false;
        }
      }

      // Project Filter
      if (taskProjectFilter !== "all") {
        if (taskProjectFilter === "standalone" && t.project_id !== null) {
          return false;
        }
        if (taskProjectFilter !== "standalone" && String(t.project_id) !== taskProjectFilter) {
          return false;
        }
      }

      // Search Query
      if (taskSearchQuery.trim()) {
        const query = taskSearchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(query);
        const matchDesc = (t.description || "").toLowerCase().includes(query);
        const matchProj = (t.project_name || "").toLowerCase().includes(query);
        const matchPriority = (t.priority || "").toLowerCase().includes(query);
        const matchBlocker = (t.blockers || "").toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchProj && !matchPriority && !matchBlocker) {
          return false;
        }
      }

      return true;
    });
  }, [tasksBreakdownData, taskStatusFilter, taskProjectFilter, taskSearchQuery]);

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "Critical":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "High":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "Medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Planning":
        return <Badge className="bg-purple-600 text-white font-bold whitespace-nowrap">Planning</Badge>;
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
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Users className="h-8 w-8 text-sky-500" /> Employees Directory & Team Management
          </h1>
          <p className="text-slate-500 mt-1">
            Create and edit team members, manage active/inactive status, audit employee-wise task workloads and completion ratios, and view attendance calendars.
          </p>
        </div>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold gap-2 shadow-md" />}>
            <UserPlus className="h-4 w-4" /> Add Employee
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-sky-500" /> Add New Team Member
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="font-semibold text-slate-700">Full Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-semibold text-slate-700">Email Address *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@unitglo.com" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="font-semibold text-slate-700">Phone Number</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="font-semibold text-slate-700">System Role *</Label>
                  <Select value={role} onValueChange={(val) => setRole(val || "Developer")}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {isSuperAdminOrCEO && (
                        <>
                          <SelectItem value="Admin">🏢 Company (Master Admin)</SelectItem>
                          <SelectItem value="CEO">👑 Owner (CEO)</SelectItem>
                          <SelectItem value="PM">📋 PM (Project Manager)</SelectItem>
                        </>
                      )}
                      <SelectItem value="Developer">💻 Developer</SelectItem>
                      <SelectItem value="Tester">🧪 QA Tester</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-semibold text-slate-700">Initial Password *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <Button type="submit" disabled={submitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2">
                {submitting ? "Creating..." : "Create Employee Account"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* EDIT EMPLOYEE MODAL */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-sky-500" /> Edit Employee Details
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="editName" className="font-semibold text-slate-700">Full Name *</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editEmail" className="font-semibold text-slate-700">Email Address *</Label>
              <Input id="editEmail" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editPhone" className="font-semibold text-slate-700">Phone</Label>
                <Input id="editPhone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700">System Role *</Label>
                <Select value={editRole} onValueChange={(val) => setEditRole(val || "Developer")}>
                  <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>
                    {isSuperAdminOrCEO && (
                      <>
                        <SelectItem value="Admin">🏢 Company (Master Admin)</SelectItem>
                        <SelectItem value="CEO">👑 Owner (CEO)</SelectItem>
                        <SelectItem value="PM">📋 PM (Project Manager)</SelectItem>
                      </>
                    )}
                    <SelectItem value="Developer">💻 Developer</SelectItem>
                    <SelectItem value="Tester">🧪 QA Tester</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-slate-700">Account Status</Label>
              <Select value={editIsActive ? "active" : "inactive"} onValueChange={(val) => setEditIsActive(val === "active")}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Account</SelectItem>
                  <SelectItem value="inactive">Suspended / Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Label htmlFor="editPassword" className="font-bold text-slate-800 text-xs flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5 text-sky-500" /> Reset Password (Optional)
              </Label>
              <Input
                id="editPassword"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep existing password"
                className="bg-white text-xs"
              />
            </div>

            <Button type="submit" disabled={savingEdit} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2">
              {savingEdit ? "Saving..." : "Save Employee Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Employees Directory Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
        <Table className="min-w-[950px]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Team Member</TableHead>
              <TableHead className="font-bold">Email Address</TableHead>
              <TableHead className="font-bold">Phone</TableHead>
              <TableHead className="font-bold">Role & Position</TableHead>
              <TableHead className="font-bold text-center">Task Workload & Completion</TableHead>
              <TableHead className="font-bold text-center">Account Status</TableHead>
              <TableHead className="font-bold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">Loading employees and task metrics...</TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-10">No employees found.</TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const totalTasks = emp.total_tasks || 0;
                const completedTasks = emp.completed_tasks || 0;
                const completionRatio = emp.completion_ratio || 0;
                const isDevOrTester = emp.role === "Developer" || emp.role === "Tester";

                return (
                  <TableRow key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0">
                          {emp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                          {emp.id === currentUserId && (
                            <span className="text-[10px] text-sky-600 font-semibold">(You)</span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-slate-600 text-xs font-mono">{emp.email}</TableCell>
                    <TableCell className="text-slate-600 text-xs">{emp.phone || "--"}</TableCell>

                    <TableCell>
                      <Badge className={`${getRoleBadgeClass(emp.role)} gap-1`}>
                        <span>{getRoleIconEmoji(emp.role)}</span>
                        <span>{getRoleDisplayName(emp.role)}</span>
                      </Badge>
                    </TableCell>

                    {/* Employee Task Workload Column */}
                    <TableCell className="text-center">
                      {emp.role === "CEO" || emp.role === "Admin" ? (
                        <span className="text-slate-400 text-xs font-medium">Executive Head</span>
                      ) : totalTasks > 0 ? (
                        <button
                          type="button"
                          onClick={() => openEmployeeTasksBreakdown(emp.id)}
                          className="inline-flex flex-col items-center gap-1 group/pill cursor-pointer p-1.5 rounded-xl hover:bg-sky-50 transition-colors"
                          title="Click to view detailed employee task breakdown"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-sky-100 text-sky-900 border border-sky-300 group-hover/pill:bg-sky-600 group-hover/pill:text-white transition-colors">
                              <ListTodo className="h-3 w-3" />
                              <span>{totalTasks} Tasks</span>
                            </span>
                            <span className="text-[11px] font-black text-emerald-600">
                              {completionRatio}%
                            </span>
                          </div>
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${completionRatio === 100 ? "bg-emerald-500" : "bg-sky-500"}`}
                              style={{ width: `${completionRatio}%` }}
                            />
                          </div>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEmployeeTasksBreakdown(emp.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 cursor-pointer transition-colors"
                          title="No active tasks assigned to this employee"
                        >
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          <span>0 Tasks (Idle)</span>
                        </button>
                      )}
                    </TableCell>

                    {/* Account Status */}
                    <TableCell className="text-center">
                      <button
                        onClick={() => handleToggleActive(emp)}
                        className="cursor-pointer transition-transform hover:scale-105"
                        title="Click to toggle Active / Inactive status"
                      >
                        {emp.is_active ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1 text-[11px]">
                            <Power className="h-3 w-3" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold gap-1 text-[11px]">
                            <PowerOff className="h-3 w-3" /> Inactive
                          </Badge>
                        )}
                      </button>
                    </TableCell>

                    {/* Actions Column */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Tasks Breakdown Button */}
                        {emp.role !== "CEO" && emp.role !== "Admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEmployeeTasksBreakdown(emp.id)}
                            className="text-xs font-bold gap-1 text-slate-800 hover:text-sky-600 hover:bg-sky-50 bg-white h-8 px-2.5 shadow-2xs border-slate-300"
                            title="View Employee Tasks Breakdown"
                          >
                            <ListTodo className="h-3.5 w-3.5 text-sky-500" />
                            <span>Tasks</span>
                          </Button>
                        )}

                        {/* Calendar Button */}
                        {emp.role !== "CEO" && emp.role !== "Admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingEmployee(emp)}
                            className="text-xs font-semibold gap-1 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 bg-white h-8 px-2 shadow-2xs border-slate-300"
                            title="View Attendance Calendar"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* Edit Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(emp)}
                          className="text-xs font-semibold text-slate-700 hover:text-sky-600 hover:bg-slate-100 p-1.5 h-8 w-8"
                          title="Edit Employee"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>

                        {/* Delete Employee Button */}
                        {isSuperAdminOrCEO && emp.id !== currentUserId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirmEmp(emp)}
                            className="text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 h-8 w-8"
                            title="Delete Employee Permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ========================================================================= */}
      {/* EMPLOYEE-WISE TASKS BREAKDOWN & WORKLOAD MODAL (FOR PM, CEO, AND ADMIN)   */}
      {/* ========================================================================= */}
      <Dialog open={tasksModalOpen} onOpenChange={setTasksModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border-slate-200 shadow-2xl">
          {tasksModalLoading ? (
            <div className="p-16 text-center space-y-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
              <p className="text-sm font-semibold text-slate-600">Loading employee task breakdown & deliverables...</p>
            </div>
          ) : tasksBreakdownData ? (
            <div className="space-y-6">
              {/* Top Banner Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 text-white rounded-t-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white font-black text-xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-white/10">
                      {tasksBreakdownData.employee.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
                          Employee Workload Matrix
                        </span>
                        <Badge className={`${getRoleBadgeClass(tasksBreakdownData.employee.role)} text-[10px] px-2 py-0`}>
                          {tasksBreakdownData.employee.role}
                        </Badge>
                      </div>
                      <h2 className="text-2xl font-black tracking-tight mt-1">{tasksBreakdownData.employee.name}</h2>
                      <p className="text-xs text-slate-300 mt-0.5 font-mono">{tasksBreakdownData.employee.email}</p>
                    </div>
                  </div>

                  {/* Completion Ratio Pill */}
                  <div className="flex items-center gap-3 self-start sm:self-center bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">Overall Pass Ratio</div>
                      <div className="text-2xl font-black text-emerald-400">
                        {tasksBreakdownData.metrics.overallCompletionRatio}%
                      </div>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                      <Percent className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                      <ListTodo className="h-3 w-3 text-indigo-400" /> Total Tasks
                    </div>
                    <div className="text-lg font-bold text-white mt-0.5">{tasksBreakdownData.metrics.totalTasks}</div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-emerald-300 font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Completed
                    </div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">{tasksBreakdownData.metrics.completedTasks}</div>
                  </div>

                  <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-sky-300 font-medium flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3 text-sky-400" /> In Progress
                    </div>
                    <div className="text-lg font-bold text-sky-400 mt-0.5">{tasksBreakdownData.metrics.inProgressTasks}</div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-amber-300 font-medium flex items-center justify-center gap-1">
                      <AlertCircle className="h-3 w-3 text-amber-400" /> In QA / Review
                    </div>
                    <div className="text-lg font-bold text-amber-400 mt-0.5">{tasksBreakdownData.metrics.readyForTestingTasks}</div>
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-2.5 text-center col-span-2 sm:col-span-1">
                    <div className="text-[11px] text-purple-300 font-medium flex items-center justify-center gap-1">
                      <Timer className="h-3 w-3 text-purple-400" /> Logged Hours
                    </div>
                    <div className="text-lg font-bold text-purple-300 mt-0.5">{formatHoursAndMinutes(tasksBreakdownData.metrics.totalHours)}</div>
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="px-6 space-y-4 pb-6">
                {/* Project Breakdown Distribution Chips */}
                {tasksBreakdownData.projectBreakdown && tasksBreakdownData.projectBreakdown.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-sky-500" />
                      Assigned Project Workloads:
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTaskProjectFilter("all")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                          taskProjectFilter === "all"
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        All Projects ({tasksBreakdownData.metrics.totalTasks})
                      </button>

                      {tasksBreakdownData.projectBreakdown.map((p: any) => {
                        const isSelected = taskProjectFilter === (p.id ? String(p.id) : "standalone");
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => setTaskProjectFilter(p.id ? String(p.id) : "standalone")}
                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <span>{p.name}</span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                              isSelected ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"
                            }`}>
                              {p.total} ({p.completionRatio}%)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search tasks by title, description, priority, or blocker..."
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                    />
                  </div>

                  {/* Status Tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {[
                      { id: "all", label: "All" },
                      { id: "In Progress", label: "In Progress" },
                      { id: "QA", label: "QA" },
                      { id: "Completed", label: "Completed" },
                      { id: "Changes Required", label: "Changes Required" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTaskStatusFilter(tab.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                          taskStatusFilter === tab.id
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tasks List */}
                <div className="space-y-3">
                  {filteredBreakdownTasks.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <ListTodo className="h-9 w-9 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">No tasks found matching filter.</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Try resetting your project or status filters.
                      </p>
                    </div>
                  ) : (
                    filteredBreakdownTasks.map((t: any) => {
                      const isExpanded = expandedTaskId === t.id;
                      const priorityClass = getPriorityBadgeClass(t.priority);

                      return (
                        <div
                          key={t.id}
                          className="rounded-2xl border border-slate-200 bg-white hover:border-sky-300 transition-all shadow-xs overflow-hidden"
                        >
                          {/* Task Summary Row Header */}
                          <div
                            onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
                            className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="p-2 rounded-xl bg-slate-100 text-slate-700 mt-0.5 shrink-0">
                                <ListTodo className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-slate-400">#{t.id}</span>
                                  <h4 className="font-bold text-slate-900 text-sm leading-snug break-words">
                                    {t.title}
                                  </h4>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                                    <Briefcase className="h-3 w-3" />
                                    {t.project_name}
                                  </span>

                                  <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.2 ${priorityClass}`}>
                                    {t.priority} Priority
                                  </Badge>

                                  {t.hours_spent > 0 && (
                                    <span className="text-[11px] font-mono font-semibold text-slate-500">
                                      ⏱️ {formatHoursAndMinutes(t.hours_spent)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status and Progress Bar */}
                            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                              <div className="text-right">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-full ${t.progress_percentage === 100 ? "bg-emerald-500" : "bg-sky-500"}`}
                                      style={{ width: `${t.progress_percentage || 0}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-slate-700">{t.progress_percentage || 0}%</span>
                                </div>
                              </div>

                              <div className="shrink-0">{getStatusBadge(t.status)}</div>

                              <div className="text-slate-400 p-1">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Task Full Details */}
                          {isExpanded && (
                            <div className="p-4 pt-0 border-t border-slate-100 bg-slate-50/40 space-y-3 animate-fade-in">
                              {/* Full Description (No truncation) */}
                              {t.description && (
                                <div className="space-y-1 pt-3">
                                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Description & Requirements:
                                  </div>
                                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                                    {t.description}
                                  </div>
                                </div>
                              )}

                              {/* Blockers Alert */}
                              {t.blockers && (
                                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                  <div>
                                    <strong className="block">Current Task Blocker:</strong>
                                    <span>{t.blockers}</span>
                                  </div>
                                </div>
                              )}

                              {/* Daily Summary */}
                              {t.daily_summary && (
                                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900">
                                  <strong>Latest Progress Summary:</strong> {t.daily_summary}
                                </div>
                              )}

                              {/* Task Links */}
                              {t.task_links && t.task_links.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-slate-500 uppercase">Attached Resources:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {t.task_links.map((link: any, lIdx: number) => (
                                      <a
                                        key={lIdx}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-sky-700 hover:bg-sky-50 font-semibold shadow-2xs"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        <span>{link.title || "External Link"}</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Metadata Footer */}
                              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 pt-2 border-t border-slate-200/80">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span>Created by: <strong>{t.creator_name}</strong> ({t.creator_role || "PM"})</span>
                                  {t.due_date && (
                                    <span>Due Date: <strong>{new Date(t.due_date).toLocaleDateString()}</strong></span>
                                  )}
                                  {t.co_assignees && t.co_assignees.length > 0 && (
                                    <span>Co-Assignees: <strong>{t.co_assignees.map((c: any) => c.name).join(", ")}</strong></span>
                                  )}
                                </div>

                                <Link href={`/dashboard/tasks`}>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-sky-600 hover:bg-sky-50 gap-1 font-bold">
                                    Open in Daily Tasks Hub <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Employee Confirmation Dialog */}
      <Dialog open={!!deleteConfirmEmp} onOpenChange={(open) => !open && setDeleteConfirmEmp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-red-600">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Confirm Permanent Deletion
            </DialogTitle>
          </DialogHeader>
          {deleteConfirmEmp && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-600">
                Are you sure you want to permanently delete{" "}
                <span className="font-bold text-slate-900">{deleteConfirmEmp.name}</span> ({deleteConfirmEmp.email})?
              </p>
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                ⚠️ This will remove their project memberships, attendance records, and unassign their tasks. This action cannot be undone.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmEmp(null)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  onClick={confirmDeleteEmployee}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Month-Wise Calendar Modal */}
      <Dialog open={!!viewingEmployee} onOpenChange={(open) => !open && setViewingEmployee(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Calendar className="h-5 w-5 text-sky-500" /> Employee Month-Wise Attendance Calendar
            </DialogTitle>
          </DialogHeader>

          {viewingEmployee && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-black text-slate-900">{viewingEmployee.name}</h4>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{viewingEmployee.email}</span> • <Badge variant="outline" className="text-[10px]">{viewingEmployee.role}</Badge>
                  </div>
                </div>
              </div>

              {/* Interactive Calendar for this Employee */}
              <AttendanceCalendarView
                initialEmployeeId={viewingEmployee.id.toString()}
                canAddHoliday={true}
                hideEmployeeSelect={true}
                employees={employees}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
