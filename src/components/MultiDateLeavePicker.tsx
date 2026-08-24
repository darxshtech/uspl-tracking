"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Check, 
  PartyPopper, 
  Coffee, 
  Info,
  CheckCircle2,
  X
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MultiDateLeavePickerProps {
  selectedDates: string[];
  onDatesChange: (dates: string[]) => void;
  holidays?: Array<{ date: string; name: string }>;
}

export default function MultiDateLeavePicker({
  selectedDates = [],
  onDatesChange,
  holidays = [],
}: MultiDateLeavePickerProps) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [fetchedHolidays, setFetchedHolidays] = useState<Array<{ date: string; name: string }>>(holidays);

  useEffect(() => {
    if (holidays.length === 0) {
      fetchHolidays();
    } else {
      setFetchedHolidays(holidays);
    }
  }, [currentYear, holidays]);

  const fetchHolidays = async () => {
    try {
      const res = await fetch(`/api/holidays?year=${currentYear}`);
      const data = await res.json();
      if (Array.isArray(data)) setFetchedHolidays(data);
    } catch (err) {
      console.error("Error fetching holidays in picker:", err);
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

  const toggleDate = (dateStr: string, isExempt: boolean) => {
    if (isExempt) return; // Sundays and official holidays cannot be selected as paid leaves

    if (selectedDates.includes(dateStr)) {
      onDatesChange(selectedDates.filter((d) => d !== dateStr));
    } else {
      onDatesChange([...selectedDates, dateStr].sort());
    }
  };

  const clearAll = () => onDatesChange([]);

  // Days matrix from Monday to Sunday
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();

  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes index 6

  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push({ isCurrentMonth: false, dayNumber: null, dateStr: "" });
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateObj = new Date(currentYear, currentMonth, day);
    const dayOfWeekIndex = (dateObj.getDay() + 6) % 7; // 0=Mon, 6=Sun
    const isSunday = dayOfWeekIndex === 6;

    const holiday = fetchedHolidays.find((h) => {
      const hDate = new Date(h.date).toISOString().split("T")[0];
      return hDate === dStr;
    });

    const isSelected = selectedDates.includes(dStr);
    const isToday = new Date().toISOString().split("T")[0] === dStr;

    calendarCells.push({
      isCurrentMonth: true,
      dayNumber: day,
      dateStr: dStr,
      isSunday,
      holiday,
      isSelected,
      isToday,
      isExempt: isSunday || Boolean(holiday),
    });
  }

  return (
    <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200">
      {/* Month Selector Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={prevMonth}
            className="h-7 w-7 p-0 bg-white"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-slate-700" />
          </Button>
          <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
            <CalendarIcon className="h-4 w-4 text-sky-500" />
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={nextMonth}
            className="h-7 w-7 p-0 bg-white"
          >
            <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
          </Button>
        </div>

        {selectedDates.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearAll}
            className="h-7 text-[11px] font-bold text-slate-500 hover:text-red-600 gap-1 px-2"
          >
            <X className="h-3 w-3" /> Clear Selection
          </Button>
        )}
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-500 pb-1 border-b border-slate-200/80">
        {WEEKDAYS.map((day, idx) => (
          <div key={day} className={idx === 6 ? "text-purple-600 font-extrabold" : ""}>
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, idx) => {
          if (!cell.isCurrentMonth) {
            return <div key={idx} className="h-10 rounded-xl bg-transparent" />;
          }

          const { dayNumber, dateStr, isSunday, holiday, isSelected, isToday, isExempt } = cell;

          let cellStyles = "bg-white text-slate-800 border-slate-200 hover:border-sky-400 hover:bg-sky-50/50";
          if (isSelected) {
            cellStyles = "bg-emerald-600 text-white border-emerald-600 font-black shadow-xs ring-2 ring-emerald-300";
          } else if (holiday) {
            cellStyles = "bg-indigo-50/90 text-indigo-900 border-indigo-200/80 cursor-not-allowed opacity-80";
          } else if (isSunday) {
            cellStyles = "bg-purple-50/80 text-purple-900 border-purple-200/80 cursor-not-allowed opacity-80";
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDate(dateStr, Boolean(isExempt))}
              disabled={isExempt}
              title={
                holiday
                  ? `Company Holiday: ${holiday.name} (Exempt)`
                  : isSunday
                  ? "Sunday Weekly Off (Exempt)"
                  : isSelected
                  ? "Selected for Leave (Click to deselect)"
                  : `Select ${dateStr}`
              }
              className={`h-10 rounded-xl border p-1 text-xs font-semibold transition-all flex flex-col items-center justify-between relative ${cellStyles} ${
                isToday && !isSelected ? "ring-2 ring-sky-500 font-bold" : ""
              }`}
            >
              <div className="flex items-center justify-between w-full text-[11px] leading-none">
                <span className={isSelected ? "text-white font-extrabold" : ""}>{dayNumber}</span>
                {isSelected && <Check className="h-3 w-3 text-white font-bold stroke-[3]" />}
              </div>

              {holiday ? (
                <div className="text-[8px] font-bold text-indigo-700 truncate w-full text-center leading-tight flex items-center justify-center gap-0.5">
                  <PartyPopper className="h-2.5 w-2.5 shrink-0 text-indigo-600" />
                  <span className="truncate">{holiday.name}</span>
                </div>
              ) : isSunday ? (
                <div className="text-[8px] font-bold text-purple-700 text-center leading-tight flex items-center justify-center gap-0.5">
                  <Coffee className="h-2.5 w-2.5 text-purple-600" />
                  <span>Off</span>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Legend & Selected Dates Summary */}
      <div className="pt-2 border-t border-slate-200/80 space-y-2">
        <div className="flex flex-wrap items-center justify-between text-[11px] font-medium text-slate-600 gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Selected
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-200 border border-indigo-400 inline-block"></span> Holiday (Exempt)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-200 border border-purple-400 inline-block"></span> Sunday (Exempt)
            </span>
          </div>
        </div>

        {selectedDates.length > 0 ? (
          <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-1">
            <div className="font-bold text-emerald-950 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Selected Working Days ({selectedDates.length} day{selectedDates.length > 1 ? "s" : ""})
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">Sundays & Holidays Excluded</span>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {selectedDates.map((d) => (
                <Badge key={d} className="bg-emerald-600 text-white text-[10px] font-mono font-bold px-2 py-0.5">
                  {new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" })}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 italic bg-white p-2 rounded-xl border border-slate-200/70">
            <Info className="h-3.5 w-3.5 text-sky-500 shrink-0" />
            Click on individual calendar days above to select leave dates. Sundays and company holidays are automatically exempt.
          </div>
        )}
      </div>
    </div>
  );
}
