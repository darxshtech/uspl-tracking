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
import PMAttendanceManager from "@/components/PMAttendanceManager";
import AttendanceCalendarView from "@/components/AttendanceCalendarView";
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
  const isCEO = role === "CEO";
  const isPM = role === "PM";
  const canManageHolidays = isCEO || isPM;

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
    if (isPM || isCEO) {
      fetchEmployees();
    }
  }, [isPM, isCEO]);

  const fetchAttendance = async () => {
    try {
      const res = await fetch("/api/attendance");
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
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePunch = async (action: "check-in" | "check-out") => {
    if (isCEO) {
      alert("CEO role does not require attendance logging.");
      return;
    }

    setActionLoading(true);
    setFeedback("");
    try {
      const res = await fetch("/api/attendance/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (res.ok) {
        setFeedback(`✓ ${data.message}`);
        fetchAttendance();
      } else {
        setFeedback(`⚠️ Error: ${data.error}`);
      }
    } catch (err) {
      setFeedback("An unexpected error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUserId = isPM || isCEO ? parseInt(leaveEmpId) : (session?.user as any)?.id;
    if (!targetUserId || !leaveStartDate) return;

    setSubmittingLeave(true);
    try {
      const res = await fetch("/api/attendance/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: targetUserId,
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

      {/* CEO Executive Exemption Notice */}
      {isCEO && (
        <div className="p-6 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-500 text-white rounded-xl shadow-xs">
            <Crown className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Executive Exemption Policy (CEO)</h3>
            <p className="text-sm text-slate-600 mt-0.5">
              As Chief Executive Officer, your account is exempt from check-in, check-out, and daily shift logging. You have full oversight into company timesheets and holiday planning below.
            </p>
          </div>
        </div>
      )}

      {/* Employee Daily Attendance Punch Card (for Developer & Tester) */}
      {!isCEO && !isPM && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-lg">Daily Shift Punch (IST 12-Hour)</h3>
            <p className="text-xs text-slate-500">
              Punches are strictly locked to today's date ({currentISTDate || new Date().toISOString().split("T")[0]}). Total hours will be calculated automatically upon checkout.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => handlePunch("check-in")}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 flex items-center gap-2 shadow-md"
            >
              <LogIn className="h-4 w-4" /> Check In
            </Button>

            <Button
              onClick={() => handlePunch("check-out")}
              disabled={actionLoading}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 flex items-center gap-2 shadow-md"
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
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Palmtree className="h-5 w-5 text-amber-500" /> Record / Apply Leave
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleRecordLeave} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="leaveStart" className="font-semibold text-slate-700">Start Date *</Label>
                      <Input
                        id="leaveStart"
                        type="date"
                        value={leaveStartDate}
                        onChange={(e) => setLeaveStartDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="leaveEnd" className="font-semibold text-slate-700">End Date</Label>
                      <Input
                        id="leaveEnd"
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
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="leaveNotes" className="font-semibold text-slate-700">Reason / Notes</Label>
                    <Input
                      id="leaveNotes"
                      placeholder="e.g. Medical, personal emergency"
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
          initialEmployeeId={isPM || isCEO ? "ALL" : (session?.user as any)?.id?.toString()}
        />
      )}

      {/* VIEW MODE 2: TABLE LIST VIEW & PM MANAGER */}
      {viewMode === "table" && (
        <>
          {/* PM Executive Attendance Manager Section */}
          {isPM && <PMAttendanceManager employees={employees} />}

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
                    attendance.map((rec) => (
                      <TableRow key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-bold text-slate-900">{rec.employee_name || "N/A"}</TableCell>
                        <TableCell><Badge variant="outline">{rec.employee_role || "N/A"}</Badge></TableCell>
                        <TableCell className="text-xs text-slate-700 font-medium">{new Date(rec.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-800 font-semibold">{rec.login_time || "--:--"}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-800 font-semibold">{rec.logout_time || "--:--"}</TableCell>
                        <TableCell className="font-bold text-slate-900 text-xs">{parseFloat(rec.total_hours || 0).toFixed(2)} hrs</TableCell>
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* Individual Attendance Detail Modal */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Eye className="h-5 w-5 text-sky-500" /> Shift Verification Details
            </DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Employee</span>
                  <span className="text-sm font-black text-slate-900">{selectedRecord.employee_name || "Employee"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Shift Date</span>
                  <span className="text-sm font-semibold text-slate-800">{new Date(selectedRecord.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                  <Badge className={
                    selectedRecord.status === "Present" ? "bg-emerald-500 text-white" :
                    selectedRecord.status === "Half Day" ? "bg-amber-500 text-white" :
                    selectedRecord.status === "Leave" ? "bg-sky-500 text-white" : "bg-red-500 text-white"
                  }>
                    {selectedRecord.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Check-In Time</span>
                  <div className="font-mono text-sm font-bold text-slate-900 mt-1">{selectedRecord.login_time || "Not Recorded"}</div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Check-Out Time</span>
                  <div className="font-mono text-sm font-bold text-slate-900 mt-1">{selectedRecord.logout_time || "Not Recorded"}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/60 flex items-center justify-between">
                <span className="text-xs font-bold text-sky-800 uppercase">Total Shift Duration</span>
                <span className="text-xl font-black text-sky-900">{parseFloat(selectedRecord.total_hours || 0).toFixed(2)} Hours</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
