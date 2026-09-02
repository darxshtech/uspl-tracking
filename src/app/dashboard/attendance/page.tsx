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
import { showError, showInfo, showToast } from "@/lib/swal";
import PMAttendanceManager from "@/components/PMAttendanceManager";
import AttendanceCalendarView from "@/components/AttendanceCalendarView";
import AttendanceWidget from "@/components/AttendanceWidget";
import { calculateHoursDifference, getCurrentISTTime12, formatHoursAndMinutes } from "@/lib/timeUtils";
import MultiDateLeavePicker from "@/components/MultiDateLeavePicker";
import { 
  CalendarDays, 
  LogIn, 
  LogOut, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Crown, 
  Calendar as CalendarIcon, 
  List,
  Eye,
  Palmtree,
  Plus,
  Check,
  X,
  UserCheck,
  Zap,
  Settings,
  Sparkles,
  Save,
  HelpCircle,
  PlusCircle,
  RefreshCw
} from "lucide-react";

export default function AttendancePage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const currentUserId = (session?.user as any)?.id;
  const isCEO = role === "CEO";
  const isPM = role === "PM";
  const isAdmin = role === "Admin";
  const isManagement = ["Admin", "CEO", "PM"].includes(role);
  const canManageHolidays = isManagement;

  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [attendance, setAttendance] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [managementPendingLeaves, setManagementPendingLeaves] = useState<any[]>([]);
  const [processingLeaveAction, setProcessingLeaveAction] = useState<number | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentISTTime, setCurrentISTTime] = useState("");
  const [currentISTDate, setCurrentISTDate] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Leave Balances & Opening Balance Setup Modal State
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [editingBalances, setEditingBalances] = useState<Record<number, { monthly_quota: number; carried_forward: number }>>({});
  const [savingBalances, setSavingBalances] = useState(false);

  // Log Past Attendance Modal State (for Management: PM, CEO, Admin)
  const [logPastModalOpen, setLogPastModalOpen] = useState(false);
  const [pastEmployeeId, setPastEmployeeId] = useState<string>("ALL");
  const [pastStartDate, setPastStartDate] = useState("2026-08-01");
  const [pastEndDate, setPastEndDate] = useState("2026-08-16");
  const [pastStatus, setPastStatus] = useState("Present");
  const [pastLoginTime, setPastLoginTime] = useState("09:30:00 AM");
  const [pastLogoutTime, setPastLogoutTime] = useState("06:30:00 PM");
  const [pastHours, setPastHours] = useState("9.00");
  const [pastRemarks, setPastRemarks] = useState("Historical August attendance");
  const [submittingPastAttendance, setSubmittingPastAttendance] = useState(false);

  // Record Leave Modal State (for PM / CEO or self)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [selectedLeaveDates, setSelectedLeaveDates] = useState<string[]>([]);
  const [leaveType, setLeaveType] = useState("Leave");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // View Record Detail Modal
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // Edit / Override Record Modal State (for Management: PM, CEO, Admin)
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editStatus, setEditStatus] = useState("Present");
  const [editLoginTime, setEditLoginTime] = useState("09:30:00 AM");
  const [editLogoutTime, setEditLogoutTime] = useState("06:30:00 PM");
  const [editHours, setEditHours] = useState("9.00");
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditModal = (rec: any) => {
    setEditingRecord(rec);
    setEditLoginTime(rec.login_time || "09:30:00 AM");
    setEditLogoutTime(rec.logout_time || "06:30:00 PM");
    setEditStatus(rec.status === "Absent" ? "Present" : (rec.status || "Present"));
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
        fetchAttendance();
        if (isManagement) fetchManagementPendingLeaves();
        showToast("Attendance record updated successfully!");
      } else {
        showError("Failed to update attendance.");
      }
    } catch (err) {
      console.error(err);
      showError("Error updating attendance.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOverrideToFullDay = async (id: number, employeeName: string) => {
    try {
      const res = await fetch("/api/attendance/manage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          override_full_day: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Overridden to Full Day (9.0 hrs) for ${employeeName || "Employee"}!`, "success");
        fetchAttendance();
        fetchLeaveBalances();
      } else {
        showError("Override Failed", data.error || "Could not override half day.");
      }
    } catch (err: any) {
      showError("Error", err.message || "Network error.");
    }
  };

  const fetchLeaveBalances = async () => {
    try {
      const res = await fetch("/api/attendance/leave-balances");
      const data = await res.json();
      if (data.leaveBalances) {
        setLeaveBalances(data.leaveBalances);
        const map: Record<number, { monthly_quota: number; carried_forward: number }> = {};
        data.leaveBalances.forEach((item: any) => {
          map[item.user_id] = {
            monthly_quota: item.monthly_quota,
            carried_forward: item.carried_forward,
          };
        });
        setEditingBalances(map);
      }
    } catch (err) {
      console.error("Error fetching leave balances:", err);
    }
  };

  const handleSaveOpeningBalances = async () => {
    setSavingBalances(true);
    try {
      const payload = Object.entries(editingBalances).map(([userId, val]) => ({
        user_id: parseInt(userId, 10),
        monthly_quota: val.monthly_quota,
        carried_forward: val.carried_forward,
      }));

      const res = await fetch("/api/attendance/leave-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: payload }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Opening leave balances saved successfully!", "success");
        setOpeningModalOpen(false);
        fetchLeaveBalances();
      } else {
        showError("Failed to Save", data.error || "Could not update balances.");
      }
    } catch (err: any) {
      showError("Error", err.message || "Network error.");
    } finally {
      setSavingBalances(false);
    }
  };

  const handleLogPastAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastStartDate || !pastEndDate) {
      showError("Please select start and end dates.");
      return;
    }

    setSubmittingPastAttendance(true);
    try {
      const targetEmployees = pastEmployeeId === "ALL"
        ? employees.filter((emp: any) => !["Admin", "CEO"].includes(emp.role))
        : [{ id: parseInt(pastEmployeeId, 10), name: "Employee" }];

      let totalLogged = 0;
      for (const emp of targetEmployees) {
        const res = await fetch("/api/attendance/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: emp.id,
            start_date: pastStartDate,
            end_date: pastEndDate,
            status: pastStatus,
            login_time: (pastStatus === "Present" || pastStatus === "Half Day") ? pastLoginTime : null,
            logout_time: (pastStatus === "Present" || pastStatus === "Half Day") ? pastLogoutTime : null,
            total_hours: (pastStatus === "Present" || pastStatus === "Half Day") ? pastHours : 0,
            reason: pastRemarks,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          totalLogged += data.count || 0;
        }
      }

      showToast(`Successfully logged past attendance (${totalLogged} records updated)!`, "success");
      setLogPastModalOpen(false);
      fetchAttendance();
      fetchLeaveBalances();
    } catch (err: any) {
      showError("Error", err.message || "Failed to log past attendance.");
    } finally {
      setSubmittingPastAttendance(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchAttendance();
    fetchLeaveBalances();
    if (isManagement) {
      fetchEmployees();
      fetchManagementPendingLeaves();
    }

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchAttendance();
      if (isManagement) fetchManagementPendingLeaves();
    }, 25000);
    return () => clearInterval(interval);
  }, [isManagement]);

  const fetchAttendance = async () => {
    try {
      const res = await fetch("/api/attendance?_=" + Date.now());
      const data = await res.json();
      if (data.attendance) {
        setAttendance(data.attendance);
        setPendingLeaves(data.pendingLeaves || []);
        setCurrentISTTime(data.currentTime || "");
        setCurrentISTDate(data.currentDate || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchManagementPendingLeaves = async () => {
    try {
      const res = await fetch("/api/attendance/leave-action?_=" + Date.now());
      const data = await res.json();
      if (data && Array.isArray(data.pendingLeaves)) {
        setManagementPendingLeaves(data.pendingLeaves);
      }
    } catch (err) {
      console.error("Error fetching management pending leaves:", err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees?_=" + Date.now());
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = (session?.user as any)?.id;
    if (!userId || selectedLeaveDates.length === 0) {
      showError("Please select at least one date on the calendar.");
      return;
    }

    setSubmittingLeave(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          selected_dates: selectedLeaveDates,
          status: leaveType,
          reason: leaveReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLeaveModalOpen(false);
        setSelectedLeaveDates([]);
        setLeaveReason("");
        fetchAttendance();
        if (isManagement) fetchManagementPendingLeaves();
        setFeedback(`✓ ${data.message}`);
        showToast("Leave request submitted successfully!");
      } else {
        showError("Failed to Submit Leave", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error submitting leave.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleLeaveAction = async (id: number, action: "approve" | "reject") => {
    setProcessingLeaveAction(id);
    try {
      const res = await fetch("/api/attendance/leave-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          leave_type: leaveType || "Leave",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Leave request ${action === "approve" ? "approved" : "rejected"}!`);
        fetchAttendance();
        fetchManagementPendingLeaves();
      } else {
        showError("Action Failed", data.error || "Failed to update leave request");
      }
    } catch (err) {
      console.error(err);
      showError("Error updating leave request.");
    } finally {
      setProcessingLeaveAction(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-sky-500" />
            Attendance & Calendar Management
          </h1>
          <p className="text-slate-500 mt-1">
            Track daily shifts in 12-hour IST, explore monthly calendar with Sunday weekly off, and manage company holidays.
          </p>
        </div>

        {/* View Mode Switcher & IST Time Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <List className="h-3.5 w-3.5" /> Table List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5 text-sky-500" /> Day-Wise Calendar (Mon-Sun)
            </button>
          </div>

          {/* Management Opening Balances Setup Button */}
          {isManagement && (
            <Button
              size="sm"
              onClick={() => setOpeningModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm h-9 cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
              Opening Balances Setup
            </Button>
          )}

          {/* Management Log Past Attendance Button */}
          {isManagement && (
            <Button
              size="sm"
              onClick={() => setLogPastModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm h-9 cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Log Past Attendance
            </Button>
          )}

          <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold shadow-xs">
            <Clock className="h-4 w-4 text-sky-400" />
            <span suppressHydrationWarning>
              IST: {mounted ? (currentISTTime || new Date().toLocaleTimeString()) : "12:00:00 PM"}
            </span>
          </div>
        </div>
      </div>

      {/* Executive / Admin Exemption Notice */}
      {(isCEO || isAdmin) && (
        <div className="p-6 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-500 text-white rounded-xl shadow-xs">
            <Crown className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Executive Exemption Policy ({role === "Admin" ? "Company Admin" : "CEO"})</h3>
            <p className="text-sm text-slate-600 mt-0.5">
              As {role === "Admin" ? "Company Administrator" : "Chief Executive Officer"}, your account is exempt from check-in, check-out, and daily shift logging. You have full oversight into company timesheets, leave approval workflows, shift policy configuration, and holiday planning below.
            </p>
          </div>
        </div>
      )}

      {/* Employee Daily Attendance Punch Card (for Developer, Tester, PM) */}
      {!isCEO && !isAdmin && (
        <div className="space-y-3">
          {/* Live Leave Balance Ledger Banner for Current User */}
          {(() => {
            const myBal = leaveBalances.find((b: any) => b.user_id === currentUserId);
            if (!myBal) return null;
            return (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <Palmtree className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-sm">
                      My Paid Leave Ledger ({myBal.month})
                    </h4>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Quota: <strong>{myBal.monthly_quota} days/mo</strong> • Carried Over: <strong>{myBal.carried_forward} days</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-white/90 border border-emerald-200 px-3 py-1.5 rounded-xl text-center shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Paid Leaves Taken</span>
                    <span className="font-extrabold text-slate-900 text-xs">
                      {myBal.paid_leaves_taken} days {myBal.half_days_deducted > 0 && `(+${myBal.half_days_deducted} from 3:1)`}
                    </span>
                  </div>

                  <div className="bg-white/90 border border-emerald-200 px-3 py-1.5 rounded-xl text-center shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Half-Days Logged</span>
                    <span className={`font-extrabold text-xs ${myBal.half_days_taken > 0 ? "text-amber-700" : "text-slate-900"}`}>
                      {myBal.half_days_taken} half-days
                    </span>
                  </div>

                  <div className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-center shadow-xs">
                    <span className="text-[10px] text-emerald-100 uppercase font-bold block">Remaining Paid Balance</span>
                    <span className="font-black text-sm">
                      {myBal.remaining_balance} days
                    </span>
                  </div>

                  {myBal.total_lwp_days > 0 && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1.5 rounded-xl text-center shadow-2xs">
                      <span className="text-[10px] text-rose-600 uppercase font-bold block">Unpaid Leaves (LWP)</span>
                      <span className="font-extrabold text-xs">
                        {myBal.total_lwp_days} days
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-lg">Daily Shift Punch (IST 12-Hour)</h3>
              </div>
              <p className="text-xs text-slate-500">
                Punches are strictly locked to today's date ({currentISTDate || new Date().toISOString().split("T")[0]}). Live shift hours update automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AttendanceWidget />

              {/* Record / Apply Leave Trigger with Multi-Date Calendar Picker */}
              <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
                <DialogTrigger render={<Button variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50 font-bold px-4 py-2.5 flex items-center gap-2 cursor-pointer" />}>
                  <Palmtree className="h-4 w-4 text-amber-600" /> Apply Leave
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Palmtree className="h-5 w-5 text-amber-600" /> Apply for Leave / Day Off
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleRecordLeave} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="font-bold text-slate-800 text-xs">
                        Select Leave Days on Calendar *
                      </Label>
                      <MultiDateLeavePicker
                        selectedDates={selectedLeaveDates}
                        onDatesChange={setSelectedLeaveDates}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-slate-700 text-xs">Leave Category</Label>
                      <Select value={leaveType} onValueChange={(val) => setLeaveType(val || "Leave")}>
                        <SelectTrigger><SelectValue placeholder="Leave Type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Leave">Casual / Planned Leave</SelectItem>
                          <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                          <SelectItem value="Half Day">Half Day</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="leaveReason" className="font-semibold text-slate-700 text-xs">Reason / Note</Label>
                      <Input
                        id="leaveReason"
                        placeholder="e.g. Medical appointment, family event..."
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submittingLeave || selectedLeaveDates.length === 0}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 mt-2 shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {submittingLeave
                        ? "Submitting Request..."
                        : `Confirm & Submit ${selectedLeaveDates.length > 0 ? selectedLeaveDates.length + " Day(s)" : "Leave"}`}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-4 rounded-xl font-semibold text-sm ${
            feedback.startsWith("✓")
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {feedback}
        </div>
      )}

      {/* VIEW MODE 1: DAY-WISE CALENDAR VIEW (MONDAY TO SUNDAY) */}
      {viewMode === "calendar" && (
        <AttendanceCalendarView
          canAddHoliday={canManageHolidays}
          employees={employees}
          initialEmployeeId={isManagement ? "ALL" : (session?.user as any)?.id?.toString()}
        />
      )}

      {/* VIEW MODE 2: TABLE LIST VIEW & MANAGEMENT ATTENDANCE MANAGER */}
      {viewMode === "table" && (
        <>
          {/* PM / CEO / Admin Leave Approval Control Card */}
          {isManagement && managementPendingLeaves && managementPendingLeaves.length > 0 && (
            <div className="p-5 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/90 shadow-md space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs shrink-0">
                    <Palmtree className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-amber-950 text-base flex items-center gap-2">
                      <span>Pending Employee Leave Applications ({managementPendingLeaves.length})</span>
                      <Badge className="bg-amber-600 text-white font-bold text-[10px] px-2 py-0.5 animate-pulse">
                        Action Required
                      </Badge>
                    </h3>
                    <p className="text-xs text-amber-800/90 mt-0.5 font-medium">
                      Review, approve, or reject employee leave requests submitted for upcoming working days.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200/90 bg-white/90 shadow-2xs overflow-hidden">
                <Table>
                  <TableHeader className="bg-amber-100/50">
                    <TableRow>
                      <TableHead className="font-bold text-amber-950 text-xs">Employee</TableHead>
                      <TableHead className="font-bold text-amber-950 text-xs">Role</TableHead>
                      <TableHead className="font-bold text-amber-950 text-xs">Requested Date</TableHead>
                      <TableHead className="font-bold text-amber-950 text-xs">Reason / Note</TableHead>
                      <TableHead className="font-bold text-amber-950 text-xs">Status</TableHead>
                      <TableHead className="font-bold text-amber-950 text-xs text-right">Approval Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managementPendingLeaves.map((rec) => (
                      <TableRow key={rec.id} className="hover:bg-amber-50/50 transition-colors">
                        <TableCell className="font-bold text-slate-900 text-xs">{rec.employee_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-bold">{rec.employee_role}</Badge></TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900">
                          {new Date(rec.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 font-medium">
                          {rec.notes ? rec.notes.replace(/^PENDING_LEAVE:\s*/, "") || "No reason provided" : "No reason provided"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-amber-500 text-white font-bold text-[10px]">Leave (Pending)</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={processingLeaveAction === rec.id}
                              onClick={() => handleLeaveAction(rec.id, "approve")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-8 px-3 shadow-xs"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processingLeaveAction === rec.id}
                              onClick={() => handleLeaveAction(rec.id, "reject")}
                              className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 font-bold text-xs gap-1.5 h-8 px-3 shadow-xs"
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Executive Attendance Manager Section (Shift Policy, Reports, Logs) */}
          {isManagement && <PMAttendanceManager employees={employees} />}

          {/* Attendance History Table */}
          <div className="space-y-3">
            {/* Upcoming Pending Leave Requests Notice (for Employee) */}
            {!isManagement && pendingLeaves && pendingLeaves.length > 0 && (
              <div className="p-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 to-purple-50/50 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-2xs shrink-0">
                    <Palmtree className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-indigo-950 flex items-center gap-2">
                      <span>Pending Leave Application ({pendingLeaves.length} day{pendingLeaves.length > 1 ? "s" : ""})</span>
                      <Badge className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.2">Awaiting PM Approval</Badge>
                    </div>
                    <p className="text-[11px] text-indigo-800/90 mt-0.5 font-medium">
                      Applied for: <strong>{new Date(pendingLeaves[0].date).toLocaleDateString()}</strong>
                      {pendingLeaves.length > 1 && <> to <strong>{new Date(pendingLeaves[pendingLeaves.length - 1].date).toLocaleDateString()}</strong></>}
                      {pendingLeaves[0].notes ? ` — "${pendingLeaves[0].notes.replace(/^PENDING_LEAVE:\s*/, '')}"` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] font-bold text-indigo-600 bg-white/80 px-3 py-1.5 rounded-xl border border-indigo-200/80 shadow-2xs shrink-0">
                  📅 Future Date Status
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Recent Attendance Records</h3>
              <span className="text-xs text-slate-500 font-medium">12-Hour IST Timing Format</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee</TableHead>
                    <TableHead className="font-bold">Role</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Check-In (IST)</TableHead>
                    <TableHead className="font-bold">Check-Out (IST)</TableHead>
                    <TableHead className="font-bold">Total Shift Hours</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8">Loading records...</TableCell></TableRow>
                  ) : attendance.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-10">No attendance records logged.</TableCell></TableRow>
                  ) : (
                    attendance.map((rec) => {
                      const isActiveShift = Boolean(rec.login_time && !rec.logout_time);
                      let displayHours = parseFloat(rec.total_hours || 0);

                      // If currently active in shift, calculate live elapsed hours
                      if (isActiveShift && rec.login_time) {
                        displayHours = calculateHoursDifference(rec.login_time, currentISTTime || getCurrentISTTime12());
                      }

                      return (
                        <TableRow key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell className="font-bold text-slate-900">{rec.employee_name || "N/A"}</TableCell>
                          <TableCell><Badge variant="outline">{rec.employee_role || "N/A"}</Badge></TableCell>
                          <TableCell className="text-xs text-slate-700 font-medium">{new Date(rec.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-800 font-semibold">{rec.login_time || "--:--"}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-800 font-semibold">{rec.logout_time || "--:--"}</TableCell>
                          <TableCell className="font-bold text-slate-900 text-xs">
                            {isActiveShift ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-emerald-700 font-black">{formatHoursAndMinutes(displayHours)}</span>
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] py-0 px-1 font-bold animate-pulse">
                                  Live ⏱️
                                </Badge>
                              </div>
                            ) : (
                              <span>{formatHoursAndMinutes(displayHours)}</span>
                            )}
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
                              if (s === "Present" || (rec.login_time && !rec.logout_time && !s.includes("Leave") && s !== "Holiday")) {
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
                              if (s === "Holiday") {
                                return <Badge className="bg-blue-500 hover:bg-blue-500 text-white font-bold text-xs">Holiday</Badge>;
                              }
                              if (s === "Absent" && !rec.login_time) {
                                return <Badge className="bg-red-500 hover:bg-red-500 text-white font-bold text-xs">Absent</Badge>;
                              }
                              if (rec.login_time) {
                                return <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white font-bold text-xs">Present</Badge>;
                              }
                              return <Badge className="bg-red-500 hover:bg-red-500 text-white font-bold text-xs">Absent</Badge>;
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              {isManagement && (rec.status === "Leave (Pending)" || rec.status?.includes("Pending")) && (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={processingLeaveAction === rec.id}
                                    onClick={() => handleLeaveAction(rec.id, "approve")}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 h-8 px-2.5 shadow-xs cursor-pointer"
                                    title="Approve Leave Application"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={processingLeaveAction === rec.id}
                                    onClick={() => handleLeaveAction(rec.id, "reject")}
                                    className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 font-bold text-xs gap-1 h-8 px-2.5 shadow-xs cursor-pointer"
                                    title="Reject Leave Application"
                                  >
                                    <X className="h-3.5 w-3.5" /> Reject
                                  </Button>
                                </>
                              )}
                              {isManagement && rec.status === "Half Day" && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOverrideToFullDay(rec.id, rec.employee_name)}
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1 h-8 px-2.5 shadow-xs cursor-pointer"
                                  title="1-Click Override Half Day to Full Day (9.0 hrs)"
                                >
                                  <Zap className="h-3.5 w-3.5" /> Full Day Override
                                </Button>
                              )}
                              {isManagement && rec.status === "Absent" && !rec.login_time && (
                                <Button
                                  size="sm"
                                  onClick={() => openEditModal(rec)}
                                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1 h-8 px-2.5 shadow-xs cursor-pointer"
                                  title="Avoid or Change Absent Status for Employee"
                                >
                                  <UserCheck className="h-3.5 w-3.5" /> Avoid / Change Absent
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedRecord(rec)}
                                className="text-xs font-semibold gap-1 text-sky-600 hover:bg-sky-50 bg-white"
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* Record Details Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Eye className="h-5 w-5 text-sky-500" /> Attendance Record Detail
            </DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-3 pt-2 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{selectedRecord.employee_name} ({selectedRecord.employee_role})</div>
                <div>Date: <strong>{new Date(selectedRecord.date).toLocaleDateString()}</strong></div>
                <div>Status: <Badge variant="outline" className="ml-1">{selectedRecord.status}</Badge></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Check-In</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.login_time || "N/A"}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Check-Out</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.logout_time || "In Progress"}</span>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-emerald-800 block uppercase font-bold">Total Shift Duration</span>
                <span className="font-bold text-emerald-900 text-sm">
                  {selectedRecord.login_time && !selectedRecord.logout_time
                    ? `${formatHoursAndMinutes(calculateHoursDifference(selectedRecord.login_time, currentISTTime || getCurrentISTTime12()))} (Active In Shift)`
                    : formatHoursAndMinutes(selectedRecord.total_hours)}
                </span>
              </div>

              {selectedRecord.remarks && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Notes / Reason</span>
                  <p className="text-slate-800">{selectedRecord.remarks}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit / Override Attendance Status Dialog for Management */}
      <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-amber-500" />
              Avoid or Change Absent Status
            </DialogTitle>
          </DialogHeader>

          {editingRecord && (
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>Employee: <span className="font-bold text-slate-900">{editingRecord.employee_name || "Employee"}</span></div>
                <div>Date: <span className="font-mono font-bold text-slate-900">{editingRecord.date}</span></div>
                <div>Current Status: <span className="font-bold text-amber-700">{editingRecord.status || "Absent"}</span></div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-xs">New Attendance Status *</Label>
                <Select value={editStatus} onValueChange={(val) => setEditStatus(val || "Present")}>
                  <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Present">Present (Full Day)</SelectItem>
                    <SelectItem value="Half Day">Half Day</SelectItem>
                    <SelectItem value="Leave">Leave (Excused / Paid Leave)</SelectItem>
                    <SelectItem value="Holiday">Holiday (Company Off)</SelectItem>
                    <SelectItem value="Absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editStatus === "Present" || editStatus === "Half Day") && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="editLogin" className="font-semibold text-slate-700 text-xs">Check-In Time</Label>
                      <Input
                        id="editLogin"
                        value={editLoginTime}
                        onChange={(e) => setEditLoginTime(e.target.value)}
                        placeholder="09:30:00 AM"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="editLogout" className="font-semibold text-slate-700 text-xs">Check-Out Time</Label>
                      <Input
                        id="editLogout"
                        value={editLogoutTime}
                        onChange={(e) => setEditLogoutTime(e.target.value)}
                        placeholder="06:30:00 PM"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="editHours" className="font-semibold text-slate-700 text-xs">Total Hours</Label>
                    <Input
                      id="editHours"
                      type="number"
                      step="0.1"
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      placeholder="9.00"
                      className="text-xs"
                    />
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={savingEdit}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 shadow-md cursor-pointer"
              >
                {savingEdit ? "Updating..." : "Save Status Change"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Opening Balances & Mid-Year Setup Dialog for Management */}
      <Dialog open={openingModalOpen} onOpenChange={setOpeningModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-600" />
              Opening Paid Leave Balances &amp; Carry-Over Setup
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-950 flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong>Mid-Year Rollout Configuration:</strong> Set the initial opening leave quota and carried-forward leave balances for staff members (PMs, Developers, QAs). Executive roles (Admin &amp; CEO) are automatically exempt.
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-slate-700">Employee</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Role</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-center">Monthly Quota (Days)</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-center">Carried Over (Opening)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-slate-400 text-xs">
                        No staff employee records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaveBalances.map((item: any) => {
                      const userBal = editingBalances[item.user_id] || {
                        monthly_quota: item.monthly_quota,
                        carried_forward: item.carried_forward,
                      };

                      return (
                        <TableRow key={item.user_id} className="hover:bg-slate-50/50">
                          <TableCell className="py-2.5">
                            <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.email}</div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {item.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <Input
                              type="number"
                              min={0}
                              max={10}
                              step={0.5}
                              value={userBal.monthly_quota}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setEditingBalances((prev) => ({
                                  ...prev,
                                  [item.user_id]: {
                                    ...prev[item.user_id],
                                    monthly_quota: val,
                                  },
                                }));
                              }}
                              className="w-24 mx-auto text-center text-xs font-bold h-8"
                            />
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <Input
                              type="number"
                              min={0}
                              max={50}
                              step={0.5}
                              value={userBal.carried_forward}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setEditingBalances((prev) => ({
                                  ...prev,
                                  [item.user_id]: {
                                    ...prev[item.user_id],
                                    carried_forward: val,
                                  },
                                }));
                              }}
                              className="w-24 mx-auto text-center text-xs font-bold h-8"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpeningModalOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveOpeningBalances}
                disabled={savingBalances}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
              >
                {savingBalances ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Save All Opening Balances
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Past Attendance Dialog for Management */}
      <Dialog open={logPastModalOpen} onOpenChange={setLogPastModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-emerald-600" />
              Log Past Attendance (From 1st August)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleLogPastAttendance} className="space-y-4 pt-2">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Historical Shift Registration:</strong> Add or update attendance shifts starting from <strong>1st August</strong> onwards. Sundays and official holidays are automatically excluded for leaves.
              </div>
            </div>

            {/* Employee Selection */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-slate-700 text-xs">Target Employee *</Label>
              <Select value={pastEmployeeId} onValueChange={(val) => setPastEmployeeId(val || "ALL")}>
                <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">👥 All Active Staff Employees</SelectItem>
                  {employees
                    .filter((emp: any) => !["Admin", "CEO"].includes(emp.role))
                    .map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.name} ({emp.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pastStart" className="font-semibold text-slate-700 text-xs">Start Date *</Label>
                <Input
                  id="pastStart"
                  type="date"
                  min="2026-08-01"
                  value={pastStartDate}
                  onChange={(e) => setPastStartDate(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pastEnd" className="font-semibold text-slate-700 text-xs">End Date *</Label>
                <Input
                  id="pastEnd"
                  type="date"
                  min="2026-08-01"
                  value={pastEndDate}
                  onChange={(e) => setPastEndDate(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            {/* Attendance Status */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-slate-700 text-xs">Attendance Status *</Label>
              <Select value={pastStatus} onValueChange={(val) => setPastStatus(val || "Present")}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Present (Full Day - 9.0 hrs)</SelectItem>
                  <SelectItem value="Half Day">Half Day (4.5 hrs)</SelectItem>
                  <SelectItem value="Leave">Casual / Planned Leave (Paid)</SelectItem>
                  <SelectItem value="Sick Leave">Sick Leave (Paid)</SelectItem>
                  <SelectItem value="Unpaid Leave">Unpaid Leave (LWP)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shift In & Out Times for Present / Half Day */}
            {(pastStatus === "Present" || pastStatus === "Half Day") && (
              <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1">
                  <Label htmlFor="pastIn" className="text-[10px] font-semibold text-slate-600">In Time</Label>
                  <Input
                    id="pastIn"
                    value={pastLoginTime}
                    onChange={(e) => setPastLoginTime(e.target.value)}
                    placeholder="09:30:00 AM"
                    className="text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pastOut" className="text-[10px] font-semibold text-slate-600">Out Time</Label>
                  <Input
                    id="pastOut"
                    value={pastLogoutTime}
                    onChange={(e) => setPastLogoutTime(e.target.value)}
                    placeholder="06:30:00 PM"
                    className="text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pastHrs" className="text-[10px] font-semibold text-slate-600">Total Hours</Label>
                  <Input
                    id="pastHrs"
                    type="number"
                    step={0.5}
                    value={pastHours}
                    onChange={(e) => setPastHours(e.target.value)}
                    placeholder="9.00"
                    className="text-xs bg-white"
                  />
                </div>
              </div>
            )}

            {/* Notes / Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="pastRemarks" className="font-semibold text-slate-700 text-xs">Remarks / Notes</Label>
              <Input
                id="pastRemarks"
                placeholder="e.g. Historical attendance from Aug 1st"
                value={pastRemarks}
                onChange={(e) => setPastRemarks(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLogPastModalOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingPastAttendance}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                {submittingPastAttendance ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Confirm &amp; Log Attendance
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
