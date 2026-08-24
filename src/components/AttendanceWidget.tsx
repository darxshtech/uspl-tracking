"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Clock, 
  LogIn, 
  LogOut, 
  AlertTriangle, 
  WifiOff, 
  CheckCircle2, 
  Calendar, 
  Moon, 
  Info 
} from "lucide-react";

export default function AttendanceWidget() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const [record, setRecord] = useState<any>(null);
  const [yesterdayHalfDay, setYesterdayHalfDay] = useState<any>(null);
  const [fullDayHours, setFullDayHours] = useState<number>(9);
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
  const [isOvernight, setIsOvernight] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const getShiftKey = () => `unitglo_shift_state_${userId || "default"}`;
  const getQueueKey = () => `unitglo_offline_queue_${userId || "default"}`;

  const getCurrent24HourTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getMaxAllowedCheckout24HourTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
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
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
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
            is_overnight: item.is_overnight,
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
      if (data) {
        if (data.fullDayHours) setFullDayHours(data.fullDayHours);
        if (data.yesterdayHalfDay) setYesterdayHalfDay(data.yesterdayHalfDay);
        else setYesterdayHalfDay(null);

        if (data.todayRecord !== undefined) {
          if (data.todayRecord) {
            setRecord(data.todayRecord);
            localStorage.setItem(getShiftKey(), JSON.stringify(data.todayRecord));
          } else {
            setRecord(null);
            localStorage.removeItem(getShiftKey());
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
          setRecord(localShift);
        } catch (_) {}
      }
    }
  };

  useEffect(() => {
    if (role === "CEO" || role === "Admin") return;

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
    const current24 = getCurrent24HourTime();
    setManualCheckOutTime(current24);
    setCheckoutError(null);

    // Auto-detect overnight if shift date was yesterday
    const recordDateStr = record?.date ? String(record.date).split("T")[0] : "";
    if (recordDateStr && recordDateStr < getTodayDateStr()) {
      setIsOvernight(true);
    } else {
      setIsOvernight(false);
    }

    setCheckOutModalOpen(true);
  };

  const handleConfirmCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formattedTime12 = convert24To12Hour(manualCheckInTime);
    const localDate = getTodayDateStr();

    const updatedLocalRecord = {
      user_id: userId,
      date: localDate,
      login_time: formattedTime12,
      logout_time: null,
      status: "Present",
    };
    setRecord(updatedLocalRecord);
    localStorage.setItem(getShiftKey(), JSON.stringify(updatedLocalRecord));

    try {
      const res = await fetch("/api/attendance/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-in", manual_time: formattedTime12 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Check-in failed");
      }
      setCheckInModalOpen(false);
      fetchActiveAttendance();
    } catch (err: any) {
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
    setCheckoutError(null);

    const formattedTime12 = convert24To12Hour(manualCheckOutTime);
    const localDate = getTodayDateStr();

    // Validate 30-minute meeting buffer
    if (!isOvernight && record?.date === localDate) {
      const now = new Date();
      const [h, m] = manualCheckOutTime.split(":").map(Number);
      const selected = new Date();
      selected.setHours(h, m, 0, 0);

      const maxLimit = new Date(now.getTime() + 30 * 60 * 1000);
      if (selected > maxLimit) {
        setCheckoutError("Check-out time can only be set up to 30 minutes in advance of current time.");
        return;
      }
    }

    setLoading(true);

    const updatedLocalRecord = {
      ...record,
      logout_time: formattedTime12,
    };
    setRecord(updatedLocalRecord);
    localStorage.setItem(getShiftKey(), JSON.stringify(updatedLocalRecord));

    const recordDateStr = record?.date ? String(record.date).split("T")[0] : "";
    const isShiftOvernight = isOvernight || (Boolean(recordDateStr) && recordDateStr < localDate);

    try {
      const res = await fetch("/api/attendance/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "check-out", 
          manual_time: formattedTime12,
          is_overnight: isShiftOvernight,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Check-out failed");
      }

      setCheckOutModalOpen(false);

      if (data.isHalfDay) {
        setWarningModal(
          `You completed ${data.totalHours} hours today. Recorded as HALF DAY (<${data.fullDayHours || fullDayHours} hours required).`
        );
      }
      fetchActiveAttendance();
    } catch (err: any) {
      if (err.message && err.message.includes("30 minutes")) {
        setCheckoutError(err.message);
      } else {
        setIsOfflineMode(true);
        const queueRaw = localStorage.getItem(getQueueKey()) || "[]";
        let queue = [];
        try { queue = JSON.parse(queueRaw); } catch (_) {}
        queue.push({
          action: "check-out",
          manual_time: formattedTime12,
          time: formattedTime12,
          date: localDate,
          is_overnight: isShiftOvernight,
          timestamp: Date.now(),
        });
        localStorage.setItem(getQueueKey(), JSON.stringify(queue));
        setSyncStatus(`Offline check-out saved for ${formattedTime12}`);
        setCheckOutModalOpen(false);
      }
    } finally {
      setLoading(false);
    }
  };

  if (role === "CEO" || role === "Admin") {
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

      {/* Early Checkout Notice */}
      <Dialog open={!!warningModal} onOpenChange={() => setWarningModal(null)}>
        <DialogContent className="border-amber-200 bg-amber-50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800 font-bold">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Early Checkout Notice (&lt; {fullDayHours} Hours)
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
        <DialogContent className="w-[92vw] sm:max-w-sm max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <LogIn className="h-5 w-5 text-emerald-600" />
              Daily Shift Check-In
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfirmCheckIn} className="space-y-3 pt-2">
            {/* Yesterday / Previous Shift Half Day Warning Alert */}
            {yesterdayHalfDay && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Previous Shift Notice: Half Day</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                  Your shift on <strong>{yesterdayHalfDay.date}</strong> was marked as <strong>Half Day</strong> ({parseFloat(yesterdayHalfDay.hours).toFixed(1)} hrs completed, &lt;{fullDayHours} hrs required).
                </p>
                <div className="text-[11px] font-bold text-amber-900 bg-amber-100/80 px-2 py-1 rounded-lg border border-amber-200 mt-1">
                  ⏱️ Make sure to complete your required {fullDayHours} hours today!
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="flex items-center gap-1 font-bold text-slate-900">
                <Calendar className="h-3.5 w-3.5 text-sky-500" /> Date: Today ({getTodayDateStr()})
              </div>
              <p className="text-slate-500 text-[11px]">
                Required working hours: <strong>{fullDayHours} hrs</strong>. Enter your punch-in time below:
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

      {/* MANUAL CHECK OUT DIALOG (+30 Min Buffer & Overnight Support) */}
      <Dialog open={checkOutModalOpen} onOpenChange={setCheckOutModalOpen}>
        <DialogContent className="w-[92vw] sm:max-w-sm max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <LogOut className="h-5 w-5 text-slate-900" />
              Daily Shift Check-Out
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfirmCheckOut} className="space-y-3 pt-2">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-slate-900">Shift Started: {record?.date} at {record?.login_time || "N/A"}</div>
              <div className="text-[11px] text-sky-700 font-medium flex items-center gap-1 pt-0.5">
                <Info className="h-3 w-3 text-sky-500" />
                <span>You can add out time up to <strong>+30 mins</strong> in advance for meetings.</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="checkOutTime" className="font-semibold text-slate-700 text-xs">
                  Check-Out Time *
                </Label>
                <span className="text-[10px] text-slate-500">Max limit: {getMaxAllowedCheckout24HourTime()}</span>
              </div>
              <Input
                id="checkOutTime"
                type="time"
                value={manualCheckOutTime}
                onChange={(e) => {
                  setManualCheckOutTime(e.target.value);
                  setCheckoutError(null);
                }}
                className="text-base font-bold"
                required
              />
            </div>

            {/* Overnight / Crossed Midnight Shift Option */}
            <div className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/70 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-900">
                <input
                  type="checkbox"
                  checked={isOvernight}
                  onChange={(e) => setIsOvernight(e.target.checked)}
                  className="rounded border-indigo-300 text-indigo-600 h-3.5 w-3.5"
                />
                <span className="flex items-center gap-1">
                  <Moon className="h-3.5 w-3.5 text-indigo-600" />
                  Overnight Shift (Checked out after 12:00 AM midnight)
                </span>
              </label>
              <p className="text-[10px] text-indigo-700 leading-tight">
                Enable this if you started your shift earlier and worked past midnight (e.g. 8:00 AM to 1:00 AM).
              </p>
            </div>

            {checkoutError && (
              <div className="p-2 rounded bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

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

      {/* Clean Status Badge */}
      {isCheckedIn && (
        <Badge
          className={`font-bold text-[11px] sm:text-xs py-1 px-2 sm:px-2.5 shadow-2xs gap-1 sm:gap-1.5 ${
            record.isOvernightShift
              ? "bg-indigo-50 text-indigo-800 border-indigo-300"
              : "bg-emerald-50 text-emerald-800 border-emerald-300"
          }`}
          title={`Shift from ${record.date} at ${record.login_time}`}
        >
          {record.isOvernightShift ? (
            <Moon className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-emerald-600" />
          )}
          <span>
            <span className="hidden sm:inline">In Shift </span>
            ({record.login_time}{record.isOvernightShift ? " 🌙" : ""})
          </span>
        </Badge>
      )}

      {/* Check In Button */}
      {!isCheckedIn && !isCheckedOut && (
        <Button
          size="sm"
          onClick={openCheckInDialog}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 sm:gap-1.5 shadow-sm px-2.5 sm:px-3"
        >
          <LogIn className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Check </span>In
        </Button>
      )}

      {/* Check Out Button */}
      {isCheckedIn && (
        <Button
          size="sm"
          onClick={openCheckOutDialog}
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1 sm:gap-1.5 shadow-sm px-2.5 sm:px-3"
        >
          <LogOut className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Check </span>Out
        </Button>
      )}

      {/* Shift Completed Indicator */}
      {isCheckedOut && (
        <Badge variant="outline" className="text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-100 border-slate-300 py-1 px-2 sm:px-2.5">
          <span className="hidden sm:inline">Shift </span>Done {record.total_hours ? `(${parseFloat(record.total_hours).toFixed(1)}h)` : ""}
        </Badge>
      )}
    </div>
  );
}
