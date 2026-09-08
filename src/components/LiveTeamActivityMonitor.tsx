"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Play, Clock, RefreshCw, Users, Briefcase, Activity, CheckCircle2, ArrowDown, LogIn, Building2, Calendar } from "lucide-react";
import Link from "next/link";
import EmployeeProductivityTag from "@/components/EmployeeProductivityTag";

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
  previous_duration_seconds?: number;
  current_session_seconds?: number;
  todays_intime?: string | null;
  todays_outtime?: string | null;
  attendance_status?: string | null;
  office_elapsed_seconds?: number;
  total_office_hours?: number | string | null;
}

interface TeamTimerStats {
  active_now: number;
  active_users_today: number;
  total_hours_today: string;
}

interface LiveTeamActivityMonitorProps {
  onSelectTask?: (taskId: number, employeeName?: string) => void;
  selectedTaskId?: number | null;
}

export default function LiveTeamActivityMonitor({
  onSelectTask,
  selectedTaskId,
}: LiveTeamActivityMonitorProps = {}) {
  const [activeTimers, setActiveTimers] = useState<ActiveTeamTimer[]>([]);
  const [stats, setStats] = useState<TeamTimerStats>({
    active_now: 0,
    active_users_today: 0,
    total_hours_today: "0.0"
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());
  const [productivityMap, setProductivityMap] = useState<Map<number, any>>(new Map());

  const fetchTeamTimers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [timerRes, prodRes] = await Promise.all([
        fetch("/api/tasks/timer?mode=team&_=" + Date.now()),
        fetch("/api/analytics/employee-productivity?period=today&_=" + Date.now())
      ]);

      if (timerRes.ok) {
        const data = await timerRes.json();
        if (data.success) {
          setActiveTimers(data.active_timers || []);
          if (data.stats) setStats(data.stats);
          setLastRefreshed(new Date());
        }
      }

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        if (prodData && Array.isArray(prodData.employees)) {
          const map = new Map<number, any>();
          prodData.employees.forEach((emp: any) => map.set(emp.id, emp));
          setProductivityMap(map);
        }
      }
    } catch (err) {
      console.error("Failed to load team active timers or productivity:", err);
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

  const calculateDuration = (timer: ActiveTeamTimer) => {
    const prevSecs = Number(timer.previous_duration_seconds) || 0;
    const baseSessionSecs = Number(timer.current_session_seconds) || 0;
    const elapsedSinceFetch = Math.max(0, Math.floor((currentTimeMs - lastRefreshed.getTime()) / 1000));
    const totalSecs = prevSecs + baseSessionSecs + elapsedSinceFetch;
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const formatInTime = (timeStr?: string | null) => {
    if (!timeStr) return "Not Punched In";
    return timeStr.replace(/(:\d{2})(:\d{2})\s*(AM|PM)/i, "$1 $3").trim();
  };

  const calculateOfficeDuration = (timer: ActiveTeamTimer) => {
    if (!timer.todays_intime) return "--";

    if (timer.todays_outtime && Number(timer.total_office_hours) > 0) {
      const totalMins = Math.round(Number(timer.total_office_hours) * 60);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${hrs}h ${mins.toString().padStart(2, "0")}m (Out)`;
    }

    const baseOfficeSecs = Number(timer.office_elapsed_seconds) || 0;
    const elapsedSinceFetch = Math.max(0, Math.floor((currentTimeMs - lastRefreshed.getTime()) / 1000));
    const totalOfficeSecs = baseOfficeSecs + elapsedSinceFetch;
    const hrs = Math.floor(totalOfficeSecs / 3600);
    const mins = Math.floor((totalOfficeSecs % 3600) / 60);
    return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
  };

  const formatTaskStartTime = (dateStr: string) => {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "--";
    const dateFormatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const timeFormatted = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${dateFormatted}, ${timeFormatted}`;
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-1">
          {activeTimers.map((timer) => {
            const isSelected = selectedTaskId === timer.task_id;
            return (
              <div
                key={timer.id}
                onClick={() => onSelectTask?.(timer.task_id, timer.user_name)}
                className={`p-4 rounded-xl border bg-white transition-all shadow-2xs space-y-3 flex flex-col justify-between cursor-pointer group ${
                  isSelected
                    ? "border-emerald-500 ring-2 ring-emerald-400 bg-emerald-50/40 shadow-md scale-[1.01]"
                    : "border-slate-200 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
                }`}
                title={`Click to jump to and highlight ongoing task #${timer.task_id} (${timer.task_title})`}
              >
                <div className="space-y-2.5">
                  {/* Member & Role Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center shrink-0">
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

                    {productivityMap.has(timer.user_id) ? (
                      <EmployeeProductivityTag
                        tag={productivityMap.get(timer.user_id)?.tag}
                        score={productivityMap.get(timer.user_id)?.score}
                        metrics={productivityMap.get(timer.user_id)?.metrics}
                        size="xs"
                      />
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Attendance & Office Hours Info Strip */}
                  <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100/90 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <LogIn className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">In-Time</div>
                        <div className="font-bold text-slate-800 truncate" title={timer.todays_intime || "Not Punched In"}>
                          {formatInTime(timer.todays_intime)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">In Office</div>
                        <div className="font-bold text-indigo-700 truncate" title="Office duration today">
                          {calculateOfficeDuration(timer)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Task Scope & Project */}
                  <div className="bg-slate-50 group-hover:bg-emerald-50/50 p-2.5 rounded-lg border border-slate-100 group-hover:border-emerald-200 transition-colors text-xs space-y-1">
                    <div className="font-semibold text-slate-800 line-clamp-1 group-hover:text-emerald-950" title={timer.task_title}>
                      {timer.task_title}
                    </div>
                    {timer.project_name && (
                      <div className="text-[10px] text-slate-500 line-clamp-1">
                        📁 {timer.project_name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Live Task Stopwatch & Start Date-Time & Jump */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5" title={Number(timer.previous_duration_seconds) > 0 ? "Task duration (Includes prior sessions on this task)" : "Task duration"}>
                      <Clock className="h-3.5 w-3.5 text-emerald-600 animate-pulse shrink-0" />
                      <span className="font-mono font-bold text-emerald-700">
                        {calculateDuration(timer)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">task time</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTask?.(timer.task_id, timer.user_name);
                      }}
                      className="text-[10px] font-bold text-emerald-700 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white border border-emerald-200 group-hover:border-emerald-600 px-2.5 py-0.5 rounded-md transition-all flex items-center gap-0.5 shrink-0 cursor-pointer shadow-2xs"
                    >
                      <span>Jump</span>
                      <ArrowDown className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  {/* Task Start Date and Time */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <Calendar className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="text-slate-400">Task Started:</span>
                    <span className="font-bold text-slate-700 truncate">
                      {formatTaskStartTime(timer.started_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
