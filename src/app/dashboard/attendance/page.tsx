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
import { calculateHoursDifference, getCurrentISTTime12, formatHoursAndMinutes } from "@/lib/timeUtils";
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
  Plus
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
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [currentISTTime, setCurrentISTTime] = useState("");
  const [currentISTDate, setCurrentISTDate] = useState("");

  // Record Leave Modal State (for PM / CEO or self)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveEmpId, setLeaveEmpId] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveType, setLeaveType] = useState("Leave");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // View Record Detail Modal
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    fetchAttendance();
    if (isManagement) {
      fetchEmployees();
    }

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchAttendance();
    }, 25000);
    return () => clearInterval(interval);
  }, [isManagement]);

  const fetchAttendance = async () => {
    try {
      const res = await fetch("/api/attendance?_=" + Date.now());
      const data = await res.json();
      if (data.attendance) {
        setAttendance(data.attendance);
        setCurrentISTTime(data.currentTime || "");
        setCurrentISTDate(data.currentDate || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  // Find user's today record to determine check-in state
  const todayStr = currentISTDate || new Date().toISOString().split("T")[0];
  const userTodayRecord = attendance.find(
    (a) => (String(a.user_id) === String(currentUserId) || String(a.employee_id) === String(currentUserId)) && 
           a.date && a.date.startsWith(todayStr)
  );

  const isCurrentlyCheckedIn = Boolean(userTodayRecord && userTodayRecord.login_time && !userTodayRecord.logout_time);
  const isCurrentlyCheckedOut = Boolean(userTodayRecord && userTodayRecord.logout_time);

  const handlePunch = async (action: "check-in" | "check-out") => {
    if (isCEO || isAdmin) {
      showInfo("Attendance Not Required", "Admin and CEO roles do not require attendance logging.");
      return;
    }

    if (action === "check-in" && isCurrentlyCheckedIn) {
      showInfo("Already Checked In", "You are already checked in for today's shift.");
      return;
    }

    const userId = (session?.user as any)?.id;
    const localNow = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const localDate = new Date().toISOString().split("T")[0];

    setActionLoading(true);
    setFeedback("");

    // Save locally immediately
    const queueKey = `unitglo_offline_queue_${userId || "default"}`;
    const shiftKey = `unitglo_shift_state_${userId || "default"}`;

    try {
      const res = await fetch("/api/attendance/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, offline_time: localNow }),
      });
      const data = await res.json();

      if (res.ok) {
        setFeedback(`✓ ${data.message}`);
        localStorage.setItem(shiftKey, JSON.stringify({
          user_id: userId,
          date: localDate,
          login_time: action === "check-in" ? localNow : "09:30:00 AM",
          logout_time: action === "check-out" ? localNow : null,
          status: "Present",
        }));
        fetchAttendance();
        showToast(action === "check-in" ? "Checked In successfully!" : "Checked Out successfully!");
      } else {
        setFeedback(`⚠️ Error: ${data.error}`);
        showError("Attendance Error", data.error || "Failed to update attendance");
      }
    } catch (err) {
      // Offline fallback: Queue punch in localStorage
      const queueRaw = localStorage.getItem(queueKey) || "[]";
      let queue = [];
      try { queue = JSON.parse(queueRaw); } catch (_) {}

      queue.push({
        action,
        time: localNow,
        date: localDate,
        timestamp: Date.now(),
      });
      localStorage.setItem(queueKey, JSON.stringify(queue));

      localStorage.setItem(shiftKey, JSON.stringify({
        user_id: userId,
        date: localDate,
        login_time: action === "check-in" ? localNow : "09:30:00 AM",
        logout_time: action === "check-out" ? localNow : null,
        status: "Present",
      }));

      setFeedback(`📶 Offline Mode: ${action === "check-in" ? "Check-In" : "Check-Out"} saved locally at ${localNow}. Shift timer will continue running and auto-sync when internet reconnects.`);
      showToast(`Saved offline: ${action === "check-in" ? "Check-In" : "Check-Out"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = (session?.user as any)?.id;
    if (!userId || !leaveStartDate) return;

    setSubmittingLeave(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
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
        fetchAttendance();
        setFeedback(`✓ ${data.message}`);
        showToast("Leave recorded successfully!");
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "calendar"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5 text-sky-500" /> Day-Wise Calendar (Mon-Sun)
            </button>
          </div>

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
              As {role === "Admin" ? "Company Administrator" : "Chief Executive Officer"}, your account is exempt from check-in, check-out, and daily shift logging. You have full oversight into company timesheets, shift policy configuration, and holiday planning below.
            </p>
          </div>
        </div>
      )}

      {/* Employee Daily Attendance Punch Card (for Developer, Tester, PM) */}
      {!isCEO && !isAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-lg">Daily Shift Punch (IST 12-Hour)</h3>
              {isCurrentlyCheckedIn && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold animate-pulse text-xs">
                  ⏱️ In Shift (Checked in: {userTodayRecord?.login_time})
                </Badge>
              )}
              {isCurrentlyCheckedOut && (
                <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-bold text-xs">
                  ✓ Shift Done ({formatHoursAndMinutes(userTodayRecord?.total_hours)})
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Punches are strictly locked to today's date ({currentISTDate || new Date().toISOString().split("T")[0]}). Live shift hours update automatically.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => handlePunch("check-in")}
              disabled={actionLoading || isCurrentlyCheckedIn}
              className={`font-bold px-5 py-2.5 flex items-center gap-2 shadow-md ${
                isCurrentlyCheckedIn
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              <LogIn className="h-4 w-4" /> {isCurrentlyCheckedIn ? "Checked In ✓" : "Check In"}
            </Button>

            <Button
              onClick={() => handlePunch("check-out")}
              disabled={actionLoading || !isCurrentlyCheckedIn}
              className={`font-bold px-5 py-2.5 flex items-center gap-2 shadow-md ${
                !isCurrentlyCheckedIn
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              <LogOut className="h-4 w-4" /> Check Out
            </Button>

            {/* Record / Apply Leave Trigger */}
            <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
              <DialogTrigger render={<Button variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50 font-bold px-4 py-2.5 flex items-center gap-2" />}>
                <Palmtree className="h-4 w-4 text-amber-600" /> Apply Leave
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Palmtree className="h-5 w-5 text-amber-600" /> Apply for Leave / Day Off
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleRecordLeave} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="leaveStartDate" className="font-semibold text-slate-700 text-xs">Start Date *</Label>
                      <Input
                        id="leaveStartDate"
                        type="date"
                        value={leaveStartDate}
                        onChange={(e) => setLeaveStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="leaveEndDate" className="font-semibold text-slate-700 text-xs">End Date *</Label>
                      <Input
                        id="leaveEndDate"
                        type="date"
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 text-xs">Leave Type</Label>
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
                    disabled={submittingLeave}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 mt-2 shadow-md"
                  >
                    {submittingLeave ? "Submitting Leave..." : "Confirm & Save Leave"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
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
          {/* Executive Attendance Manager Section (Shift Policy, Reports, Logs) */}
          {isManagement && <PMAttendanceManager employees={employees} />}

          {/* Attendance History Table */}
          <div className="space-y-3">
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
                            {rec.status === "Present" && <Badge className="bg-emerald-500 text-white font-bold">Present</Badge>}
                            {rec.status === "Half Day" && <Badge className="bg-amber-500 text-white font-bold">Half Day</Badge>}
                            {rec.status === "Leave" && <Badge className="bg-sky-500 text-white font-bold">Leave</Badge>}
                            {rec.status === "Absent" && <Badge className="bg-red-500 text-white font-bold">Absent</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedRecord(rec)}
                              className="text-xs font-semibold gap-1 text-sky-600 hover:bg-sky-50 bg-white"
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
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
    </div>
  );
}
