"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/lib/swal";
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
  Users 
} from "lucide-react";

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

  useEffect(() => {
    setSelectedEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

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
            <div className="min-w-[180px]">
              <Select value={selectedEmployeeId} onValueChange={(val) => setSelectedEmployeeId(val || "ALL")}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Team Members</SelectItem>
                  {employees
                    .filter((e) => e.role !== "CEO")
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                    ))}
                </SelectContent>
              </Select>
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

            const { dayNumber, isSunday, holiday, attendance, isToday } = cell;

            return (
              <div
                key={idx}
                className={`min-h-[105px] p-2 transition-colors flex flex-col justify-between ${
                  isToday ? "bg-sky-50/40 ring-2 ring-sky-400 inset-0 z-10" : ""
                } ${isSunday ? "bg-purple-50/30" : "hover:bg-slate-50/70"}`}
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
                </div>

                {/* Cell Contents: Holiday or Attendance */}
                <div className="my-1.5 space-y-1">
                  {/* Company Holiday Card */}
                  {holiday && (
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
                      {attendance.map((rec: any) => (
                        <div
                          key={rec.id}
                          className={`p-1.5 rounded-lg text-[10px] border shadow-xs leading-tight ${
                            rec.status === "Present"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : rec.status === "Half Day"
                              ? "bg-amber-50 border-amber-200 text-amber-900"
                              : "bg-sky-50 border-sky-200 text-sky-900"
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between">
                            <span className="truncate">{rec.employee_name || "Shift"}</span>
                            <span>{parseFloat(rec.total_hours || 0).toFixed(1)}h</span>
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">
                            {rec.login_time || "--"} &rarr; {rec.logout_time || "--"}
                          </div>
                        </div>
                      ))}
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
  );
}
