"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Play, Pause, Clock, AlertCircle, CheckCircle2, ChevronUp, ChevronDown } from "lucide-react";

interface ActiveTimerData {
  id: number;
  task_id: number;
  task_title: string;
  project_name?: string;
  priority?: string;
  started_at: string;
  is_active: number;
}

export default function ActiveTimerBanner() {
  const [activeTimer, setActiveTimer] = useState<ActiveTimerData | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"pause" | "finish">("pause");
  const [sessionSummary, setSessionSummary] = useState("");
  const [blockers, setBlockers] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch currently active timer
  const fetchActiveTimer = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/timer?mode=active");
      if (res.ok) {
        const data = await res.json();
        if (data.active_timer) {
          setActiveTimer(data.active_timer);
          const startMs = new Date(data.active_timer.started_at).getTime();
          const nowMs = Date.now();
          setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
        } else {
          setActiveTimer(null);
          setElapsedSeconds(0);
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
    // Poll every 30s as safety heartbeat
    const pollInterval = setInterval(fetchActiveTimer, 30000);

    return () => {
      window.removeEventListener("task-timer-updated", handleTimerChange);
      clearInterval(pollInterval);
    };
  }, [fetchActiveTimer]);

  // Live stopwatch counter (ticks every second)
  useEffect(() => {
    if (!activeTimer) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      const startMs = new Date(activeTimer.started_at).getTime();
      const nowMs = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTimer]);

  const formatStopwatch = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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

  if (!activeTimer) return null;

  return (
    <>
      {/* Floating Active Timer Widget */}
      <div 
        className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
          isMinimized ? "w-auto" : "w-80 sm:w-96"
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
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Expand Timer"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-3.5">
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

            <div className="py-2.5 space-y-1">
              <h4 className="font-semibold text-sm text-white truncate" title={activeTimer.task_title}>
                {activeTimer.task_title}
              </h4>
              {activeTimer.project_name && (
                <p className="text-[11px] text-slate-400 truncate">
                  📁 {activeTimer.project_name}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 gap-2">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono font-bold text-sm text-emerald-300 tracking-wider">
                  {formatStopwatch(elapsedSeconds)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* 1. Pause (Break) button */}
                <button
                  onClick={() => handleOpenModal("pause")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition shadow-sm cursor-pointer"
                  title="Pause timer to take a break. You can resume work later."
                >
                  <Pause className="h-3.5 w-3.5 fill-current" /> Pause (Break)
                </button>

                {/* 2. Finish Task button */}
                <button
                  onClick={() => handleOpenModal("finish")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  title="Complete task and lock recorded hours."
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Finish Task
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
