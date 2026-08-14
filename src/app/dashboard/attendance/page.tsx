"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import PMAttendanceManager from "@/components/PMAttendanceManager";
import { 
  CalendarDays, 
  LogIn, 
  LogOut, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Crown 
} from "lucide-react";

export default function AttendancePage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isCEO = role === "CEO";
  const isPM = role === "PM";

  const [attendance, setAttendance] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [currentISTTime, setCurrentISTTime] = useState("");
  const [currentISTDate, setCurrentISTDate] = useState("");

  useEffect(() => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-sky-500" />
            Attendance & Work Shift Engine
          </h1>
          <p className="text-slate-500 mt-1">
            Official India Standard Time (IST) 12-Hour Daily Shift Tracking & Verification.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-mono font-semibold shadow-xs">
          <Clock className="h-4 w-4 text-sky-400" />
          <span>India Time (IST): {currentISTTime || new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* CEO Executive Exemption Notice */}
      {isCEO && (
        <div className="p-6 rounded-2xl border border-sky-200 bg-linear-to-r from-sky-50 to-indigo-50 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-500 text-white rounded-xl shadow-xs">
            <Crown className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Executive Exemption Policy (CEO)</h3>
            <p className="text-sm text-slate-600 mt-0.5">
              As Chief Executive Officer, your account is exempt from check-in, check-out, and daily shift logging. You have full executive visibility into all company attendance records below.
            </p>
          </div>
        </div>
      )}

      {/* PM Executive Attendance Manager Section */}
      {isPM && <PMAttendanceManager employees={employees} />}

      {/* Employee Daily Attendance Punch Card (for Developer & Tester) */}
      {!isCEO && !isPM && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-lg">Daily Shift Punch (IST 12-Hour)</h3>
            <p className="text-xs text-slate-500">
              Punches are strictly locked to today's date ({currentISTDate || new Date().toISOString().split("T")[0]}). Total hours will be calculated automatically upon checkout.
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading records...</TableCell></TableRow>
              ) : attendance.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-10">No attendance records logged.</TableCell></TableRow>
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
