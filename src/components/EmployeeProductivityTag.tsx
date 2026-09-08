"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Moon, 
  Clock, 
  CheckSquare, 
  Briefcase, 
  TrendingUp,
  Flame,
  X
} from "lucide-react";
import { formatHoursAndMinutes } from "@/lib/timeUtils";

export interface EmployeeProductivityMetrics {
  shift_hours?: number;
  task_hours?: number;
  utilization_rate?: number;
  tasks_total?: number;
  tasks_completed?: number;
  tasks_in_progress?: number;
  task_rate?: number;
  priority_rate?: number;
  urgent_tasks_count?: number;
  urgent_tasks_completed?: number;
  high_tasks_count?: number;
  high_tasks_completed?: number;
  subtasks_total?: number;
  subtasks_completed?: number;
  subtask_rate?: number;
  total_projects?: number;
  active_projects?: number;
  project_rate?: number;
}

export interface EmployeeProductivityTagProps {
  tag?: "ideal" | "engaged" | "active" | "idle" | "off" | string;
  score?: number;
  metrics?: EmployeeProductivityMetrics;
  size?: "xs" | "sm" | "md";
  showScore?: boolean;
  className?: string;
}

export default function EmployeeProductivityTag({
  tag = "engaged",
  score,
  metrics,
  size = "xs",
  showScore = true,
  className = "",
}: EmployeeProductivityTagProps) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isAuthorized = ["Admin", "CEO", "PM"].includes(role);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // If not executive leadership, do not render anything
  // If not executive leadership or if tag is none/off, do not render any tag
  if (!isAuthorized || !tag || tag === "none" || tag === "off") {
    return null;
  }

  // Normalize legacy tags
  const normalizedTag = tag === "active" || tag === "idle" ? "engaged" : tag;

  // Configuration per tag:
  // 1. "engaged": when employee's task timer is ON (running right now)
  // 2. "ideal": when employee's task is active (within due date)
  // 3. "overdue_work": when employee's active task is overdue
  // 4. "none" / "off": no tag displayed
  const config = {
    ideal: {
      label: "Ideal",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/90 shadow-xs",
      dotClass: "bg-emerald-500",
      icon: <Sparkles className="h-3 w-3 text-emerald-600 fill-emerald-100 animate-pulse" />,
      accentColor: "emerald",
      title: "🌟 Ideal (Task Active)",
      desc: "Employee has active tasks assigned or delivered within due date, but task timer is not running right now.",
    },
    engaged: {
      label: "Engaged",
      badgeClass: "bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100/90 shadow-xs",
      dotClass: "bg-sky-500",
      icon: <CheckCircle2 className="h-3 w-3 text-sky-600 animate-pulse" />,
      accentColor: "sky",
      title: "⚡ Engaged (Task Running)",
      desc: "Employee has an active task timer currently running right now.",
    },
    overdue_work: {
      label: "Overdue Work",
      badgeClass: "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/90 shadow-xs animate-pulse",
      dotClass: "bg-amber-500",
      icon: <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />,
      accentColor: "amber",
      title: "⚠️ Overdue Work",
      desc: "Employee is assigned to an active task whose target/due date is overdue.",
    },
    off: {
      label: "Off Shift",
      badgeClass: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/80",
      dotClass: "bg-slate-400",
      icon: <Moon className="h-3 w-3 text-slate-400" />,
      accentColor: "slate",
      title: "⚪ Off Shift / Leave",
      desc: "No active attendance shift or scheduled leave during this evaluated timeframe.",
    },
  }[normalizedTag as "ideal" | "engaged" | "overdue_work" | "off"] || null;

  if (!config) return null;

  const sizeClass = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-[11px] px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-1.5",
  }[size];

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block text-left ${className}`}
      onMouseEnter={() => metrics && setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={() => metrics && setIsOpen(!isOpen)}
        className={`inline-flex items-center rounded-md border font-semibold tracking-tight transition-all cursor-pointer select-none ${config.badgeClass} ${sizeClass}`}
        title="Click or hover to inspect 4-pillar productivity breakdown"
      >
        {config.icon}
        <span>{config.label}</span>
        {showScore && score !== undefined && tag !== "off" && (
          <span className="opacity-75 font-mono text-[9px] font-bold ml-0.5">
            {score}%
          </span>
        )}
      </button>

      {/* Floating Detailed Breakdown Tooltip / Popover */}
      {isOpen && metrics && (
        <div 
          className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 sm:w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs animate-in fade-in zoom-in-95 duration-150"
          style={{ filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.1))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
              <span className="font-bold text-slate-800 text-xs">{config.title}</span>
            </div>
            {score !== undefined && tag !== "off" && (
              <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                Score: {score}/100
              </span>
            )}
          </div>

          <p className="text-[10px] text-slate-500 mt-1.5 mb-2.5 leading-tight">
            {config.desc}
          </p>

          {/* 5-Pillar Metric Grid */}
          <div className="space-y-2 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
            {/* 1. Working Time Utilization (Check-in to Check-out) */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-sky-500" />
                  <span>Shift & Timer Hours:</span>
                </span>
                <span className="font-bold text-slate-800">
                  {metrics.utilization_rate ?? 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pl-4 mt-0.5">
                <span>Shift: {metrics.shift_hours ?? 0}h</span>
                <span>Timer: {metrics.task_hours ?? 0}h</span>
              </div>
            </div>

            {/* 2. Tasks Delivery */}
            <div className="pt-1.5 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span>Tasks Delivery:</span>
                </span>
                <span className="font-bold text-slate-800">
                  {metrics.task_rate ?? 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pl-4 mt-0.5">
                <span>Completed: {metrics.tasks_completed ?? 0}</span>
                <span>Total: {metrics.tasks_total ?? 0}</span>
              </div>
            </div>

            {/* 3. Priority of Tasks (Urgent & High Impact) */}
            <div className="pt-1.5 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-amber-500" />
                  <span>Task Priorities:</span>
                </span>
                <span className="font-bold text-amber-900">
                  {metrics.priority_rate ?? 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pl-4 mt-0.5">
                <span>Urgent: {metrics.urgent_tasks_completed ?? 0}/{metrics.urgent_tasks_count ?? 0}</span>
                <span>High: {metrics.high_tasks_completed ?? 0}/{metrics.high_tasks_count ?? 0}</span>
              </div>
            </div>

            {/* 4. Number of Subtasks Executed */}
            <div className="pt-1.5 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                <span className="flex items-center gap-1">
                  <CheckSquare className="h-3 w-3 text-purple-500" />
                  <span>Number of Subtasks:</span>
                </span>
                <span className="font-bold text-slate-800">
                  {metrics.subtask_rate ?? 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pl-4 mt-0.5">
                <span>Done: {metrics.subtasks_completed ?? 0} / {metrics.subtasks_total ?? 0} checklists</span>
              </div>
            </div>

            {/* 5. Number of Projects Assigned and Working On */}
            <div className="pt-1.5 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3 text-indigo-500" />
                  <span>Projects Assigned & Active:</span>
                </span>
                <span className="font-bold text-slate-800">
                  {metrics.project_rate ?? 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pl-4 mt-0.5">
                <span>Working On: {metrics.active_projects ?? 0} / {metrics.total_projects ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 text-[9px] text-slate-400 italic text-center">
            Visible only to PM, CEO, and Admin
          </div>

          {/* Little arrow at bottom */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
        </div>
      )}
    </div>
  );
}
