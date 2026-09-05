"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Play, Clock, RefreshCw, Users, Briefcase, Activity, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface ActiveTeamTimer {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
  task_id: number;
  task_title: string;
  priority: string;
  task_status: string;
  project_id?: number;
  project_name?: string;
  started_at: string;
}

interface TeamTimerStats {
  active_now: number;
  active_users_today: number;
  total_hours_today: string;
}

export default function LiveTeamActivityMonitor() {
  const [activeTimers, setActiveTimers] = useState<ActiveTeamTimer[]>([]);
  const [stats, setStats] = useState<TeamTimerStats>({
    active_now: 0,
    active_users_today: 0,
    total_hours_today: "0.0"
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());

  const fetchTeamTimers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch("/api/tasks/timer?mode=team");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveTimers(data.active_timers || []);
          if (data.stats) setStats(data.stats);
          setLastRefreshed(new Date());
        }
      }
    } catch (err) {
      console.error("Failed to load team active timers:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // 60-Second Auto-Poll (per user requirement)
  useEffect(() => {
    fetchTeamTimers(false);

    // 60-second polling interval
    const pollInterval = setInterval(() => {
      fetchTeamTimers(true);
    }, 60000);

    // 1-second interval to keep live stopwatches ticking smoothly
    const clockInterval = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    // Listen to local timer updates
    const handleLocalUpdate = () => {
      fetchTeamTimers(true);
    };
    window.addEventListener("task-timer-updated", handleLocalUpdate);

    return () => {
      clearInterval(pollInterval);
      clearInterval(clockInterval);
      window.removeEventListener("task-timer-updated", handleLocalUpdate);
    };
  }, [fetchTeamTimers]);

  const calculateDuration = (startedAt: string) => {
    const startMs = new Date(startedAt).getTime();
    const diffSecs = Math.max(0, Math.floor((currentTimeMs - startMs) / 1000));
    const hrs = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    const secs = diffSecs % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              Live Team Activity Monitor
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {stats.active_now} Active Now
              </span>
            </h3>
            <p className="text-slate-500 text-xs">
              Auto-refreshes every 60s • Last sync: {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTeamTimers(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Right Now</div>
            <div className="text-lg font-bold text-slate-900">{stats.active_now} <span className="text-xs font-normal text-slate-500">employees</span></div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Users Today</div>
            <div className="text-lg font-bold text-slate-900">{stats.active_users_today}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hours Logged Today</div>
            <div className="text-lg font-bold text-slate-900">{stats.total_hours_today} <span className="text-xs font-normal text-slate-500">hrs</span></div>
          </div>
        </div>
      </div>

      {/* Active Team Members List */}
      {activeTimers.length === 0 ? (
        <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600">No team members currently running active task timers.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">When developers or PMs start task timers, their progress will appear here live.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
          {activeTimers.map((timer) => (
            <div
              key={timer.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-2xs space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {timer.user_name ? timer.user_name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {timer.user_name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {timer.user_role}
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    Active
                  </span>
                </div>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                  <div className="font-semibold text-slate-800 line-clamp-1" title={timer.task_title}>
                    {timer.task_title}
                  </div>
                  {timer.project_name && (
                    <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      📁 {timer.project_name}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                  <span className="font-mono font-bold text-emerald-700">
                    {calculateDuration(timer.started_at)}
                  </span>
                </div>

                <span className="text-[10px] text-slate-400">
                  Since {new Date(timer.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
