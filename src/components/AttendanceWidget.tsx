"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, LogIn, LogOut, AlertTriangle, CheckCircle } from "lucide-react";

export default function AttendanceWidget() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const [record, setRecord] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState("00h 00m 00s");
  const [loading, setLoading] = useState(false);
  const [warningModal, setWarningModal] = useState<string | null>(null);

  useEffect(() => {
    if (role === "CEO") return;
    fetchActiveAttendance();
    const interval = setInterval(fetchActiveAttendance, 15000);
    return () => clearInterval(interval);
  }, [role]);

  // Live timer for hours elapsed since check-in
  useEffect(() => {
    if (!record || !record.login_time || record.logout_time) {
      setElapsedTime("00h 00m 00s");
      return;
    }

    const parseTimeToDate = (timeStr: string) => {
      const now = new Date();
      const is12Hour = /am|pm/i.test(timeStr);
      if (is12Hour) {
        const parts = timeStr.trim().split(/[:\s]/);
        let h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) || 0;
        const s = parseInt(parts[2], 10) || 0;
        const meridian = (parts[parts.length - 1] || "").toUpperCase();

        if (meridian === "PM" && h < 12) h += 12;
        if (meridian === "AM" && h === 12) h = 0;

        now.setHours(h, m, s, 0);
        return now;
      } else {
        const [h, m, s] = timeStr.split(":").map(Number);
        now.setHours(h, m, s || 0, 0);
        return now;
      }
    };

    const timer = setInterval(() => {
      const loginDate = parseTimeToDate(record.login_time);
      const now = new Date();
      const diffMs = Math.max(0, now.getTime() - loginDate.getTime());

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

      const pad = (n: number) => n.toString().padStart(2, "0");
      setElapsedTime(`${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [record]);

  const fetchActiveAttendance = async () => {
    try {
      const res = await fetch("/api/attendance/active");
      const data = await res.json();
      if (data && data.todayRecord !== undefined) {
        setRecord(data.todayRecord);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePunch = async (action: "check-in" | "check-out") => {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.isHalfDay) {
          setWarningModal(`You have checked out after completing ${data.totalHours} hours today. Your attendance has been logged as HALF DAY (<9 hours required).`);
        }
        fetchActiveAttendance();
      } else {
        alert(data.error || "Punch action failed.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // CEO Role is exempt from attendance tracking
  if (role === "CEO") {
    return null;
  }

  const isCheckedIn = record && record.login_time && !record.logout_time;
  const isCheckedOut = record && record.logout_time;

  return (
    <div className="flex items-center gap-3">
      {/* Early Checkout (< 9 Hours) Warning Dialog */}
      <Dialog open={!!warningModal} onOpenChange={() => setWarningModal(null)}>
        <DialogContent className="border-amber-200 bg-amber-50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800 font-bold">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Early Checkout Notice (&lt; 9 Hours)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs text-amber-900">
            <p className="font-medium">{warningModal}</p>
            <div className="p-2.5 bg-white rounded-lg border border-amber-200 text-amber-800">
              Shift marked as <strong>Half Day</strong>. PM has been notified.
            </div>
            <Button
              onClick={() => setWarningModal(null)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Live Timer Display if Checked In */}
      {isCheckedIn && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-xs font-mono font-bold shadow-xs">
          <Clock className="h-3.5 w-3.5 text-sky-500 animate-spin" />
          <span>{elapsedTime}</span>
        </div>
      )}

      {/* Check In Button */}
      {!isCheckedIn && !isCheckedOut && (
        <Button
          size="sm"
          onClick={() => handlePunch("check-in")}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
        >
          <LogIn className="h-3.5 w-3.5" /> Check In
        </Button>
      )}

      {/* Check Out Button */}
      {isCheckedIn && (
        <Button
          size="sm"
          onClick={() => handlePunch("check-out")}
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 shadow-sm"
        >
          <LogOut className="h-3.5 w-3.5" /> Check Out
        </Button>
      )}

      {/* Shift Completed Indicator */}
      {isCheckedOut && (
        <Badge variant="outline" className="text-xs font-bold text-slate-700 bg-slate-100 border-slate-300 py-1 px-2.5">
          Shift Done ({record.status} - {parseFloat(record.total_hours || 0).toFixed(1)} hrs)
        </Badge>
      )}
    </div>
  );
}
