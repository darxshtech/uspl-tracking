"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Coffee, Clock, RefreshCw, Users, Briefcase, Activity, CheckCircle2, ArrowDown, LogIn, Building2, Calendar, AlertTriangle, MessageSquare } from "lucide-react";
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
  progress_percentage?: number;
  daily_summary?: string;
  blockers?: string;
  is_progress_overdue?: boolean;
  last_progress_checkin_at?: string | null;
  total_task_elapsed_seconds?: number;
  project_id?: number;
  project_name?: string;
  started_at: string;
  first_timer_started_at?: string;
  task_assigned_start_date?: string | null;
  previous_duration_seconds?: number;
  current_session_seconds?: number;
  todays_intime?: string | null;
  todays_outtime?: string | null;
  attendance_status?: string | null;
  office_elapsed_seconds?: number;
  total_office_hours?: number | string | null;
  is_on_break?: boolean;
  active_break_start?: string | null;
  today_break_minutes?: number;
  projects_assigned_count?: number;
  projects_worked_today_count?: number;
  tasks_worked_today_count?: number;
}

interface TeamBreakMember {
  break_id: number;
  attendance_id: number;
  user_id: number;
  break_start: string;
  paused_task_id: number | null;
  user_name: string;
  user_role: string;
  user_email: string;
  paused_task_title?: string | null;
  progress_percentage?: number;
  break_elapsed_seconds?: number;
  completed_break_minutes_today?: number;
  todays_intime?: string | null;
  projects_assigned_count?: number;
  projects_worked_today_count?: number;
  tasks_worked_today_count?: number;
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
  const [teamBreaks, setTeamBreaks] = useState<TeamBreakMember[]>([]);
  const [stats, setStats] = useState<TeamTimerStats>({
    active_now: 0,
    active_users_today: 0,
    total_hours_today: "0.0"
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());
  const [productivityMap, setProductivityMap] = useState<Map<number, any>>(new Map());
  const [testingData, setTestingData] = useState<any>(null);

  const fetchTeamTimers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [timerRes, prodRes, breakRes, testRes] = await Promise.all([
        fetch("/api/tasks/timer?mode=team&_=" + Date.now()),
        fetch("/api/analytics/employee-productivity?period=today&_=" + Date.now()),
        fetch("/api/attendance/team-breaks?_=" + Date.now()).catch(() => null),
        fetch("/api/testing?_=" + Date.now()).catch(() => null)
      ]);

      if (timerRes.ok) {
        const data = await timerRes.json();
        if (data.success) {
          // Deduplicate by user_id as a client-side safeguard
          const seenUsers = new Set<number>();
          const uniqueTimers = (data.active_timers || []).filter((t: ActiveTeamTimer) => {
            if (seenUsers.has(t.user_id)) return false;
            seenUsers.add(t.user_id);
            return true;
          });
          setActiveTimers(uniqueTimers);
          if (data.stats) {
            setStats({
              ...data.stats,
              active_now: uniqueTimers.length,
            });
          }
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

      if (breakRes && breakRes.ok) {
        const breakData = await breakRes.json();
        if (breakData.success && Array.isArray(breakData.on_break)) {
          setTeamBreaks(breakData.on_break);
        } else {
          setTeamBreaks([]);
        }
      } else {
        setTeamBreaks([]);
      }

      if (testRes && testRes.ok) {
        const tData = await testRes.json();
        setTestingData(tData);
      }
    } catch (err) {
      console.error("Failed to load team active timers, productivity, or breaks:", err);
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

  const calculateBreakDuration = (b: TeamBreakMember) => {
    if (!b.break_start) return "0m 00s";
    const startMs = new Date(b.break_start).getTime();
    if (isNaN(startMs)) return "0m 00s";
    const totalSecs = Math.max(0, Math.floor((currentTimeMs - startMs) / 1000));
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

  const formatTaskStartTime = (dateStr?: string) => {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "--";

    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();

    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const timeFormatted = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

    if (isToday) {
      return `Today (${weekday}, ${monthDay}), ${timeFormatted}`;
    }
    if (isYesterday) {
      return `Yesterday (${weekday}, ${monthDay}), ${timeFormatted}`;
    }
    return `${weekday}, ${monthDay}, ${timeFormatted}`;
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
              {teamBreaks.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Coffee className="h-3 w-3" />
                  {teamBreaks.length} on Break
                </span>
              )}
              {Array.isArray(testingData?.project_queue) && testingData.project_queue.length > 0 && (
                <Link
                  href="/dashboard/testing"
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 flex items-center gap-1 transition-colors"
                  title="Projects with tasks submitted for QA testing"
                >
                  <Briefcase className="h-3 w-3 text-purple-600" />
                  {testingData.project_queue.length} Projects in QA
                </Link>
              )}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Right Now</div>
            <div className="text-lg font-bold text-slate-900">{stats.active_now} <span className="text-xs font-normal text-slate-500">working</span></div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
            <Coffee className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">On Break</div>
            <div className="text-lg font-bold text-amber-950">{teamBreaks.length} <span className="text-xs font-normal text-amber-700">employees</span></div>
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

      {/* Currently On Break Section (Prominent Amber Banner & Cards) */}
      {teamBreaks.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-linear-to-r from-amber-50/90 via-amber-50/50 to-orange-50/70 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                <Coffee className="h-4 w-4 animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-950 flex items-center gap-2">
                  Currently On Break
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-300">
                    {teamBreaks.length} {teamBreaks.length === 1 ? "Employee" : "Employees"}
                  </span>
                </h4>
                <p className="text-[11px] text-amber-700">
                  Task timers are automatically paused while employees are taking their break.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {teamBreaks.map((b) => (
              <div
                key={b.break_id}
                className="p-3.5 rounded-xl border border-amber-200 bg-white/95 shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {b.user_name ? b.user_name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{b.user_name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{b.user_role}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0 animate-pulse">
                    <Coffee className="h-3 w-3 text-amber-700" />
                    <span>On Break</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200/80 text-xs">
                  <span className="text-[11px] font-semibold text-amber-900">Current Break</span>
                  <span className="font-mono font-bold text-amber-800 text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-600 animate-pulse" />
                    {calculateBreakDuration(b)}
                  </span>
                </div>

                {b.paused_task_title && (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Paused Task</div>
                    <div className="font-semibold text-slate-800 line-clamp-1 text-[11px]" title={b.paused_task_title}>
                      {b.paused_task_title}
                    </div>
                    {b.progress_percentage !== undefined && (
                      <div className="flex items-center justify-between text-[10px] pt-0.5">
                        <span className="text-slate-500">Progress:</span>
                        <span className="font-mono font-bold text-indigo-600">{b.progress_percentage}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Employee Workload Metrics Strip */}
                <div className="grid grid-cols-3 gap-1 p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[10px]">
                  <div className="text-center">
                    <div className="font-semibold text-amber-800 uppercase text-[9px]">Proj Assigned</div>
                    <div className="font-bold text-slate-900 text-xs">
                      {b.projects_assigned_count ?? productivityMap.get(b.user_id)?.metrics?.projects_assigned_count ?? 0}
                    </div>
                  </div>
                  <div className="text-center border-x border-amber-200/80 px-0.5">
                    <div className="font-semibold text-amber-800 uppercase text-[9px]">Worked Proj</div>
                    <div className="font-bold text-sky-800 text-xs">
                      {b.projects_worked_today_count ?? productivityMap.get(b.user_id)?.metrics?.projects_worked_today_count ?? 0}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-amber-800 uppercase text-[9px]">Tasks Worked</div>
                    <div className="font-bold text-emerald-800 text-xs">
                      {b.tasks_worked_today_count ?? productivityMap.get(b.user_id)?.metrics?.tasks_worked_today_count ?? 0}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>In-Time: <strong className="text-slate-700 font-mono">{formatInTime(b.todays_intime)}</strong></span>
                  <span>Today's Total: <strong className="text-amber-800 font-mono">{b.completed_break_minutes_today || 0}m</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Team Members List */}
      {activeTimers.length === 0 ? (
        <div className="py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600">
            {teamBreaks.length > 0
              ? "All active team members are currently on break."
              : "No team members currently running active task timers."}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">When developers or PMs start or resume task timers, their progress will appear here live.</p>
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
                    : timer.is_progress_overdue
                    ? "border-amber-400 ring-2 ring-amber-300/80 bg-amber-50/20 hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5"
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

                    {timer.is_progress_overdue ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0 flex items-center gap-1 animate-pulse" title="Task running > 45 minutes without progress check-in">
                        <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                        <span>45m+ Pending</span>
                      </span>
                    ) : productivityMap.has(timer.user_id) ? (
                      <EmployeeProductivityTag
                        tag={productivityMap.get(timer.user_id)?.tag}
                        score={productivityMap.get(timer.user_id)?.score}
                        metrics={productivityMap.get(timer.user_id)?.metrics}
                        size="xs"
                        showScore={false}
                      />
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-300 shrink-0">
                        ⚡ Engaged
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

                  {/* Employee Workload Metrics Strip */}
                  <div className="grid grid-cols-3 gap-1 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px]">
                    <div className="text-center">
                      <div className="font-semibold text-slate-500 uppercase text-[9px]">Proj Assigned</div>
                      <div className="font-bold text-slate-900 text-xs">
                        {timer.projects_assigned_count ?? productivityMap.get(timer.user_id)?.metrics?.projects_assigned_count ?? 0}
                      </div>
                    </div>
                    <div className="text-center border-x border-slate-200/80 px-0.5">
                      <div className="font-semibold text-slate-500 uppercase text-[9px]">Worked Proj</div>
                      <div className="font-bold text-sky-700 text-xs">
                        {timer.projects_worked_today_count ?? productivityMap.get(timer.user_id)?.metrics?.projects_worked_today_count ?? 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-slate-500 uppercase text-[9px]">Tasks Worked</div>
                      <div className="font-bold text-emerald-700 text-xs">
                        {timer.tasks_worked_today_count ?? productivityMap.get(timer.user_id)?.metrics?.tasks_worked_today_count ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Break Status Strip */}
                  {(timer.is_on_break || (timer.today_break_minutes && timer.today_break_minutes > 0)) && (
                    <div className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border text-xs ${
                      timer.is_on_break
                        ? "bg-amber-50 border-amber-300"
                        : "bg-slate-50 border-slate-200"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <Coffee className={`h-3.5 w-3.5 shrink-0 ${timer.is_on_break ? "text-amber-600 animate-pulse" : "text-slate-400"}`} />
                        <span className={`font-bold text-[11px] ${timer.is_on_break ? "text-amber-900" : "text-slate-600"}`}>
                          {timer.is_on_break ? "On Break Now" : "Break Today"}
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-[11px] ${
                        timer.is_on_break ? "text-amber-700" : "text-slate-500"
                      }`}>
                        {(timer.today_break_minutes || 0) >= 60
                          ? `${Math.floor((timer.today_break_minutes || 0) / 60)}h ${((timer.today_break_minutes || 0) % 60).toString().padStart(2, "0")}m`
                          : `${timer.today_break_minutes || 0}m`}
                      </span>
                    </div>
                  )}

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

                  {/* QA Tester Activity Section (For Testers or Tasks in QA) */}
                  {(timer.user_role === "Tester" || timer.task_status === "Testing" || timer.task_status === "Ready for Testing" || (testingData?.testers && testingData.testers.some((t: any) => t.id === timer.user_id))) && (
                    <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[11px] text-purple-950 flex items-center gap-1">
                          <Activity className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
                          Tester QA Activity
                        </span>
                        <span className="text-[9px] font-bold bg-purple-200/80 text-purple-900 px-1.5 py-0.5 rounded">
                          QA Station
                        </span>
                      </div>

                      {(() => {
                        const qaTaskList = Array.isArray(testingData) ? testingData : (testingData?.tasks || []);
                        const qaTask = qaTaskList.find((t: any) => t.id === timer.task_id) || timer;
                        const testerList = testingData?.testers || [];
                        const testerSummary = testerList.find((t: any) => t.id === timer.user_id);
                        const devName = (qaTask?.developer_name && qaTask.developer_name !== timer.user_name && qaTask.developer_name !== "Shivani Shinde")
                          ? qaTask.developer_name
                          : (qaTask?.project_creator_name || "Smita Tikone (Developer)");
                        const rawSentDate = qaTask?.date_time_sent || qaTask?.sent_to_testing_at || qaTask?.created_at || timer.task_assigned_start_date;
                        const sentTimeStr = rawSentDate ? formatTaskStartTime(rawSentDate) : "--";
                        const expectedDateStr = qaTask?.expected_date ? new Date(qaTask.expected_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
                        const qaStartTime = qaTask?.qa_started_at || qaTask?.testing_started_at || timer.first_timer_started_at || timer.started_at;

                        return (
                          <div className="space-y-1 text-[10px]">
                            <div className="flex items-center justify-between text-slate-700">
                              <span>Sent by Dev:</span>
                              <strong className="text-slate-900 font-bold">{devName}</strong>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Date/Time Sent:</span>
                              <span className="font-mono text-purple-900 font-semibold">{sentTimeStr}</span>
                            </div>
                            {expectedDateStr && (
                              <div className="flex items-center justify-between text-amber-800">
                                <span>Expected Date:</span>
                                <span className="font-mono font-bold text-amber-900">{expectedDateStr}</span>
                              </div>
                            )}

                            {/* Tester Working Duration */}
                            {qaStartTime && (
                              <div className="flex items-center justify-between text-indigo-900 pt-0.5 border-t border-purple-200/60">
                                <span>QA Testing Since:</span>
                                <strong className="font-mono font-bold text-indigo-950">
                                  {formatTaskStartTime(qaStartTime)}
                                </strong>
                              </div>
                            )}

                            {/* Tester Tested Stats & Same Project Tested Indicator */}
                            {testerSummary && (
                              <div className="pt-1 border-t border-purple-200/60 space-y-1">
                                <div className="flex items-center justify-between text-purple-950 font-semibold">
                                  <span>Tasks/Projects Tested:</span>
                                  <span className="font-mono font-bold">
                                    {testerSummary.total_tasks_tested || 0} tasks ({testerSummary.total_projects_tested || 0} proj)
                                  </span>
                                </div>

                                {/* Small Same Project Tested Indicator */}
                                {Array.isArray(testerSummary.same_projects_tested) && testerSummary.same_projects_tested.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {testerSummary.same_projects_tested.map((sp: any, spIdx: number) => (
                                      <span
                                        key={spIdx}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-950 border border-purple-300 font-extrabold text-[9px]"
                                        title={`Tester tested ${sp.count} tasks under project "${sp.project_name}"`}
                                      >
                                        📁 {sp.project_name} ({sp.count} tested)
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Task Progress Percentage & Bar */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600">Task Progress</span>
                      <span className={`font-bold font-mono ${Number(timer.progress_percentage) === 100 ? "text-emerald-600" : "text-indigo-600"}`}>
                        {timer.progress_percentage || 0}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          Number(timer.progress_percentage) === 100
                            ? "bg-emerald-500"
                            : Number(timer.progress_percentage) >= 50
                            ? "bg-indigo-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, Number(timer.progress_percentage) || 0))}%` }}
                      />
                    </div>
                  </div>

                  {/* 45m+ Overdue Check-in Alert */}
                  {timer.is_progress_overdue && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-900 flex items-start gap-2 shadow-2xs animate-pulse">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">45m+ Progress Update Pending:</span>
                        <p className="text-[10px] text-amber-800 mt-0.5">
                          {timer.user_name} has been running this task for 45+ minutes without recording a progress check-in.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Latest Daily Summary Snippet */}
                  {timer.daily_summary && (
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[10px] text-slate-600 flex items-start gap-1.5">
                      <MessageSquare className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                      <div className="line-clamp-2 italic" title={timer.daily_summary}>
                        &ldquo;{timer.daily_summary}&rdquo;
                      </div>
                    </div>
                  )}
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

                  {/* Task Start Date and Time (Initial Timer Start Date & Day, NOT Session Resume Date) */}
                  <div className="space-y-1">
                    <div 
                      className="flex items-center justify-between gap-1 text-[10px] bg-slate-50 px-2 py-1.5 rounded border border-slate-100"
                      title={`Initial task timer started on ${formatTaskStartTime(timer.first_timer_started_at || timer.started_at)}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-slate-500 font-semibold shrink-0">Task Started:</span>
                        <span className="font-bold text-slate-800 truncate">
                          {formatTaskStartTime(timer.first_timer_started_at || timer.started_at)}
                        </span>
                      </div>
                    </div>
                    {Number(timer.previous_duration_seconds) > 0 && timer.started_at && (
                      <div className="flex items-center justify-between text-[9px] text-slate-400 px-1">
                        <span>Latest Resumed:</span>
                        <span className="font-medium text-slate-500">
                          {new Date(timer.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </span>
                      </div>
                    )}
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
