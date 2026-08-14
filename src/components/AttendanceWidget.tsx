"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, LogIn, LogOut, AlertTriangle, WifiOff, CloudSync, CheckCircle2 } from "lucide-react";

export default function AttendanceWidget() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const [record, setRecord] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState("00h 00m 00s");
  const [loading, setLoading] = useState(false);
  const [warningModal, setWarningModal] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const getShiftKey = () => `unitglo_shift_state_${userId || "default"}`;
  const getQueueKey = () => `unitglo_offline_queue_${userId || "default"}`;

  const getLocal12HourTime = () => {
    return new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
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
          // Update local storage backup
          localStorage.setItem(getShiftKey(), JSON.stringify(data.todayRecord));
        } else {
          // If server says no record, verify if local offline active punch exists
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

      // Check if there are queued offline punches to sync
      syncOfflineQueue();
    } catch (err) {
      // Offline fallback: load from local storage
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
    const interval = setInterval(fetchActiveAttendance, 12000);

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

  // Live timer for hours elapsed since check-in (runs continuously offline or online)
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

  const handlePunch = async (action: "check-in" | "check-out") => {
    setLoading(true);
    const localNow = getLocal12HourTime();
    const localDate = getTodayDateStr();

    // 1. Immediately update Local Storage shift state for resilience
    let updatedLocalRecord: any = { ...record };
    if (action === "check-in") {
      updatedLocalRecord = {
        user_id: userId,
        date: localDate,
        login_time: localNow,
        logout_time: null,
        status: "Present",
      };
      setRecord(updatedLocalRecord);
      localStorage.setItem(getShiftKey(), JSON.stringify(updatedLocalRecord));
    } else {
      updatedLocalRecord = {
        ...updatedLocalRecord,
        logout_time: localNow,
      };
      setRecord(updatedLocalRecord);
      localStorage.setItem(getShiftKey(), JSON.stringify(updatedLocalRecord));
    }

    // 2. Attempt online API dispatch
    try {
      const res = await fetch("/api/attendance/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, offline_time: localNow }),
      });

      if (!res.ok) throw new Error("API request failed");

      const data = await res.json();
      if (data.isHalfDay) {
        setWarningModal(
          `You have checked out after completing ${data.totalHours} hours today. Your attendance has been logged as HALF DAY (<9 hours required).`
        );
      }
      fetchActiveAttendance();
    } catch (err) {
      // 3. Network Failure / Offline Fallback -> Queue punch in localStorage
      setIsOfflineMode(true);
      const queueRaw = localStorage.getItem(getQueueKey()) || "[]";
      let queue = [];
      try {
        queue = JSON.parse(queueRaw);
      } catch (_) {}

      queue.push({
        action,
        time: localNow,
        date: localDate,
        timestamp: Date.now(),
      });

      localStorage.setItem(getQueueKey(), JSON.stringify(queue));
      setSyncStatus(`Offline: ${action === "check-in" ? "Check-in" : "Check-out"} saved locally at ${localNow}`);
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
      {/* Offline Status or Sync Indicator */}
      {isOfflineMode && (
        <Badge
          variant="outline"
          className="text-[10px] font-bold text-amber-700 bg-amber-50 border-amber-300 gap-1 px-2 py-0.5"
          title="Internet disconnected. Check-in time is actively running in localStorage fallback."
        >
          <WifiOff className="h-3 w-3 text-amber-600" /> Offline Session
        </Badge>
      )}

      {syncStatus && (
        <span className="text-[11px] font-bold text-emerald-600 animate-pulse flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> {syncStatus}
        </span>
      )}

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

      {/* Live Timer Display if Checked In (Continues ticking offline and online) */}
      {isCheckedIn && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold shadow-xs border ${
            isOfflineMode
              ? "bg-amber-50 border-amber-300 text-amber-900"
              : "bg-sky-50 border-sky-200 text-sky-900"
          }`}
          title={isOfflineMode ? "Running via Local Storage Offline Session" : "Live Shift Timer"}
        >
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
          Shift Done ({record.status || "Present"} {record.total_hours ? `- ${parseFloat(record.total_hours).toFixed(1)} hrs` : ""})
        </Badge>
      )}
    </div>
  );
}
