"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  Play, 
  Pause, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronUp, 
  ChevronDown, 
  Bell, 
  Sparkles, 
  Timer, 
  Check, 
  RotateCcw, 
  Flame,
  MessageSquare,
  Volume2
} from "lucide-react";
import { playBellChime, playReminderAlarmSound } from "@/lib/audio";
import { sendWebPushNotification, requestNotificationPermission, getNotificationPermission } from "@/lib/pushNotification";

interface ActiveTimerData {
  id: number;
  task_id: number;
  task_title: string;
  project_name?: string;
  priority?: string;
  started_at: string;
  is_active: number;
  previous_duration_seconds?: number;
  current_session_seconds?: number;
  progress_percentage?: number;
  daily_summary?: string;
  blockers?: string;
}

export default function ActiveTimerBanner() {
  const [activeTimer, setActiveTimer] = useState<ActiveTimerData | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [currentSessionSecsState, setCurrentSessionSecsState] = useState<number>(0);
  
  // Pause / Finish Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"pause" | "finish">("pause");
  const [sessionSummary, setSessionSummary] = useState("");
  const [blockers, setBlockers] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // 45-Minute Progress Check-In Modal State
  const [progressReminderOpen, setProgressReminderOpen] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [progressSummary, setProgressSummary] = useState("");
  const [progressBlockers, setProgressBlockers] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);
  const [snoozeNotice, setSnoozeNotice] = useState<string | null>(null);
  const [checkinSuccessToast, setCheckinSuccessToast] = useState(false);
  const [secsUntilNextCheckin, setSecsUntilNextCheckin] = useState<number>(2700); // 45 mins default

  const [hasSnoozedCurrentCycle, setHasSnoozedCurrentCycle] = useState(false);
  const hasSnoozedRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckinSecsRef = useRef<number>(0);
  const snoozeUntilTimestampRef = useRef<number>(0);
  const progressReminderOpenRef = useRef<boolean>(false);
  const activeTimerRef = useRef<ActiveTimerData | null>(null);

  // Keep refs in sync
  useEffect(() => {
    progressReminderOpenRef.current = progressReminderOpen;
  }, [progressReminderOpen]);

  useEffect(() => {
    activeTimerRef.current = activeTimer;
    if (activeTimer) {
      if (activeTimer.progress_percentage !== undefined && activeTimer.progress_percentage !== null) {
        setProgressPercentage(Number(activeTimer.progress_percentage));
      }
      if (activeTimer.daily_summary) {
        setProgressSummary(activeTimer.daily_summary);
      }
      if (activeTimer.blockers) {
        setProgressBlockers(activeTimer.blockers);
      }

      // Initialize lastCheckinSecs from localStorage if exists
      const totalSecs = (Number(activeTimer.previous_duration_seconds) || 0) + (Number(activeTimer.current_session_seconds) || 0);
      const storageKey = `unitglo_task_45m_checkin_${activeTimer.task_id}`;
      const savedSecs = localStorage.getItem(storageKey);
      if (savedSecs !== null) {
        const parsed = parseInt(savedSecs, 10);
        if (!isNaN(parsed) && parsed <= totalSecs) {
          lastCheckinSecsRef.current = parsed;
        } else {
          lastCheckinSecsRef.current = 0;
        }
      } else {
        lastCheckinSecsRef.current = 0;
      }

      // Check if one-time snooze was already used in this 45-minute cycle
      const snoozeStorageKey = `unitglo_task_45m_snoozed_${activeTimer.task_id}`;
      const savedSnoozed = localStorage.getItem(snoozeStorageKey) === "true";
      hasSnoozedRef.current = savedSnoozed;
      setHasSnoozedCurrentCycle(savedSnoozed);
    }
  }, [activeTimer]);

  // Repeating sound alarm and flashing tab title until progress is saved
  useEffect(() => {
    if (!progressReminderOpen) return;

    // 1. Play alert chime immediately
    playReminderAlarmSound();

    // 2. Play alert chime continuously every 10 seconds UNTIL developer submits progress or snoozes
    const soundInterval = setInterval(() => {
      playReminderAlarmSound();
    }, 10000);

    // 3. Flash document title to alert developer across browser tabs / windows
    const originalTitle = document.title;
    let titleToggle = false;
    const titleInterval = setInterval(() => {
      titleToggle = !titleToggle;
      document.title = titleToggle
        ? "⏰ [ACTION REQUIRED] Update Task Progress!"
        : "🔔 45-Min Reminder | Unitglo Tracking";
    }, 1200);

    return () => {
      clearInterval(soundInterval);
      clearInterval(titleInterval);
      document.title = originalTitle;
    };
  }, [progressReminderOpen]);

  // Request browser push permission if not requested
  useEffect(() => {
    if (getNotificationPermission() === "default") {
      requestNotificationPermission().catch(() => {});
    }
  }, []);

  // Fetch currently active timer
  const fetchActiveTimer = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/timer?mode=active");
      if (res.ok) {
        const data = await res.json();
        if (data.active_timer) {
          setActiveTimer(data.active_timer);
          const prevSecs = Number(data.active_timer.previous_duration_seconds) || 0;
          const currentSecs = Number(data.active_timer.current_session_seconds) || 0;
          setElapsedSeconds(prevSecs + currentSecs);
          setCurrentSessionSecsState(currentSecs);
        } else {
          setActiveTimer(null);
          setElapsedSeconds(0);
          setCurrentSessionSecsState(0);
          lastCheckinSecsRef.current = 0;
        }
      }
    } catch (err) {
      console.error("Failed to fetch active timer:", err);
    }
  }, []);

  // Poll on mount and listen for custom events
  useEffect(() => {
    fetchActiveTimer();

    const handleTimerChange = () => {
      fetchActiveTimer();
    };

    window.addEventListener("task-timer-updated", handleTimerChange);
    const pollInterval = setInterval(fetchActiveTimer, 30000);

    return () => {
      window.removeEventListener("task-timer-updated", handleTimerChange);
      clearInterval(pollInterval);
    };
  }, [fetchActiveTimer]);

  // Live stopwatch counter (ticks every second, continuing smoothly)
  useEffect(() => {
    if (!activeTimer) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const prevSecs = Number(activeTimer.previous_duration_seconds) || 0;
    const initialSessionSecs = Number(activeTimer.current_session_seconds) || 0;

    const initialSecs = prevSecs + initialSessionSecs;
    setElapsedSeconds(initialSecs);
    setCurrentSessionSecsState(initialSessionSecs);

    const clientStartMs = Date.now() - (initialSessionSecs * 1000);

    timerRef.current = setInterval(() => {
      const nowMs = Date.now();
      const currentSessionSecs = Math.max(0, Math.floor((nowMs - clientStartMs) / 1000));
      const currentElapsedSecs = prevSecs + currentSessionSecs;
      
      setElapsedSeconds(currentElapsedSecs);
      setCurrentSessionSecsState(currentSessionSecs);

      // --- 45-MINUTE REMINDER CADENCE ENGINE (Cumulative Task Elapsed) ---
      const secsSinceLastCheckin = Math.max(0, currentElapsedSecs - lastCheckinSecsRef.current);
      const countdown = Math.max(0, 2700 - secsSinceLastCheckin);
      setSecsUntilNextCheckin(countdown);

      // Trigger condition: 45+ minutes worked since last check-in (2700 seconds) AND snooze has expired
      const isSnoozed = Date.now() < snoozeUntilTimestampRef.current;
      if (
        secsSinceLastCheckin >= 2700 &&
        !isSnoozed &&
        !progressReminderOpenRef.current
      ) {
        // 1. Force un-minimize floating widget
        setIsMinimized(false);

        // 2. Open the interactive Progress Check-In modal (triggers continuous sound loop)
        setProgressReminderOpen(true);

        // 3. Dispatch Desktop/Mobile Web Push Notification
        const currentTask = activeTimerRef.current;
        const taskTitle = currentTask ? currentTask.task_title : "Active Task";
        sendWebPushNotification({
          title: "⏱️ 45-Minute Progress Check-In Reminder",
          body: `You've worked 45+ minutes on "${taskTitle}"! Please update your progress percentage and summary.`,
          tag: `task-reminder-${currentTask?.task_id || "active"}`,
        }).catch(() => {});

        // 4. Log notification in backend notifications table
        if (currentTask?.task_id) {
          fetch("/api/tasks/timer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "notify_reminder",
              task_id: currentTask.task_id,
              elapsed_minutes: Math.round(currentElapsedSecs / 60),
            }),
          }).catch(() => {});
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTimer]);

  const formatStopwatch = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const formatCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const handleOpenModal = (mode: "pause" | "finish") => {
    setModalMode(mode);
    setSessionSummary("");
    setBlockers("");
    setModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTimer) return;

    setSubmitting(true);
    try {
      const action = modalMode === "pause" ? "pause" : "stop";
      const res = await fetch("/api/tasks/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          task_id: activeTimer.task_id,
          session_summary: sessionSummary.trim(),
          blockers: blockers.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setModalOpen(false);
        setActiveTimer(null);
        setSessionSummary("");
        setBlockers("");
        window.dispatchEvent(new Event("task-timer-updated"));
      } else {
        alert(data.error || `Failed to ${modalMode} timer`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error while executing ${modalMode} action.`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Snooze (5 Minutes - Strictly Once per 45-Minute Cadence)
  const handleSnooze = () => {
    if (hasSnoozedRef.current) return; // Only allowed once per cycle!
    hasSnoozedRef.current = true;
    setHasSnoozedCurrentCycle(true);
    if (activeTimer) {
      localStorage.setItem(`unitglo_task_45m_snoozed_${activeTimer.task_id}`, "true");
    }
    snoozeUntilTimestampRef.current = Date.now() + 5 * 60 * 1000; // 5 minutes snooze
    setProgressReminderOpen(false);
    setSnoozeNotice("Reminder snoozed for 5 minutes (One-time snooze used). Progress update required on re-alert!");
    setTimeout(() => setSnoozeNotice(null), 5000);
  };

  // Handle 45-Minute Progress Check-In Save
  const handleSaveProgressCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTimer) return;

    setSavingProgress(true);
    try {
      const res = await fetch("/api/tasks/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progress_checkin",
          task_id: activeTimer.task_id,
          progress_percentage: progressPercentage,
          session_summary: progressSummary.trim(),
          blockers: progressBlockers.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // If 100% progress was recorded, task is finished!
        if (data.is_completed || progressPercentage === 100) {
          setActiveTimer(null);
          setProgressReminderOpen(false);
          setCheckinSuccessToast(true);
          localStorage.removeItem(`unitglo_task_45m_checkin_${activeTimer.task_id}`);
          localStorage.removeItem(`unitglo_task_45m_snoozed_${activeTimer.task_id}`);
          setTimeout(() => setCheckinSuccessToast(false), 5000);
          window.dispatchEvent(new Event("task-timer-updated"));
          return;
        }

        // Reset 45-minute milestone tracking for this task
        const currentTotalElapsed = elapsedSeconds;
        lastCheckinSecsRef.current = currentTotalElapsed;
        const storageKey = `unitglo_task_45m_checkin_${activeTimer.task_id}`;
        localStorage.setItem(storageKey, String(currentTotalElapsed));
        snoozeUntilTimestampRef.current = 0;

        // Reset one-time snooze state for the next 45-minute cycle
        hasSnoozedRef.current = false;
        setHasSnoozedCurrentCycle(false);
        localStorage.removeItem(`unitglo_task_45m_snoozed_${activeTimer.task_id}`);

        // Update local activeTimer representation
        setActiveTimer((prev) => prev ? {
          ...prev,
          progress_percentage: progressPercentage,
          daily_summary: progressSummary.trim(),
          blockers: progressBlockers.trim(),
        } : null);

        // Closes modal and automatically terminates repeating sound alarm
        setProgressReminderOpen(false);
        setCheckinSuccessToast(true);
        setTimeout(() => setCheckinSuccessToast(false), 4500);
        window.dispatchEvent(new Event("task-timer-updated"));
      } else {
        alert(data.error || "Failed to save progress check-in");
      }
    } catch (err) {
      console.error("Progress check-in error:", err);
      alert("An unexpected error occurred while saving progress.");
    } finally {
      setSavingProgress(false);
    }
  };


  if (!activeTimer) return null;

  return (
    <>
      {/* Toast Confirmation when Progress is Saved */}
      {checkinSuccessToast && (
        <div className="fixed top-5 right-5 z-[60] flex items-center gap-2.5 px-4 py-3 bg-emerald-950/90 text-emerald-200 border border-emerald-500/50 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-white">45-Min Progress Saved!</p>
            <p className="text-emerald-300">Next 45-minute reminder countdown has been reset.</p>
          </div>
        </div>
      )}

      {/* Snooze Notice Toast */}
      {snoozeNotice && (
        <div className="fixed top-5 right-5 z-[60] flex items-center gap-2.5 px-4 py-3 bg-slate-900/90 text-amber-200 border border-amber-500/40 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3">
          <Clock className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs font-medium text-slate-200">{snoozeNotice}</p>
        </div>
      )}

      {/* Floating Active Timer Widget */}
      <div 
        className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
          isMinimized ? "w-auto" : "w-80 sm:w-[410px]"
        } rounded-2xl bg-slate-900/95 backdrop-blur-md text-white border border-slate-700 shadow-2xl overflow-hidden`}
      >
        {isMinimized ? (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono font-bold text-xs text-emerald-400 tracking-wider">
              {formatStopwatch(elapsedSeconds)}
            </span>
            
            {/* Quick 45m check-in button even when minimized */}
            <button
              onClick={() => {
                setIsMinimized(false);
                setProgressReminderOpen(true);
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                secsUntilNextCheckin === 0
                  ? "bg-rose-500/30 hover:bg-rose-500/40 text-rose-200 border border-rose-500/50 animate-pulse"
                  : "bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40"
              }`}
              title="Update Progress (45m Check-in)"
            >
              <Bell className="h-3 w-3" />
              {secsUntilNextCheckin === 0 ? "⏰ 45m Due!" : formatCountdown(secsUntilNextCheckin)}
            </button>

            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Expand Timer"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-3.5 space-y-2.5">
            {/* Header with status and collapse */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Active Task Timer
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Minimize"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Task Info & Progress Overview */}
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm text-white truncate flex-1" title={activeTimer.task_title}>
                  {activeTimer.task_title}
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {progressPercentage}% Done
                </span>
              </div>
              {activeTimer.project_name && (
                <p className="text-[11px] text-slate-400 truncate">
                  📁 {activeTimer.project_name}
                </p>
              )}
            </div>

            {/* Live Counter & 45-Min Reminder Badge */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono font-bold text-sm text-emerald-300 tracking-wider">
                  {formatStopwatch(elapsedSeconds)}
                </span>
              </div>

              {/* 45-Min Cadence Status Button */}
              <button
                type="button"
                onClick={() => setProgressReminderOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  secsUntilNextCheckin === 0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 animate-pulse"
                    : "bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/20"
                }`}
                title="Click to update task progress manually anytime"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>
                  {secsUntilNextCheckin === 0 ? "45m Check-in Due!" : `Next check-in: ${formatCountdown(secsUntilNextCheckin)}`}
                </span>
              </button>
            </div>

            {/* Quick Action Buttons: Pause, Finish, & Check-In */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleOpenModal("pause")}
                className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium flex items-center justify-center gap-1 transition"
                title="Pause task to take a break"
              >
                <Pause className="h-3 w-3" />
                Break
              </button>

              <button
                type="button"
                onClick={() => setProgressReminderOpen(true)}
                className="px-2 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600/40 text-sky-200 border border-sky-500/40 text-xs font-semibold flex items-center justify-center gap-1 transition"
                title="Submit 45-min progress update"
              >
                <MessageSquare className="h-3 w-3 text-sky-400" />
                Progress
              </button>

              <button
                type="button"
                onClick={() => handleOpenModal("finish")}
                className="px-2 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-1 transition"
                title="Finish and lock task hours"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Finish
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 45-MINUTE PROGRESS CHECK-IN MODAL */}
      {progressReminderOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-sky-500/40 rounded-2xl shadow-2xl p-5 sm:p-6 text-white space-y-4">
            {/* Modal Header (No dismiss/close button - must take action) */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Volume2 className="h-5 w-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    45-Minute Progress Check-In
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/40 animate-pulse">
                      Alarm Ringing
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Chiming continuously until progress is updated and saved.
                  </p>
                </div>
              </div>
            </div>

            {/* Sound Alarm Active Banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <div className="text-xs">
                  <p className="font-bold text-rose-200 flex items-center gap-1.5">
                    🔊 Sound Alarm Active
                  </p>
                  <p className="text-[11px] text-rose-300/80">
                    Audio chime sounds continuously every 10 seconds until task progress is saved.
                  </p>
                </div>
              </div>
            </div>

            {/* Task Info Pill */}
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/70 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Working On:</span>
                <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatStopwatch(elapsedSeconds)}
                </span>
              </div>
              <p className="font-semibold text-sm text-white truncate">
                {activeTimer.task_title}
              </p>
              {activeTimer.project_name && (
                <p className="text-[11px] text-slate-400">
                  Project: {activeTimer.project_name}
                </p>
              )}
            </div>

            <form onSubmit={handleSaveProgressCheckin} className="space-y-4">
              {/* Progress Percentage Slider & Quick Buttons */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">
                    Task Progress:
                  </label>
                  <span className="text-sm font-extrabold text-sky-400 font-mono">
                    {progressPercentage}%
                  </span>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressPercentage}
                  onChange={(e) => setProgressPercentage(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />

                {/* Preset Chips */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  {[0, 25, 50, 75, 90, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setProgressPercentage(preset)}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                        progressPercentage === preset
                          ? "bg-sky-500 text-white shadow-sm"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Accomplishment / Summary Input */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  What did you complete in this session? *
                </label>
                <textarea
                  value={progressSummary}
                  onChange={(e) => setProgressSummary(e.target.value)}
                  placeholder="e.g., Implemented UI components, verified API responses, resolved edge cases..."
                  required
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
                />
              </div>

              {/* Blockers or Next Step Input */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Any blockers, impediments, or next step? (Optional)
                </label>
                <input
                  type="text"
                  value={progressBlockers}
                  onChange={(e) => setProgressBlockers(e.target.value)}
                  placeholder="e.g., Waiting for API review, all good, ready for testing..."
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* 100% Completion Celebration Banner */}
              {progressPercentage === 100 && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-pulse">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">
                    🎉 100% Completion: Saving will finish this task, mark status as Completed, and stop the active timer!
                  </span>
                </div>
              )}

              {/* Actions: Snooze 5 Min (Strictly Once) and Save Progress */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <div>
                  {!hasSnoozedCurrentCycle && progressPercentage < 100 ? (
                    <button
                      type="button"
                      onClick={handleSnooze}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                      title="Snooze reminder for 5 minutes (One-time use only)"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Snooze (5 Mins - Once Only)
                    </button>
                  ) : hasSnoozedCurrentCycle && progressPercentage < 100 ? (
                    <div className="text-[11px] text-amber-300/90 font-medium flex items-center gap-1.5 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/25">
                      <span>⚠️ 5-Min Snooze already used. You must submit progress!</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="submit"
                    disabled={savingProgress}
                    className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                      progressPercentage === 100
                        ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 ring-2 ring-emerald-400"
                        : "bg-sky-600 hover:bg-sky-500 shadow-sky-600/30"
                    }`}
                  >
                    {savingProgress ? (
                      <>Saving...</>
                    ) : progressPercentage === 100 ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Finish Task (100% Completed)
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Save Progress & Stop Alarm
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog for Pause vs Finish */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                {modalMode === "pause" ? (
                  <>
                    <Pause className="h-4 w-4 text-amber-500 fill-amber-500" />
                    Pause Timer (Go on Break)
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Finish & Complete Task
                  </>
                )}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className={`p-3 rounded-xl border text-xs space-y-1 ${
              modalMode === "pause" ? "bg-amber-50/70 border-amber-200" : "bg-emerald-50/70 border-emerald-200"
            }`}>
              <div className="font-semibold text-slate-800">{activeTimer.task_title}</div>
              <div className="text-slate-600 flex items-center justify-between">
                <span>Current Session Time:</span>
                <span className="font-mono font-bold text-slate-900">{formatStopwatch(elapsedSeconds)}</span>
              </div>
              <div className="text-[11px] pt-1 text-slate-500">
                {modalMode === "pause"
                  ? "⏸ This session will be paused. The task remains In Progress and you can Resume anytime."
                  : "🔒 This will mark the task Completed (100%) and record your total hours into 'Hours Spent Today' as locked and unchangeable."}
              </div>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {modalMode === "pause" ? "Work Done Before Break (Optional)" : "Task Accomplishment Summary *"}
                </label>
                <textarea
                  value={sessionSummary}
                  onChange={(e) => setSessionSummary(e.target.value)}
                  placeholder={
                    modalMode === "pause"
                      ? "Brief summary of work completed before pausing..."
                      : "Detailed summary of deliverables and completed work..."
                  }
                  required={modalMode === "finish"}
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {modalMode === "pause" ? "Blockers / Break Notes (Optional)" : "Remaining Items / Notes (Optional)"}
                </label>
                <input
                  type="text"
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder={
                    modalMode === "pause" ? "e.g., Lunch break / Tea break / Meeting" : "e.g., Tested and ready for QA"
                  }
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                    modalMode === "pause"
                      ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {submitting
                    ? "Saving..."
                    : modalMode === "pause"
                    ? "Confirm Pause (Break)"
                    : "Finish Task & Lock Hours"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

