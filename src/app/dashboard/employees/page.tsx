"use client";

import { useState, useEffect } from "react";
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
import { Users, UserPlus, Calendar, Eye, Mail, Shield } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Developer");

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
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, is_active: true }),
      });
      if (res.ok) {
        setOpen(false);
        fetchEmployees();
        setName("");
        setEmail("");
        setPassword("");
      } else {
        alert("Failed to create employee");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Users className="h-8 w-8 text-sky-500" /> Employees Directory
          </h1>
          <p className="text-slate-500 mt-1">Manage team members, roles, and view day-by-day monthly attendance calendars.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
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
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-semibold text-slate-700">Email Address *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-semibold text-slate-700">Initial Password *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role" className="font-semibold text-slate-700">Role</Label>
                <Select value={role} onValueChange={(val) => setRole(val || "Developer")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CEO">CEO (Executive)</SelectItem>
                    <SelectItem value="PM">PM (Project Manager)</SelectItem>
                    <SelectItem value="Developer">Developer</SelectItem>
                    <SelectItem value="Tester">QA Tester</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2">
                Create Employee Account
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Team Member</TableHead>
              <TableHead className="font-bold">Email Address</TableHead>
              <TableHead className="font-bold">Role</TableHead>
              <TableHead className="font-bold">Account Status</TableHead>
              <TableHead className="font-bold text-right">Attendance Calendar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Loading employees...</TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-10">No employees found.</TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
                <TableRow key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-bold text-slate-900">{emp.name}</TableCell>
                  <TableCell className="text-slate-600 text-xs font-mono">{emp.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-semibold">{emp.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {emp.is_active ? (
                      <Badge className="bg-emerald-500 text-white font-bold">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {emp.role !== "CEO" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingEmployee(emp)}
                        className="text-xs font-semibold gap-1.5 text-sky-600 hover:bg-sky-50 bg-white"
                      >
                        <Calendar className="h-3.5 w-3.5" /> View Calendar
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium italic">CEO Exempt</span>
                    )}
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
