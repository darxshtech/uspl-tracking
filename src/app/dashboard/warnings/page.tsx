"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, 
  Send, 
  RefreshCw, 
  Sliders, 
  Clock, 
  UserCheck, 
  CheckCircle2, 
  ShieldAlert, 
  Calendar, 
  Users, 
  ArrowLeft,
  BellRing,
  History
} from "lucide-react";
import { showToast, showSuccess, showError, showWarning } from "@/lib/swal";
import { formatHoursAndMinutes } from "@/lib/timeUtils";
import { playBellChime } from "@/lib/audio";

export default function WarningsManagementPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isManagement = ["Admin", "CEO", "PM"].includes(role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resendingAll, setResendingAll] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);

  const [policyHours, setPolicyHours] = useState<number>(9);
  const [policyInputHours, setPolicyInputHours] = useState<string>("9");
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [todayDate, setTodayDate] = useState<string>("");
  const [incompleteEmployees, setIncompleteEmployees] = useState<any[]>([]);
  const [warningLogs, setWarningLogs] = useState<any[]>([]);

  const fetchWarningsData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/warnings?_=" + Date.now());
      const data = await res.json();
      if (res.ok) {
        setPolicyHours(data.fullDayHours || 9);
        setPolicyInputHours((data.fullDayHours || 9).toString());
        setTodayDate(data.today || "");
        setIncompleteEmployees(data.incompleteEmployees || []);
        setWarningLogs(data.warningLogs || []);
        if (isManual) showToast("Warnings dashboard refreshed!");
      } else {
        if (isManual) showError("Error", data.error || "Failed to load warnings data");
      }
    } catch (err) {
      console.error("Error fetching warnings:", err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWarningsData();
  }, [fetchWarningsData]);

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
        body: JSON.stringify({ full_day_hours: parsed }),
      });
      const data = await res.json();
      if (res.ok) {
        setPolicyHours(parsed);
        setPolicyModalOpen(false);
        showSuccess("Policy Updated", `Required shift working hours set to ${parsed} hours.`);
        fetchWarningsData();
      } else {
        showError("Update Failed", data.error || "Failed to update policy");
      }
    } catch (err) {
      showError("Error", "Could not save policy setting.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleResendWarning = async (employeeId?: number, isAll = false) => {
    if (isAll) setResendingAll(true);
    else if (employeeId) setResendingId(employeeId);

    try {
      const res = await fetch("/api/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employeeId,
          resendAll: isAll,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        playBellChime();
        showSuccess(
          "Warnings Dispatched! 🔔",
          data.message || `Successfully sent shift warnings with notification chime.`
        );
        fetchWarningsData();
      } else {
        showError("Dispatch Failed", data.error || "Could not send warning");
      }
    } catch (err) {
      showError("Error", "Network error while dispatching warnings.");
    } finally {
      if (isAll) setResendingAll(false);
      else setResendingId(null);
    }
  };

  if (!isManagement) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
        Unauthorized: Management role required to access Shift Warnings.
      </div>
    );
  }

  const warningsSentTodayCount = warningLogs.filter((w) => {
    if (!w.created_at || !todayDate) return false;
    return new Date(w.created_at).toISOString().startsWith(todayDate);
  }).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header Card */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-amber-300 hover:text-white text-xs font-bold flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
              </Link>
              <span className="text-slate-500 text-xs">/</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-500/30">
                Shift Compliance
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              Shift & Attendance Warnings Center
            </h1>

            <p className="text-slate-300 text-sm max-w-2xl">
              Audit incomplete shifts (&lt;{policyHours}h), monitor delivery timestamps, and dispatch instant audio chime warnings to affected team members.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Shift Policy Modal */}
            <Dialog open={policyModalOpen} onOpenChange={setPolicyModalOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs gap-1.5 shadow-sm" />}>
                <Sliders className="h-4 w-4 text-amber-400" /> Policy: {policyHours}h / day
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Sliders className="h-5 w-5 text-amber-600" />
                    Configure Full-Day Shift Policy
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSavePolicy} className="space-y-4 pt-2">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <span className="font-bold block">Company Attendance Requirement</span>
                    <p className="text-[11px] text-amber-800 leading-snug">
                      Shifts completed below this threshold will trigger warning banners and alerts for the employee.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="wPolicyHours" className="font-bold text-slate-900 text-xs">
                      Required Full-Day Working Hours (e.g. 9 or 8) *
                    </Label>
                    <Input
                      id="wPolicyHours"
                      type="number"
                      step="0.5"
                      min="1"
                      max="24"
                      value={policyInputHours}
                      onChange={(e) => setPolicyInputHours(e.target.value)}
                      className="text-base font-bold"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={savingPolicy}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 shadow-sm"
                  >
                    {savingPolicy ? "Updating..." : "Save Shift Policy"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              onClick={() => handleResendWarning(undefined, true)}
              disabled={resendingAll || incompleteEmployees.length === 0}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs gap-2 shadow-lg shadow-amber-500/20 px-4 py-2"
            >
              <Send className={`h-4 w-4 ${resendingAll ? "animate-spin" : ""}`} />
              {resendingAll ? "Sending Warnings..." : "Resend Warnings to All"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchWarningsData(true)}
              disabled={refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs gap-1.5 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Incomplete Shifts</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-4">{incompleteEmployees.length}</div>
          <p className="text-xs text-amber-700 font-semibold mt-1">
            Employees &lt;{policyHours}h on previous shift
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Warnings Sent Today</span>
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-200">
              <BellRing className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-4">{warningsSentTodayCount}</div>
          <p className="text-xs text-slate-500 mt-1">Dispatched to employees today</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shift Policy Requirement</span>
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-4">{policyHours}h 00m</div>
          <p className="text-xs text-slate-500 mt-1">Full-day threshold</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Warning History</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <History className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-4">{warningLogs.length}</div>
          <p className="text-xs text-slate-500 mt-1">Logged compliance alerts</p>
        </div>
      </div>

      {/* SECTION 1: Active Incomplete Shifts Requiring Warnings */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Previous Shift Incomplete Records (&lt;{policyHours} Hours)
            </h2>
            <p className="text-xs text-slate-500">
              Employees whose most recent completed shift was marked as a Half Day or under required working hours.
            </p>
          </div>

          <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-3 py-1 rounded-full">
            {incompleteEmployees.length} {incompleteEmployees.length === 1 ? "Employee flagged" : "Employees flagged"}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <Table className="min-w-[850px] w-full">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Employee</TableHead>
                <TableHead className="font-bold">Role</TableHead>
                <TableHead className="font-bold">Shift Date</TableHead>
                <TableHead className="font-bold">Check-In / Out</TableHead>
                <TableHead className="font-bold">Completed Hours</TableHead>
                <TableHead className="font-bold">Deficit</TableHead>
                <TableHead className="font-bold">Warning Status Today</TableHead>
                <TableHead className="font-bold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading shift data...</TableCell></TableRow>
              ) : incompleteEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-10">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      <span className="font-bold text-slate-700">All shifts compliant!</span>
                      <span className="text-xs text-slate-400">All active team members completed their full {policyHours} hours on their last shift.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                incompleteEmployees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-amber-50/40 transition-colors">
                    <TableCell className="font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs border border-amber-300">
                          {emp.name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm">{emp.name}</div>
                          <div className="text-[11px] text-slate-500 font-normal">{emp.email}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="font-semibold text-xs bg-slate-50">
                        {emp.role}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-mono text-xs font-semibold text-slate-700">
                      {emp.shiftDate}
                    </TableCell>

                    <TableCell className="text-xs text-slate-600 font-mono">
                      {emp.loginTime || "—"} → {emp.logoutTime || "—"}
                    </TableCell>

                    <TableCell>
                      <Badge className="bg-amber-500 text-white font-extrabold text-xs">
                        {emp.hoursCompleted.toFixed(2)} hrs (Half Day)
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs font-bold text-red-600">
                      -{emp.shortBy} hrs
                    </TableCell>

                    <TableCell>
                      {emp.warningSentToday ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Sent Today
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold animate-pulse">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Pending Warning
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleResendWarning(emp.id, false)}
                        disabled={resendingId === emp.id}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                      >
                        <Send className={`h-3 w-3 ${resendingId === emp.id ? "animate-spin" : ""}`} />
                        {resendingId === emp.id ? "Sending..." : "Resend Warning"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* SECTION 2: Audit History of Shift Warnings Sent */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="h-5 w-5 text-slate-700" />
              Warning Notifications Dispatch Log
            </h2>
            <p className="text-xs text-slate-500">
              Audit log of all shift policy warning notifications sent to employees with timestamps.
            </p>
          </div>

          <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-3 py-1 rounded-full">
            {warningLogs.length} Records
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <Table className="min-w-[900px] w-full table-fixed">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[180px] font-bold">Recipient Employee</TableHead>
                <TableHead className="w-[200px] font-bold">Warning Title</TableHead>
                <TableHead className="w-[420px] font-bold">Message Delivered</TableHead>
                <TableHead className="w-[170px] font-bold">Dispatched At (IST)</TableHead>
                <TableHead className="w-[140px] font-bold text-right">Read Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading dispatch log...</TableCell></TableRow>
              ) : warningLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-10">
                    No shift warning notifications dispatched yet.
                  </TableCell>
                </TableRow>
              ) : (
                warningLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-bold text-slate-900 align-top py-3.5">
                      <div className="break-words">
                        <div className="text-sm font-bold text-slate-900">
                          {log.employee_name || `User #${log.user_id}`}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal">
                          {log.employee_role || log.target_role || "Employee"}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top py-3.5">
                      <span className="inline-flex items-start gap-1.5 font-bold text-xs text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg break-words whitespace-normal w-full">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span className="leading-tight">{log.title}</span>
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-slate-700 break-words whitespace-normal leading-relaxed align-top py-3.5 pr-4">
                      {log.message}
                    </TableCell>

                    <TableCell className="font-mono text-xs text-slate-600 align-top py-3.5 whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}
                    </TableCell>

                    <TableCell className="text-right align-top py-3.5">
                      {log.is_read ? (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-bold text-[11px]">
                          ✓ Read
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[11px] animate-pulse">
                          ● Unread
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
