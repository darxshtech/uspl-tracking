"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, LogIn, LogOut, AlertTriangle, WifiOff, CheckCircle2, Calendar } from "lucide-react";

export default function AttendanceWidget() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [warningModal, setWarningModal] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Check In Modal State
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [manualCheckInTime, setManualCheckInTime] = useState("");

  // Check Out Modal State
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [manualCheckOutTime, setManualCheckOutTime] = useState("");

  const getShiftKey = () => `unitglo_shift_state_${userId || "default"}`;
  const getQueueKey = () => `unitglo_offline_queue_${userId || "default"}`;

  const getCurrent24HourTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const convert24To12Hour = (time24: string) => {
    if (!time24) return "";
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    const hFormatted = h < 10 ? `0${h}` : h;
    return `${hFormatted}:${m}:00 ${ampm}`;
  };

  const getTodayDateStr = () => {
    return new Date().toISOString().split("T")[0];
  };

  // Sync offline queued punches to server
  const syncOfflineQueue = useCallback(async () => {
    if (!userId || typeof window === "undefined") return;

    try {
      const queueRaw = localStorage.getItem(getQueueKey());
      if (!queueRaw) return;

      const queue = JSON.parse(queueRaw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      setSyncStatus("Syncing offline punches...");

      for (const item of queue) {
        await fetch("/api/attendance/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: item.action,
            manual_time: item.manual_time,
            offline_time: item.time,
            targetDate: item.date,
          }),
        });
      }

      localStorage.removeItem(getQueueKey());
      setIsOfflineMode(false);
      setSyncStatus("✓ Offline attendance synced!");
      setTimeout(() => setSyncStatus(null), 4000);
      fetchActiveAttendance();
    } catch (err) {
      console.warn("Sync failed, will retry when connection stabilizes:", err);
    }
  }, [userId]);

  const fetchActiveAttendance = async () => {
    if (!userId) return;

    try {
      const res = await fetch("/api/attendance/active");
      if (!res.ok) throw new Error("Network response not ok");

      const data = await res.json();
      if (data && data.todayRecord !== undefined) {
        if (data.todayRecord) {
          setRecord(data.todayRecord);
          localStorage.setItem(getShiftKey(), JSON.stringify(data.todayRecord));
        } else {
          const localShiftRaw = localStorage.getItem(getShiftKey());
          if (localShiftRaw) {
            const localShift = JSON.parse(localShiftRaw);
            if (localShift.date === getTodayDateStr() && localShift.login_time && !localShift.logout_time) {
              setRecord(localShift);
              setIsOfflineMode(true);
            } else {
              setRecord(null);
            }
          } else {
            setRecord(null);
          }
        }
      }

      syncOfflineQueue();
    } catch (err) {
      setIsOfflineMode(true);
      const localShiftRaw = localStorage.getItem(getShiftKey());
      if (localShiftRaw) {
        try {
          const localShift = JSON.parse(localShiftRaw);
          if (localShift.date === getTodayDateStr()) {
            setRecord(localShift);
          }
        } catch (_) {}
      }
    }
  };

  useEffect(() => {
    if (role === "CEO") return;

    fetchActiveAttendance();
    const interval = setInterval(fetchActiveAttendance, 15000);

    const handleOnline = () => {
      setIsOfflineMode(false);
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOfflineMode(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [role, userId, syncOfflineQueue]);

  const openCheckInDialog = () => {
    setManualCheckInTime(getCurrent24HourTime());
    setCheckInModalOpen(true);
  };

  const openCheckOutDialog = () => {
    setManualCheckOutTime(getCurrent24HourTime());
    setCheckOutModalOpen(true);
  };

  const handleConfirmCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formattedTime12 = convert24To12Hour(manualCheckInTime);
    const localDate = getTodayDateStr();

    // 1. Immediately update Local Storage shift state for offline resilience
    const updatedLocalRecord = {
      user_id: userId,
      date: localDate,
      login_time: formattedTime12,
      logout_time: null,
      status: "Present",
    };
    setRecord(updatedLocalRecord);
    localStorage.setItem(getShiftKey(), JSON.stringify(updatedLocalRecord));

    // 2. Dispatch to API
    try {
      const res = await fetch("/api/attendance/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-in", manual_time: formattedTime12 }),
      });

      if (!res.ok) throw new Error("API request failed");
      setCheckInModalOpen(false);
      fetchActiveAttendance();
    } catch (err) {
      setIsOfflineMode(true);
      const queueRaw = localStorage.getItem(getQueueKey()) || "[]";
      let queue = [];
      try { queue = JSON.parse(queueRaw); } catch (_) {}
      queue.push({
        action: "check-in",
        manual_time: formattedTime12,
        time: formattedTime12,
        date: localDate,
        timestamp: Date.now(),
      });
      localStorage.setItem(getQueueKey(), JSON.stringify(queue));
      setSyncStatus(`Offline check-in saved for ${formattedTime12}`);
      setCheckInModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formattedTime12 = convert24To12Hour(manualCheckOutTime);
    const localDate = getTodayDateStr();

    const updatedLocalRecord = {
      ...record,
      logout_time: formattedTime12,
    };
    setRecord(updatedLocalRecord);
    localStorage.setItem(getShiftKey(), JSON.stringify(updatedLocalRecord));

    try {
      const res = await fetch("/api/attendance/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-out", manual_time: formattedTime12 }),
      });

      if (!res.ok) throw new Error("API request failed");

      const data = await res.json();
      setCheckOutModalOpen(false);

      if (data.isHalfDay) {
        setWarningModal(
          `You have checked out after completing ${data.totalHours} hours today. Your attendance has been logged as HALF DAY (<9 hours required).`
        );
      }
      fetchActiveAttendance();
    } catch (err) {
      setIsOfflineMode(true);
      const queueRaw = localStorage.getItem(getQueueKey()) || "[]";
      let queue = [];
      try { queue = JSON.parse(queueRaw); } catch (_) {}
      queue.push({
        action: "check-out",
        manual_time: formattedTime12,
        time: formattedTime12,
        date: localDate,
        timestamp: Date.now(),
      });
      localStorage.setItem(getQueueKey(), JSON.stringify(queue));
      setSyncStatus(`Offline check-out saved for ${formattedTime12}`);
      setCheckOutModalOpen(false);
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
    <div className="flex items-center gap-2.5">
      {/* Offline Indicator */}
      {isOfflineMode && (
        <Badge
          variant="outline"
          className="text-[10px] font-bold text-amber-700 bg-amber-50 border-amber-300 gap-1 px-2 py-0.5"
          title="Operating in offline mode"
        >
          <WifiOff className="h-3 w-3 text-amber-600" /> Offline Session
        </Badge>
      )}

      {syncStatus && (
        <span className="text-[11px] font-bold text-emerald-600 animate-pulse flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> {syncStatus}
        </span>
      )}

      {/* Early Checkout Warning Modal */}
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

      {/* MANUAL CHECK IN DIALOG */}
      <Dialog open={checkInModalOpen} onOpenChange={setCheckInModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <LogIn className="h-5 w-5 text-emerald-600" />
              Daily Shift Check-In
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfirmCheckIn} className="space-y-3 pt-2">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="flex items-center gap-1 font-bold text-slate-900">
                <Calendar className="h-3.5 w-3.5 text-sky-500" /> Date: Today ({getTodayDateStr()})
              </div>
              <p className="text-slate-500 text-[11px]">
                Enter your exact punch-in time below:
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkInTime" className="font-semibold text-slate-700 text-xs">
                Check-In Time *
              </Label>
              <Input
                id="checkInTime"
                type="time"
                value={manualCheckInTime}
                onChange={(e) => setManualCheckInTime(e.target.value)}
                className="text-base font-bold"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 shadow-sm"
            >
              {loading ? "Checking In..." : "Confirm & Check In"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MANUAL CHECK OUT DIALOG */}
      <Dialog open={checkOutModalOpen} onOpenChange={setCheckOutModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <LogOut className="h-5 w-5 text-slate-900" />
              Daily Shift Check-Out
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfirmCheckOut} className="space-y-3 pt-2">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-slate-900">Shift Started At: {record?.login_time || "N/A"}</div>
              <p className="text-slate-500 text-[11px]">
                Enter your checkout time. Total shift hours will be calculated automatically upon confirmation.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkOutTime" className="font-semibold text-slate-700 text-xs">
                Check-Out Time *
              </Label>
              <Input
                id="checkOutTime"
                type="time"
                value={manualCheckOutTime}
                onChange={(e) => setManualCheckOutTime(e.target.value)}
                className="text-base font-bold"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 shadow-sm"
            >
              {loading ? "Calculating & Checking Out..." : "Confirm & Complete Shift"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status Badge (No countdown timer, clean static indicator) */}
      {isCheckedIn && (
        <Badge
          className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold text-xs py-1 px-2.5 shadow-2xs gap-1.5"
          title={`Checked in at ${record.login_time}`}
        >
          <Clock className="h-3.5 w-3.5 text-emerald-600" />
          <span>In Shift (Since {record.login_time})</span>
        </Badge>
      )}

      {/* Check In Button (Triggers manual time dialog) */}
      {!isCheckedIn && !isCheckedOut && (
        <Button
          size="sm"
          onClick={openCheckInDialog}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
        >
          <LogIn className="h-3.5 w-3.5" /> Check In
        </Button>
      )}

      {/* Check Out Button (Triggers manual time dialog) */}
      {isCheckedIn && (
        <Button
          size="sm"
          onClick={openCheckOutDialog}
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 shadow-sm"
        >
          <LogOut className="h-3.5 w-3.5" /> Check Out
        </Button>
      )}

      {/* Shift Completed Indicator */}
      {isCheckedOut && (
        <Badge variant="outline" className="text-xs font-bold text-slate-700 bg-slate-100 border-slate-300 py-1 px-2.5">
          Shift Done ({record.status || "Present"} {record.total_hours ? `- ${parseFloat(record.total_hours).toFixed(1)} hrs` : ""})
        </Badge>
      )}
    </div>
  );
}
