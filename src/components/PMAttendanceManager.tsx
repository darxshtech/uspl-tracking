"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileSpreadsheet, 
  FileText, 
  Mail, 
  Edit3, 
  CheckCircle, 
  Clock, 
  Calendar, 
  Users, 
  Filter, 
  Send,
  Eye,
  Plus,
  Palmtree,
  Sparkles,
  UserCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function PMAttendanceManager({ employees }: { employees: any[] }) {
  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, "0");
  const currentYearStr = new Date().getFullYear().toString();

  const [selectedEmployee, setSelectedEmployee] = useState("ALL");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailing, setEmailing] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editLoginTime, setEditLoginTime] = useState("");
  const [editLogoutTime, setEditLogoutTime] = useState("");
  const [editStatus, setEditStatus] = useState("Present");
  const [editHours, setEditHours] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // View Details Modal State
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);

  // Record Leave Modal State
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveEmpId, setLeaveEmpId] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveType, setLeaveType] = useState("Leave");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [selectedEmployee, selectedMonth, selectedYear]);

  const fetchRecords = async () => {
    setLoading(true);
    setFeedback("");
    try {
      const query = new URLSearchParams({
        employee_id: selectedEmployee,
        month: selectedMonth,
        year: selectedYear,
      });
      const res = await fetch(`/api/attendance/manage?${query.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (rec: any) => {
    setEditingRecord(rec);
    setEditLoginTime(rec.login_time || "09:30:00 AM");
    setEditLogoutTime(rec.logout_time || "06:30:00 PM");
    setEditStatus(rec.status || "Present");
    setEditHours(rec.total_hours !== null && rec.total_hours !== undefined ? rec.total_hours.toString() : "9.00");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    setSavingEdit(true);
    try {
      const res = await fetch("/api/attendance/manage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingRecord.id,
          login_time: editLoginTime,
          logout_time: editLogoutTime,
          status: editStatus,
          total_hours: editHours ? parseFloat(editHours) : null,
        }),
      });

      if (res.ok) {
        setEditingRecord(null);
        fetchRecords();
        setFeedback("Attendance record updated successfully!");
      } else {
        alert("Failed to update record.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRecordLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveEmpId || !leaveStartDate) return;

    setSubmittingLeave(true);
    try {
      const res = await fetch("/api/attendance/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(leaveEmpId),
          start_date: leaveStartDate,
          end_date: leaveEndDate || leaveStartDate,
          status: leaveType,
          reason: leaveReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLeaveModalOpen(false);
        setLeaveReason("");
        fetchRecords();
        setFeedback(`✓ ${data.message}`);
      } else {
        alert(`Failed to record leave: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error recording leave.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Metrics summary
  const totalDays = records.length;
  const totalHours = records.reduce((acc, r) => acc + (parseFloat(r.total_hours) || 0), 0);
  const presentDays = records.filter((r) => r.status === "Present").length;
  const halfDays = records.filter((r) => r.status === "Half Day").length;
  const leaveDays = records.filter((r) => r.status === "Leave").length;
  const avgHours = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : "0";

  const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || "Month";
  const selectedEmpObj = employees.find((e) => e.id.toString() === selectedEmployee);

  // 1. Export Excel (.xlsx)
  const handleExportExcel = () => {
    if (records.length === 0) {
      alert("No attendance records to export.");
      return;
    }

    const excelData = records.map((r, i) => ({
      "#": i + 1,
      "Employee Name": r.employee_name,
      "Employee Role": r.employee_role,
      "Date": new Date(r.date).toLocaleDateString(),
      "Check-In (IST)": r.login_time || "N/A",
      "Check-Out (IST)": r.logout_time || "N/A",
      "Total Hours": parseFloat(r.total_hours || 0).toFixed(2),
      "Shift Status": r.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Attendance");

    const filename = `Attendance_${selectedEmpObj ? selectedEmpObj.name.replace(/\s+/g, "_") : "All_Employees"}_${monthLabel}_${selectedYear}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // 2. Export PDF
  const handleExportPDF = () => {
    if (records.length === 0) {
      alert("No attendance records to export.");
      return;
    }

    const doc = new jsPDF();
    const titleText = `Unitglo Solutions - Attendance Report: ${monthLabel} ${selectedYear}`;
    const empText = selectedEmpObj ? `Employee: ${selectedEmpObj.name} (${selectedEmpObj.role} - ${selectedEmpObj.email})` : "All Non-Executive Employees";

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(titleText, 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(empText, 14, 25);
    doc.text(`Total Days: ${totalDays} | Total Working Hours: ${totalHours.toFixed(1)} hrs | Present: ${presentDays} | Half Days: ${halfDays} | Leaves: ${leaveDays}`, 14, 31);

    const tableHeaders = [["#", "Employee", "Date", "Login (IST)", "Logout (IST)", "Hours", "Status"]];
    const tableBody = records.map((r, i) => [
      i + 1,
      r.employee_name,
      new Date(r.date).toLocaleDateString(),
      r.login_time || "--:--",
      r.logout_time || "--:--",
      `${r.total_hours || 0} hrs`,
      r.status,
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableBody,
      startY: 36,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    });

    const filename = `Attendance_${selectedEmpObj ? selectedEmpObj.name.replace(/\s+/g, "_") : "All"}_${monthLabel}_${selectedYear}.pdf`;
    doc.save(filename);
  };

  // 3. Email report to Employee from PM Mail
  const handleSendEmail = async () => {
    if (selectedEmployee === "ALL" || !selectedEmpObj) {
      alert("Please select a specific employee from the filter dropdown before sending the email report.");
      return;
    }

    if (records.length === 0) {
      alert("No records found for this employee in the selected month.");
      return;
    }

    setEmailing(true);
    setFeedback("");
    try {
      const res = await fetch("/api/attendance/export-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmpObj.id,
          employee_email: selectedEmpObj.email,
          employee_name: selectedEmpObj.name,
          month_name: monthLabel,
          year: selectedYear,
          records,
          summary: {
            totalDays,
            totalHours: totalHours.toFixed(1),
            presentDays,
            halfDays,
            leaveDays,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback(`✓ ${data.message}`);
      } else {
        alert(`Failed to send email: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while sending email.");
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Header & Export Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Filter className="h-5 w-5 text-sky-500" />
            PM Executive Attendance Management & Dispatch
          </h3>

          {/* Action Export & Leave Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Record Leave Modal Trigger */}
            <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
              <DialogTrigger render={<Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-xs" />}>
                <Palmtree className="h-3.5 w-3.5" /> Record Leave
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Palmtree className="h-5 w-5 text-amber-500" /> Record Employee Leave
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleRecordLeave} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Select Employee *</Label>
                    <Select value={leaveEmpId} onValueChange={(val) => setLeaveEmpId(val || "")}>
                      <SelectTrigger><SelectValue placeholder="Choose Employee" /></SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => e.role !== "CEO")
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="lStart" className="font-semibold text-slate-700">Start Date *</Label>
                      <Input
                        id="lStart"
                        type="date"
                        value={leaveStartDate}
                        onChange={(e) => setLeaveStartDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="lEnd" className="font-semibold text-slate-700">End Date</Label>
                      <Input
                        id="lEnd"
                        type="date"
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Leave Type</Label>
                    <Select value={leaveType} onValueChange={(val) => setLeaveType(val || "Leave")}>
                      <SelectTrigger><SelectValue placeholder="Leave Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Leave">Casual Leave</SelectItem>
                        <SelectItem value="Leave">Sick Leave</SelectItem>
                        <SelectItem value="Leave">Paid Vacation Leave</SelectItem>
                        <SelectItem value="Absent">Unapproved Absence</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lReason" className="font-semibold text-slate-700">Reason / Notes</Label>
                    <Input
                      id="lReason"
                      placeholder="e.g. Medical emergency, family function"
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submittingLeave || !leaveEmpId}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 mt-2"
                  >
                    {submittingLeave ? "Logging Leave..." : "Confirm & Record Leave"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
            </Button>

            <Button
              size="sm"
              onClick={handleExportPDF}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5 shadow-xs"
            >
              <FileText className="h-3.5 w-3.5" /> Export PDF
            </Button>

            <Button
              size="sm"
              disabled={emailing || selectedEmployee === "ALL"}
              onClick={handleSendEmail}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-xs disabled:opacity-50"
              title={selectedEmployee === "ALL" ? "Select a single employee to send email" : "Email monthly report to employee"}
            >
              <Mail className="h-3.5 w-3.5" /> {emailing ? "Sending..." : "Email to Employee"}
            </Button>
          </div>
        </div>

        {/* Filter Select Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Employee Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-sky-500" /> Select Employee
            </Label>
            <Select value={selectedEmployee} onValueChange={(val) => setSelectedEmployee(val || "ALL")}>
              <SelectTrigger><SelectValue placeholder="All Employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Employees</SelectItem>
                {employees
                  .filter((e) => e.role !== "CEO")
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-500" /> Select Month
            </Label>
            <Select value={selectedMonth} onValueChange={(val) => setSelectedMonth(val || "01")}>
              <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-500" /> Select Year
            </Label>
            <Select value={selectedYear} onValueChange={(val) => setSelectedYear(val || "2026")}>
              <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" /> {feedback}
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Days Logged</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalDays}</div>
          <span className="text-[11px] text-slate-400 font-medium">In {monthLabel} {selectedYear}</span>
        </div>

        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/60">
          <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">Total Working Hours</span>
          <div className="text-2xl font-black text-sky-900 mt-1">{totalHours.toFixed(1)} hrs</div>
          <span className="text-[11px] text-sky-600 font-semibold">{avgHours} hrs/day average</span>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Present Days</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{presentDays}</div>
          <span className="text-[11px] text-emerald-600 font-semibold">&ge; 9 Hours Completed</span>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Leaves / Half Days</span>
          <div className="text-2xl font-black text-amber-900 mt-1">{leaveDays + halfDays}</div>
          <span className="text-[11px] text-amber-600 font-semibold">{leaveDays} Leaves | {halfDays} Half Days</span>
        </div>
      </div>

      {/* Detailed Employee Timesheet View Modal */}
      <Dialog open={!!viewingEmployee} onOpenChange={(open) => !open && setViewingEmployee(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Eye className="h-5 w-5 text-sky-500" /> Employee Attendance Breakdown
            </DialogTitle>
          </DialogHeader>

          {viewingEmployee && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{viewingEmployee.employee_name}</h4>
                  <div className="text-xs text-slate-500">{viewingEmployee.employee_email} • <Badge variant="outline" className="text-[10px]">{viewingEmployee.employee_role}</Badge></div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-500 uppercase">{monthLabel} {selectedYear}</div>
                  <div className="text-base font-black text-sky-600">{records.filter(r => r.user_id === viewingEmployee.user_id).reduce((a, c) => a + (parseFloat(c.total_hours) || 0), 0).toFixed(1)} Total Hrs</div>
                </div>
              </div>

              {/* Itemized Day Records for this Employee */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold text-xs">Date</TableHead>
                      <TableHead className="font-bold text-xs">Check-In</TableHead>
                      <TableHead className="font-bold text-xs">Check-Out</TableHead>
                      <TableHead className="font-bold text-xs">Hours</TableHead>
                      <TableHead className="font-bold text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.filter(r => r.user_id === viewingEmployee.user_id).map((rec) => (
                      <TableRow key={rec.id} className="hover:bg-slate-50">
                        <TableCell className="text-xs font-semibold">{new Date(rec.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs font-mono">{rec.login_time || "--:--"}</TableCell>
                        <TableCell className="text-xs font-mono">{rec.logout_time || "--:--"}</TableCell>
                        <TableCell className="text-xs font-bold">{parseFloat(rec.total_hours || 0).toFixed(2)}h</TableCell>
                        <TableCell>
                          <Badge className={
                            rec.status === "Present" ? "bg-emerald-500 text-white text-[10px]" :
                            rec.status === "Half Day" ? "bg-amber-500 text-white text-[10px]" :
                            rec.status === "Leave" ? "bg-sky-500 text-white text-[10px]" : "bg-red-500 text-white text-[10px]"
                          }>
                            {rec.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Record Modal */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Edit3 className="h-5 w-5 text-sky-500" /> Edit Attendance Record
            </DialogTitle>
          </DialogHeader>

          {editingRecord && (
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
                <div>Employee: <strong className="text-slate-900">{editingRecord.employee_name}</strong> ({editingRecord.employee_role})</div>
                <div className="mt-0.5">Date: <strong className="text-slate-900">{new Date(editingRecord.date).toLocaleDateString()}</strong></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="editLogin" className="font-semibold text-slate-700">Check-In Time (IST)</Label>
                  <Input
                    id="editLogin"
                    value={editLoginTime}
                    onChange={(e) => setEditLoginTime(e.target.value)}
                    placeholder="09:30:00 AM"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editLogout" className="font-semibold text-slate-700">Check-Out Time (IST)</Label>
                  <Input
                    id="editLogout"
                    value={editLogoutTime}
                    onChange={(e) => setEditLogoutTime(e.target.value)}
                    placeholder="06:30:00 PM"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700">Shift Status</Label>
                  <Select value={editStatus} onValueChange={(val) => setEditStatus(val || "Present")}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Present">Present</SelectItem>
                      <SelectItem value="Half Day">Half Day</SelectItem>
                      <SelectItem value="Leave">Leave</SelectItem>
                      <SelectItem value="Absent">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editHours" className="font-semibold text-slate-700">Total Hours (Decimal)</Label>
                  <Input
                    id="editHours"
                    type="number"
                    step="0.1"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    placeholder="e.g. 9.0"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={savingEdit}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2"
              >
                {savingEdit ? "Updating..." : "Save Attendance Overrides"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Attendance Grid Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Employee</TableHead>
              <TableHead className="font-bold">Role</TableHead>
              <TableHead className="font-bold">Date</TableHead>
              <TableHead className="font-bold">Check-In (IST)</TableHead>
              <TableHead className="font-bold">Check-Out (IST)</TableHead>
              <TableHead className="font-bold">Total Shift</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8">Loading attendance logs...</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-10">No attendance logs matching selected criteria.</TableCell></TableRow>
            ) : (
              records.map((rec) => (
                <TableRow key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-bold text-slate-900 text-sm">{rec.employee_name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{rec.employee_role}</Badge></TableCell>
                  <TableCell className="text-xs text-slate-700 font-medium">{new Date(rec.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-800 font-semibold">{rec.login_time || "--:--"}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-800 font-semibold">{rec.logout_time || "--:--"}</TableCell>
                  <TableCell className="font-bold text-xs text-slate-900">{parseFloat(rec.total_hours || 0).toFixed(2)} hrs</TableCell>
                  <TableCell>
                    {rec.status === "Present" && <Badge className="bg-emerald-500 text-white font-bold">Present</Badge>}
                    {rec.status === "Half Day" && <Badge className="bg-amber-500 text-white font-bold">Half Day</Badge>}
                    {rec.status === "Leave" && <Badge className="bg-sky-500 text-white font-bold">Leave</Badge>}
                    {rec.status === "Absent" && <Badge className="bg-red-500 text-white font-bold">Absent</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingEmployee(rec)}
                        className="text-xs font-semibold gap-1 text-sky-600 hover:bg-sky-50 bg-white"
                        title="View Complete Timesheet"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(rec)}
                        className="text-xs font-semibold gap-1 text-slate-700 hover:text-sky-600 bg-white"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </div>
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
