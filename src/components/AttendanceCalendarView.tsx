"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/lib/swal";
import Link from "next/link";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  PartyPopper, 
  Coffee, 
  Users,
  TrendingUp,
  Award,
  ArrowRight,
  X
} from "lucide-react";
import { formatHoursAndMinutes, calculateHoursDifference, getCurrentISTTime12 } from "@/lib/timeUtils";
import EmployeeProductivityTag from "@/components/EmployeeProductivityTag";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AttendanceCalendarView({
  canAddHoliday = false,
  employees = [],
  initialEmployeeId = "ALL",
  hideEmployeeSelect = false,
  hideHolidayAdd = false,
}: {
  canAddHoliday?: boolean;
  employees?: any[];
  initialEmployeeId?: string;
  hideEmployeeSelect?: boolean;
  hideHolidayAdd?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(7); // August (0-indexed)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId);
  const [employeeProductivity, setEmployeeProductivity] = useState<any>(null);
  const [productivitySummary, setProductivitySummary] = useState<any>(null);
  const [employeeProductivityMap, setEmployeeProductivityMap] = useState<Record<number, any>>({});
  const [loadingProductivity, setLoadingProductivity] = useState(false);

  useEffect(() => {
    setSelectedEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

  // Fetch productivity metrics for the viewed month (for leadership)
  useEffect(() => {
    if (!canAddHoliday) return;

    const mStr = String(currentMonth + 1).padStart(2, "0");
    const start_date = `${currentYear}-${mStr}-01`;
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const end_date = `${currentYear}-${mStr}-${String(lastDay).padStart(2, "0")}`;

    setLoadingProductivity(true);
    fetch(`/api/analytics/employee-productivity?period=custom&start_date=${start_date}&end_date=${end_date}&_=` + Date.now())
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.employees)) {
          setProductivitySummary(data.summary || null);
          const map: Record<number, any> = {};
          data.employees.forEach((emp: any) => {
            map[emp.id] = emp;
          });
          setEmployeeProductivityMap(map);

          if (selectedEmployeeId !== "ALL") {
            const found = data.employees.find((e: any) => e.id.toString() === selectedEmployeeId.toString());
            setEmployeeProductivity(found || null);
          } else {
            setEmployeeProductivity(null);
          }
        } else {
          setProductivitySummary(null);
          setEmployeeProductivity(null);
          setEmployeeProductivityMap({});
        }
      })
      .catch(() => {
        setProductivitySummary(null);
        setEmployeeProductivity(null);
        setEmployeeProductivityMap({});
      })
      .finally(() => setLoadingProductivity(false));
  }, [selectedEmployeeId, currentYear, currentMonth, canAddHoliday]);

  const [holidays, setHolidays] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Holiday Modal State
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDesc, setHolidayDesc] = useState("");
  const [submittingHoliday, setSubmittingHoliday] = useState(false);

  useEffect(() => {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchHolidays();
    }
  }, [currentYear, mounted]);

  useEffect(() => {
    if (mounted) {
      fetchAttendance();
    }
  }, [currentYear, currentMonth, selectedEmployeeId, mounted]);

  const fetchHolidays = async () => {
    try {
      const res = await fetch(`/api/holidays?year=${currentYear}`);
      const data = await res.json();
      if (Array.isArray(data)) setHolidays(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const monthParam = String(currentMonth + 1).padStart(2, "0");
      const query = new URLSearchParams({
        month: monthParam,
        year: currentYear.toString(),
        employee_id: selectedEmployeeId,
      });

      // Use manage API for PM/CEO or main API
      const endpoint = canAddHoliday
        ? `/api/attendance/manage?${query.toString()}`
        : `/api/attendance?month=${monthParam}&year=${currentYear}`;

      const res = await fetch(endpoint);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.attendance || [];
      setAttendanceRecords(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) return;

    setSubmittingHoliday(true);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: holidayName,
          date: holidayDate,
          description: holidayDesc,
        }),
      });

      if (res.ok) {
        setHolidayOpen(false);
        setHolidayName("");
        setHolidayDate("");
        setHolidayDesc("");
        fetchHolidays();
        showSuccess("Holiday Added", `${holidayName} added to the company calendar.`);
      } else {
        const data = await res.json();
        showError("Failed to Add Holiday", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error adding holiday.");
    } finally {
      setSubmittingHoliday(false);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Build days matrix from Monday to Sunday
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();

  // In JS, 0 is Sunday, 1 is Monday ... 6 is Saturday.
  // We want Monday (0) to Sunday (6).
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes index 6

  // Pad previous month days
  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push({ isCurrentMonth: false, dayNumber: null, dateStr: "" });
  }

  // Populate days of current month
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateObj = new Date(currentYear, currentMonth, day);
    const dayOfWeekIndex = (dateObj.getDay() + 6) % 7; // 0=Mon, 6=Sun
    const isSunday = dayOfWeekIndex === 6;

    // Find holiday on this date
    const holiday = holidays.find((h) => {
      const hDate = new Date(h.date).toISOString().split("T")[0];
      return hDate === dStr;
    });

    // Find attendance records on this date
    const dayAttendance = attendanceRecords.filter((a) => {
      const aDate = new Date(a.date).toISOString().split("T")[0];
      return aDate === dStr;
    });

    const todayStr = mounted ? new Date().toISOString().split("T")[0] : "";

    calendarCells.push({
      isCurrentMonth: true,
      dayNumber: day,
      dateStr: dStr,
      isSunday,
      holiday,
      attendance: dayAttendance,
      isToday: Boolean(todayStr && dStr === todayStr),
    });
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Calendar Header Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <Button
              size="sm"
              variant="ghost"
              onClick={prevMonth}
              className="h-8 w-8 p-0 text-slate-700 hover:bg-white rounded-lg shadow-xs"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={nextMonth}
              className="h-8 w-8 p-0 text-slate-700 hover:bg-white rounded-lg shadow-xs"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-sky-500" />
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Employee Selector for Managers */}
          {!hideEmployeeSelect && canAddHoliday && employees.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="min-w-[180px]">
                <Select value={selectedEmployeeId} onValueChange={(val) => setSelectedEmployeeId(val || "ALL")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Team Members</SelectItem>
                    {employees
                      .filter((e) => e.role !== "CEO" && e.role !== "Admin")
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {employeeProductivity && (
                <EmployeeProductivityTag
                  tag={employeeProductivity.tag}
                  score={employeeProductivity.score}
                  metrics={employeeProductivity.metrics}
                  size="sm"
                />
              )}
            </div>
          )}

          {/* Add Upcoming Holiday Button (PM & CEO) */}
          {!hideHolidayAdd && canAddHoliday && (
            <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
              <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-md h-9" />}>
                <Plus className="h-4 w-4" /> Add Upcoming Holiday
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <PartyPopper className="h-5 w-5 text-indigo-500" /> Schedule Upcoming Company Holiday
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleAddHoliday} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="holName" className="font-semibold text-slate-700">Holiday Occasion / Title *</Label>
                    <Input
                      id="holName"
                      placeholder="e.g. Diwali, Independence Day, Gandhi Jayanti"
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="holDate" className="font-semibold text-slate-700">Holiday Date *</Label>
                    <Input
                      id="holDate"
                      type="date"
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="holDesc" className="font-semibold text-slate-700">Description & Remarks</Label>
                    <Input
                      id="holDesc"
                      placeholder="Optional details (e.g. Public / Festival Holiday)"
                      value={holidayDesc}
                      onChange={(e) => setHolidayDesc(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submittingHoliday}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 mt-2 shadow-md"
                  >
                    {submittingHoliday ? "Scheduling..." : "Save Holiday & Alert Staff"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Executive Monthly Productivity Analytics Bar (Admin, CEO, PM) */}
      {canAddHoliday && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-sky-50/70 p-4 md:p-5 shadow-xs space-y-3.5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-sm md:text-base">
                    {MONTH_NAMES[currentMonth]} {currentYear} Employee Productivity & Ideal Tags
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-bold border-indigo-200 text-indigo-800 bg-indigo-50">
                    4-Pillar Score
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Evaluated across Working Shift Hours, Task Timer Logs, Subtask Checklists, and Assigned Projects
                </p>
              </div>
            </div>

            {/* Quick Link to Dedicated Analytics Dashboard */}
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/dashboard/analytics">
                <Button size="sm" variant="outline" className="border-indigo-200 hover:bg-indigo-100/60 text-indigo-900 font-bold text-xs gap-1.5 h-8 cursor-pointer">
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-600" /> Open Full Analytics Hub &rarr;
                </Button>
              </Link>
            </div>
          </div>

          {/* If ALL Employees Selected: Summary Counters & Clickable Team Chips */}
          {selectedEmployeeId === "ALL" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    👥
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">Total Team</div>
                    <div className="text-base font-extrabold text-slate-900">{productivitySummary?.total_employees || 0}</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-yellow-50/50 p-2.5 rounded-xl border border-amber-200 shadow-2xs flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    🌟
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-amber-900">Ideal (Tasks Done)</div>
                    <div className="text-base font-black text-amber-950">{productivitySummary?.ideal_count || 0}</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-sky-50 to-indigo-50/50 p-2.5 rounded-xl border border-sky-200 shadow-2xs flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    ⚡
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-sky-900">Engaged (Working)</div>
                    <div className="text-base font-black text-sky-950">{productivitySummary?.engaged_count ?? productivitySummary?.active_count ?? 0}</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                    ⚪
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600">Off Shift / Leave</div>
                    <div className="text-base font-extrabold text-slate-800">{productivitySummary?.off_count || 0}</div>
                  </div>
                </div>
              </div>

              {/* Clickable Team Chips */}
              <div className="space-y-1 pt-0.5">
                <span className="text-[11px] font-bold text-slate-600">Click any employee below to filter calendar & view detailed metrics:</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.values(employeeProductivityMap).map((emp: any) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(emp.id.toString())}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-semibold text-slate-800 transition-all cursor-pointer shadow-2xs group"
                    >
                      <span className="group-hover:text-indigo-600 font-bold">{emp.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        emp.tag === "ideal" ? "bg-emerald-100 text-emerald-900 border border-emerald-300" :
                        emp.tag === "off" ? "bg-slate-100 text-slate-600" :
                        "bg-sky-100 text-sky-900 border border-sky-200"
                      }`}>
                        {emp.tag === "ideal" ? "🌟 Ideal" : emp.tag === "off" ? "⚪ Off" : "⚡ Engaged"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : employeeProductivity ? (
            /* If Single Employee Selected: Detailed Breakdown */
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    {employeeProductivity.name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">{employeeProductivity.name}</span>
                      <Badge variant="outline" className="text-[10px] font-semibold text-slate-600">
                        {employeeProductivity.role}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500">{employeeProductivity.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <EmployeeProductivityTag
                    tag={employeeProductivity.tag}
                    score={employeeProductivity.score}
                    metrics={employeeProductivity.metrics}
                    size="md"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedEmployeeId("ALL")}
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 gap-1"
                  >
                    View All &times;
                  </Button>
                </div>
              </div>

              {/* 5-Pillar Metric Strip for the selected employee */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Shift Time</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-0.5">{employeeProductivity.metrics?.shift_hours || 0} hrs</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Task Timer</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-0.5">{formatHoursAndMinutes(employeeProductivity.metrics?.task_hours || 0)}</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Utilization</div>
                  <div className="text-xs font-extrabold text-indigo-600 mt-0.5">{employeeProductivity.metrics?.utilization_rate || 0}%</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Tasks Done</div>
                  <div className="text-xs font-extrabold text-emerald-600 mt-0.5">
                    {employeeProductivity.metrics?.tasks_completed || 0} / {employeeProductivity.metrics?.tasks_total || 0}
                  </div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-amber-800 uppercase">Priority Tasks</div>
                  <div className="text-xs font-extrabold text-amber-900 mt-0.5">
                    {employeeProductivity.metrics?.priority_rate || 0}%
                    <span className="text-[9px] font-semibold text-slate-500 block">
                      ({(employeeProductivity.metrics?.urgent_tasks_completed || 0) + (employeeProductivity.metrics?.high_tasks_completed || 0)} urgent/high)
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Subtasks</div>
                  <div className="text-xs font-extrabold text-sky-600 mt-0.5">
                    {employeeProductivity.metrics?.subtasks_completed || 0} / {employeeProductivity.metrics?.subtasks_total || 0}
                  </div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Active Projects</div>
                  <div className="text-xs font-extrabold text-purple-600 mt-0.5">{employeeProductivity.metrics?.active_projects || 0}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span>Present (&ge;9 hrs)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          <span>Half Day (&lt;9 hrs)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
          <span>Company Holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-purple-400"></span>
          <span>Sunday (Weekly Off)</span>
        </div>
      </div>

      {/* Calendar Grid (Monday to Sunday) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <div className="min-w-[640px] md:min-w-0">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-700">
              {WEEKDAYS.map((day, idx) => (
                <div
                  key={day}
                  className={`py-3 ${idx === 6 ? "text-purple-700 bg-purple-50/50" : ""}`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid Cells */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
          {calendarCells.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return (
                <div key={idx} className="min-h-[105px] bg-slate-50/40 p-2 text-slate-300 select-none" />
              );
            }

            const { dayNumber, isSunday, holiday, attendance, isToday, dateStr } = cell;
            const isBeforeStart = dateStr < "2026-08-01";

            return (
              <div
                key={idx}
                className={`min-h-[105px] p-2 transition-colors flex flex-col justify-between ${
                  isToday ? "bg-sky-50/40 ring-2 ring-sky-400 inset-0 z-10" : ""
                } ${isSunday ? "bg-purple-50/30" : isBeforeStart ? "bg-slate-50/50 opacity-60" : "hover:bg-slate-50/70"}`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-sky-600 text-white shadow-xs"
                        : isSunday
                        ? "text-purple-700 font-extrabold"
                        : "text-slate-800"
                    }`}
                  >
                    {dayNumber}
                  </span>

                  {isSunday && (
                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-tight">
                      Weekly Off
                    </span>
                  )}
                  {isBeforeStart && !isSunday && (
                    <span className="text-[9px] font-semibold text-slate-400">
                      Pre-Launch
                    </span>
                  )}
                </div>

                {/* Cell Contents: Holiday or Attendance (only for date >= 2026-08-17) */}
                <div className="my-1.5 space-y-1">
                  {!isBeforeStart && holiday && (
                    <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 shadow-xs">
                      <div className="text-[10px] font-extrabold flex items-center gap-1 leading-tight truncate">
                        <PartyPopper className="h-3 w-3 text-indigo-600 shrink-0" />
                        <span className="truncate">{holiday.name}</span>
                      </div>
                      <div className="text-[9px] text-indigo-600 font-medium">Holiday</div>
                    </div>
                  )}

                  {/* Attendance Records on this day */}
                  {attendance && attendance.length > 0 && (
                    <div className="space-y-1">
                      {attendance.map((rec: any) => {
                        const isPresent = rec.status?.includes("Present") || (rec.login_time && !rec.logout_time && !rec.status?.includes("Leave") && rec.status !== "Holiday");
                        const empProd = employeeProductivityMap[rec.user_id];
                        return (
                        <div
                          key={rec.id}
                          className={`p-1.5 rounded-lg text-[10px] border shadow-xs leading-tight transition-all ${
                            isPresent
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : rec.status === "Half Day"
                              ? "bg-amber-50 border-amber-200 text-amber-900"
                              : rec.status === "Absent" && !rec.login_time
                              ? "bg-red-50 border-red-200 text-red-900"
                              : "bg-sky-50 border-sky-200 text-sky-900"
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between gap-1">
                            <span className="truncate flex items-center gap-1 min-w-0">
                              <span className="truncate">{rec.employee_name || "Shift"}</span>
                              {canAddHoliday && empProd && (
                                <span
                                  title={`${empProd.name}: ${empProd.tag_label} (${empProd.score} pts)`}
                                  className={`text-[8.5px] px-1 py-0.2 rounded font-bold shrink-0 ${
                                    empProd.tag === "ideal" ? "bg-amber-200/90 text-amber-950 border border-amber-300" :
                                    empProd.tag === "active" ? "bg-emerald-200/90 text-emerald-950" :
                                    "bg-slate-200 text-slate-800"
                                  }`}
                                >
                                  {empProd.tag === "ideal" ? "🌟 Ideal" : empProd.tag === "active" ? "🟢" : "🟡"}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-semibold text-[9.5px]">
                              {rec.login_time && !rec.logout_time
                                ? `${formatHoursAndMinutes(calculateHoursDifference(rec.login_time, getCurrentISTTime12()))} ⏱️`
                                : formatHoursAndMinutes(rec.total_hours)}
                            </span>
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">
                            {rec.login_time || "--"} &rarr; {rec.logout_time || "--"}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer status notice */}
                <div className="text-[9px] text-slate-400">
                  {isSunday && !holiday && !attendance?.length && (
                    <span className="flex items-center gap-1 text-purple-600 font-semibold">
                      <Coffee className="h-2.5 w-2.5" /> Sunday Off
                    </span>
                  )}
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
