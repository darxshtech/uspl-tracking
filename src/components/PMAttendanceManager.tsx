"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess, showWarning, showInfo } from "@/lib/swal";
import Link from "next/link";
import MultiDateLeavePicker from "@/components/MultiDateLeavePicker";
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
  UserCheck,
  Sliders,
  BookOpen,
  ShieldCheck,
  Check,
  X
} from "lucide-react";
import AttendanceCalendarView from "@/components/AttendanceCalendarView";
import { formatHoursAndMinutes, calculateHoursDifference, getCurrentISTTime12 } from "@/lib/timeUtils";
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

  // Shift Working Hours Policy State (Full-Day threshold e.g. 9 or 8)
  const [fullDayPolicyHours, setFullDayPolicyHours] = useState<number>(9);
  const [policyInputHours, setPolicyInputHours] = useState<string>("9");
  const [totalLeavesPolicy, setTotalLeavesPolicy] = useState<number>(2);
  const [totalLeavesInput, setTotalLeavesInput] = useState<string>("2");
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

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
  const [leaveSelectedDates, setLeaveSelectedDates] = useState<string[]>([]);
  const [leaveType, setLeaveType] = useState("Leave");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Live IST Clock for Active Shifts
  const [currentISTTime, setCurrentISTTime] = useState<string>("");

  useEffect(() => {
    setCurrentISTTime(getCurrentISTTime12());
    const clockTimer = setInterval(() => {
      setCurrentISTTime(getCurrentISTTime12());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data && data.full_day_hours) {
        setFullDayPolicyHours(data.full_day_hours);
        setPolicyInputHours(data.full_day_hours.toString());
      }
      if (data && data.total_leaves_allowed !== undefined) {
        setTotalLeavesPolicy(data.total_leaves_allowed);
        setTotalLeavesInput(data.total_leaves_allowed.toString());
      }
    } catch (err) {}
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(policyInputHours);
    if (isNaN(parsed) || parsed <= 0 || parsed > 24) {
      showWarning("Invalid Value", "Please enter a valid number between 1 and 24 hours.");
      return;
    }

    setSavingPolicy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          full_day_hours: parseFloat(policyInputHours),
          total_leaves_allowed: parseInt(totalLeavesInput, 10)
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFullDayPolicyHours(parseFloat(policyInputHours));
        setTotalLeavesPolicy(parseInt(totalLeavesInput, 10));
        setPolicyModalOpen(false);
        showSuccess("Policy Updated", "Global settings updated successfully.");
        fetchRecords();
      } else {
        showError("Update Failed", data.error || "Failed to update settings");
      }
    } catch (err) {
      showError("Error", "Could not save policy setting.");
    } finally {
      setSavingPolicy(false);
    }
  };

  useEffect(() => {
    fetchRecords(true);

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchRecords(false);
    }, 15000);

    const handleFocus = () => fetchRecords(false);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedEmployee, selectedMonth, selectedYear]);

  const fetchRecords = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const query = new URLSearchParams({
        employee_id: selectedEmployee,
        month: selectedMonth,
        year: selectedYear,
      });
      const res = await fetch(`/api/attendance/manage?${query.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRecords(data);
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.error("Error fetching attendance manage records:", err);
    } finally {
      if (showLoading) setLoading(false);
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
        fetchRecords(true);
        showSuccess("Record Updated", "Attendance record updated successfully!");
      } else {
        showError("Failed to update record.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRecordLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveEmpId || leaveSelectedDates.length === 0) {
      showError("Please choose an employee and select at least one leave date on the calendar.");
      return;
    }

    setSubmittingLeave(true);
    try {
      const res = await fetch("/api/attendance/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(leaveEmpId),
          selected_dates: leaveSelectedDates,
          status: leaveType,
          reason: leaveReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLeaveModalOpen(false);
        setLeaveSelectedDates([]);
        setLeaveReason("");
        fetchRecords(true);
        showSuccess("Leave Recorded", data.message || "Leave successfully logged.");
      } else {
        showError("Failed to Record Leave", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error recording leave.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const [processingLeaveId, setProcessingLeaveId] = useState<number | null>(null);

  const handleInlineLeaveAction = async (id: number, action: "approve" | "reject") => {
    setProcessingLeaveId(id);
    try {
      const res = await fetch("/api/attendance/leave-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          leave_type: "Leave",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess(
          action === "approve" ? "Leave Approved" : "Leave Rejected",
          data.message || `Leave request ${action === "approve" ? "approved" : "rejected"} successfully.`
        );
        fetchRecords(false);
      } else {
        showError("Action Failed", data.error || "Failed to update leave request.");
      }
    } catch (err) {
      console.error(err);
      showError("Error updating leave request.");
    } finally {
      setProcessingLeaveId(null);
    }
  };

  // Real-time Metrics summary (calculating dynamic elapsed hours for active shifts)
  const totalDays = records.length;
  const totalHours = records.reduce((acc, r) => {
    let h = parseFloat(r.total_hours || 0);
    if (r.login_time && !r.logout_time) {
      h = calculateHoursDifference(r.login_time, getCurrentISTTime12());
    }
    return acc + (isNaN(h) ? 0 : h);
  }, 0);
  const presentDays = records.filter(
    (r) => r.status === "Present" || r.status === "Present (Overtime)" || (r.login_time && !r.logout_time)
  ).length;
  const halfDays = records.filter((r) => r.status === "Half Day").length;
  const leaveDays = records.filter((r) => r.status === "Leave").length;
  const avgHours = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : "0";

  const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || "Month";
  const selectedEmpObj = employees.find((e) => e.id.toString() === selectedEmployee);

  // 1. Export Excel (.xlsx)
  const handleExportExcel = () => {
    if (records.length === 0) {
      showWarning("No Records", "No attendance records to export.");
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
      showWarning("No Records", "No attendance records to export.");
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
    doc.text(`Total Days: ${totalDays} | Total Working Hours: ${formatHoursAndMinutes(totalHours)} | Present: ${presentDays} | Half Days: ${halfDays} | Leaves: ${leaveDays}`, 14, 31);

    const tableHeaders = [["#", "Employee", "Date", "Login (IST)", "Logout (IST)", "Hours", "Status"]];
    const tableBody = records.map((r, i) => [
      i + 1,
      r.employee_name,
      new Date(r.date).toLocaleDateString(),
      r.login_time || "--:--",
      r.logout_time || "--:--",
      formatHoursAndMinutes(r.total_hours),
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
      showWarning("Employee Required", "Please select a specific employee from the filter dropdown before sending the email report.");
      return;
    }

    if (records.length === 0) {
      showWarning("No Records", "No records found for this employee in the selected month.");
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
        showSuccess("Report Dispatched ✉️", data.message || `Attendance report successfully sent to ${selectedEmpObj.email}`);
      } else {
        showError("Email Failed", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("An error occurred while sending email.");
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
              <DialogContent className="w-[92vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Palmtree className="h-5 w-5 text-amber-500" /> Record Employee Leave
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleRecordLeave} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 text-xs">Select Employee *</Label>
                    <Select value={leaveEmpId} onValueChange={(val) => setLeaveEmpId(val || "")}>
                      <SelectTrigger><SelectValue placeholder="Choose Employee" /></SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => e.role !== "CEO" && e.role !== "Admin")
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-800 text-xs">
                      Select Leave Days on Calendar *
                    </Label>
                    <MultiDateLeavePicker
                      selectedDates={leaveSelectedDates}
                      onDatesChange={setLeaveSelectedDates}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 text-xs">Leave Type</Label>
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
                    <Label htmlFor="lReason" className="font-semibold text-slate-700 text-xs">Reason / Notes</Label>
                    <Input
                      id="lReason"
                      placeholder="e.g. Medical emergency, family function"
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submittingLeave || !leaveEmpId || leaveSelectedDates.length === 0}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 mt-2 shadow-md disabled:opacity-50"
                  >
                    {submittingLeave
                      ? "Logging Leave..."
                      : `Confirm & Record ${leaveSelectedDates.length > 0 ? leaveSelectedDates.length + " Day(s)" : "Leave"}`}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Link href="/dashboard/policies">
              <Button size="sm" variant="outline" className="bg-white hover:bg-indigo-50 text-indigo-700 font-bold text-xs gap-1.5 shadow-xs border-indigo-200">
                <BookOpen className="h-3.5 w-3.5 text-indigo-600" /> Company Policies
              </Button>
            </Link>

            {/* Shift Working Hours Policy Config Modal (PM / CEO / Admin) */}
            <Dialog open={policyModalOpen} onOpenChange={setPolicyModalOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" className="bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs gap-1.5 shadow-xs border-slate-300" />}>
                <Sliders className="h-3.5 w-3.5 text-sky-600" /> Quick Policy ({fullDayPolicyHours}h)
              </DialogTrigger>
              <DialogContent className="w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Sliders className="h-5 w-5 text-indigo-600" />
                    Attendance & Shift Policy Settings
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSavePolicy} className="space-y-4 pt-2">
                  <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 space-y-1.5">
                    <span className="font-bold flex items-center gap-1 text-indigo-900">
                      <ShieldCheck className="h-4 w-4 text-indigo-600" /> Automatic Shift Thresholds
                    </span>
                    <ul className="text-[11px] text-indigo-800 space-y-1 list-disc pl-4">
                      <li>&lt; <strong>{(parseFloat(policyInputHours) / 2 || 4.5).toFixed(1)} hrs</strong>: Recorded as <strong className="text-red-700">Full Day Absent</strong>.</li>
                      <li><strong>{(parseFloat(policyInputHours) / 2 || 4.5).toFixed(1)} hrs to &lt; {policyInputHours || 9} hrs</strong>: Recorded as <strong className="text-amber-700">Half Day</strong>.</li>
                      <li>&ge; <strong>{policyInputHours || 9} hrs</strong>: Recorded as <strong className="text-emerald-700">Present (Full Day)</strong>.</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="policyHours" className="font-bold text-slate-900 text-xs">
                      Required Full-Day Working Hours (e.g. 9 or 8) *
                    </Label>
                    <Input
                      id="policyHours"
                      type="number"
                      step="0.5"
                      min="1"
                      max="24"
                      value={policyInputHours}
                      onChange={(e) => setPolicyInputHours(e.target.value)}
                      className="text-base font-bold"
                      required
                    />
                    <p className="text-[11px] text-slate-500">
                      Currently active threshold: <strong>{fullDayPolicyHours} hours / day</strong> (Half-day: {fullDayPolicyHours / 2}h)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="totalLeaves" className="font-bold text-slate-900 text-xs">
                      Total Leaves Allowed Per Month (Global) *
                    </Label>
                    <Input
                      id="totalLeaves"
                      type="number"
                      step="1"
                      min="0"
                      value={totalLeavesInput}
                      onChange={(e) => setTotalLeavesInput(e.target.value)}
                      className="text-base font-bold"
                      required
                    />
                    <p className="text-[11px] text-slate-500">
                      Currently active allowance: <strong>{totalLeavesPolicy} leaves</strong> (Carry forward enabled: 2+2=4)
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Link href="/dashboard/policies" className="text-xs font-bold text-indigo-600 hover:underline">
                      Open Full Policies Page &rarr;
                    </Link>
                    <Button
                      type="submit"
                      disabled={savingPolicy}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 shadow-sm"
                    >
                      {savingPolicy ? "Saving Policy..." : "Save Policy"}
                    </Button>
                  </div>
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
                  .filter((e) => e.role !== "CEO" && e.role !== "Admin")
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
          <div className="text-2xl font-black text-sky-900 mt-1">{formatHoursAndMinutes(totalHours)}</div>
          <span className="text-[11px] text-sky-600 font-semibold">{formatHoursAndMinutes(avgHours)}/day avg</span>
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

      {/* Detailed Employee Timesheet View Modal with Month-wise Calendar */}
      <Dialog open={!!viewingEmployee} onOpenChange={(open) => !open && setViewingEmployee(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Eye className="h-5 w-5 text-sky-500" /> Employee Attendance & Calendar Breakdown
            </DialogTitle>
          </DialogHeader>

          {viewingEmployee && (
            <div className="space-y-5 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{viewingEmployee.employee_name}</h4>
                  <div className="text-xs text-slate-500">{viewingEmployee.employee_email} • <Badge variant="outline" className="text-[10px]">{viewingEmployee.employee_role}</Badge></div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-500 uppercase">{monthLabel} {selectedYear}</div>
                  <div className="text-base font-black text-sky-600">
                    {records.filter(r => r.user_id === viewingEmployee.user_id).reduce((a, c) => a + (parseFloat(c.total_hours) || 0), 0).toFixed(1)} Total Hours Logged
                  </div>
                </div>
              </div>

              {/* Month-Wise Interactive Calendar Grid for Employee */}
              <AttendanceCalendarView
                initialEmployeeId={viewingEmployee.user_id ? viewingEmployee.user_id.toString() : "ALL"}
                canAddHoliday={true}
                hideEmployeeSelect={true}
                employees={employees}
              />
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
                    min="0"
                    step="0.1"
                    value={editHours}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setEditHours(isNaN(val) ? "" : Math.max(0, val).toString());
                    }}
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
                  <TableCell className="font-bold text-xs text-slate-900">
                    {(() => {
                      const isActive = Boolean(rec.login_time && !rec.logout_time);
                      const displayHours = isActive
                        ? calculateHoursDifference(rec.login_time, currentISTTime || getCurrentISTTime12())
                        : parseFloat(rec.total_hours || 0);

                      return isActive ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-700 font-black">{formatHoursAndMinutes(displayHours)}</span>
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] py-0 px-1 font-bold animate-pulse">
                            Live ⏱️
                          </Badge>
                        </div>
                      ) : (
                        <span>{formatHoursAndMinutes(displayHours)}</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const s = (rec.status || "").trim();
                      if (s === "Present (Overtime)") {
                        return (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs">
                            <span>Present</span>
                            <span className="text-[9px] bg-emerald-800/80 px-1 py-0.2 rounded font-black tracking-tight">OT</span>
                          </Badge>
                        );
                      }
                      if (s === "Present") {
                        return <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white font-bold text-xs">Present</Badge>;
                      }
                      if (s === "Half Day") {
                        return <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-bold text-xs">Half Day</Badge>;
                      }
                      if (s === "Leave") {
                        return <Badge className="bg-sky-500 hover:bg-sky-500 text-white font-bold text-xs">Leave</Badge>;
                      }
                      if (s.includes("Leave")) {
                        return <Badge className="bg-indigo-500 hover:bg-indigo-500 text-white font-bold text-xs">{s}</Badge>;
                      }
                      if (s === "Absent") {
                        return <Badge className="bg-red-500 hover:bg-red-500 text-white font-bold text-xs">Absent</Badge>;
                      }
                      if (s === "Holiday") {
                        return <Badge className="bg-blue-500 hover:bg-blue-500 text-white font-bold text-xs">Holiday</Badge>;
                      }
                      if (rec.login_time) {
                        return <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white font-bold text-xs">Present</Badge>;
                      }
                      return <Badge variant="outline" className="font-bold text-xs text-slate-700">{s || "Present"}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {(rec.status === "Leave (Pending)" || rec.status?.includes("Pending")) && (
                        <>
                          <Button
                            size="sm"
                            disabled={processingLeaveId === rec.id}
                            onClick={() => handleInlineLeaveAction(rec.id, "approve")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 h-8 px-2.5 shadow-xs"
                            title="Approve Leave Application"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingLeaveId === rec.id}
                            onClick={() => handleInlineLeaveAction(rec.id, "reject")}
                            className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 font-bold text-xs gap-1 h-8 px-2.5 shadow-xs"
                            title="Reject Leave Application"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {rec.status === "Absent" && (
                        <Button
                          size="sm"
                          onClick={() => openEditModal(rec)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1 h-8 px-2.5 shadow-xs"
                          title="Avoid or Change Absent Status for Employee"
                        >
                          <UserCheck className="h-3.5 w-3.5" /> Avoid / Change Absent
                        </Button>
                      )}
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
