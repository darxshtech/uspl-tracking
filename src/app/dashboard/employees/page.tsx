"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
  AlertTriangle 
} from "lucide-react";

export default function EmployeesPage() {
  const { data: session } = useSession();
  const currentRole = (session?.user as any)?.role;
  const currentUserId = (session?.user as any)?.id;
  const isSuperAdminOrCEO = currentRole === "Admin" || currentRole === "CEO";

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
      } else {
        const data = await res.json();
        alert(`Failed to create employee: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error creating employee");
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
      } else {
        const data = await res.json();
        alert(`Failed to update employee: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error updating employee");
    } finally {
      setSavingEdit(false);
    }
  };

  // Quick toggle active / inactive status
  const handleToggleActive = async (emp: any) => {
    const newStatus = !emp.is_active;
    const confirmMsg = newStatus 
      ? `Are you sure you want to activate ${emp.name}'s account?`
      : `Are you sure you want to deactivate ${emp.name}? They will not be able to log in.`;
    
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id, is_active: newStatus }),
      });

      if (res.ok) {
        fetchEmployees();
      } else {
        const data = await res.json();
        alert(`Failed to update status: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error toggling account status");
    }
  };

  // Delete employee permanently
  const handleDeleteEmployee = async (emp: any) => {
    if (emp.id === currentUserId) {
      alert("You cannot delete your own logged-in account.");
      return;
    }

    const confirmMsg = `WARNING: Are you sure you want to PERMANENTLY delete ${emp.name} (${emp.email})?\n\nThis will remove their project memberships, attendance records, and unassign their tasks. This action cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/employees?id=${emp.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchEmployees();
      } else {
        const data = await res.json();
        alert(`Failed to delete employee: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting employee.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Users className="h-8 w-8 text-sky-500" /> Employees Directory & Team Management
          </h1>
          <p className="text-slate-500 mt-1">
            Create and edit team members, manage active/inactive status, assign executive roles (CEO, PM), reset credentials, and delete accounts.
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
                          <SelectItem value="Admin">Admin (Master)</SelectItem>
                          <SelectItem value="CEO">CEO (Executive)</SelectItem>
                          <SelectItem value="PM">PM (Project Manager)</SelectItem>
                        </>
                      )}
                      <SelectItem value="Developer">Developer</SelectItem>
                      <SelectItem value="Tester">QA Tester</SelectItem>
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
                        <SelectItem value="Admin">Admin (Master)</SelectItem>
                        <SelectItem value="CEO">CEO (Executive)</SelectItem>
                        <SelectItem value="PM">PM (Project Manager)</SelectItem>
                      </>
                    )}
                    <SelectItem value="Developer">Developer</SelectItem>
                    <SelectItem value="Tester">QA Tester</SelectItem>
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

      {/* Employees Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Team Member</TableHead>
              <TableHead className="font-bold">Email Address</TableHead>
              <TableHead className="font-bold">Phone</TableHead>
              <TableHead className="font-bold">Role</TableHead>
              <TableHead className="font-bold">Account Status</TableHead>
              <TableHead className="font-bold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Loading employees...</TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-10">No employees found.</TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
                <TableRow key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-bold text-slate-900">{emp.name}</TableCell>
                  <TableCell className="text-slate-600 text-xs font-mono">{emp.email}</TableCell>
                  <TableCell className="text-slate-600 text-xs">{emp.phone || "--"}</TableCell>
                  <TableCell>
                    <Badge className={
                      emp.role === "Admin" ? "bg-red-600 text-white font-bold" :
                      emp.role === "CEO" ? "bg-purple-600 text-white font-bold" :
                      emp.role === "PM" ? "bg-emerald-600 text-white font-bold" :
                      emp.role === "Tester" ? "bg-amber-600 text-white font-bold" :
                      "bg-sky-600 text-white font-bold"
                    }>
                      {emp.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActive(emp)}
                      className="cursor-pointer transition-transform hover:scale-105"
                      title="Click to toggle Active / Inactive status"
                    >
                      {emp.is_active ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1">
                          <Power className="h-3 w-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold gap-1">
                          <PowerOff className="h-3 w-3" /> Inactive
                        </Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(emp)}
                        className="text-xs font-semibold text-slate-700 hover:text-sky-600 hover:bg-slate-100 p-1.5 h-8 w-8"
                        title="Edit Employee"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>

                      {emp.role !== "CEO" && emp.role !== "Admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingEmployee(emp)}
                          className="text-xs font-semibold gap-1 text-sky-600 hover:bg-sky-50 bg-white h-8 px-2"
                          title="View Attendance Calendar"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Delete Employee Button (Admin & CEO can delete) */}
                      {isSuperAdminOrCEO && emp.id !== currentUserId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteEmployee(emp)}
                          className="text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 h-8 w-8"
                          title="Delete Employee Permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
