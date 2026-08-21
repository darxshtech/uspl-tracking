"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess, showError, showWarning } from "@/lib/swal";
import { 
  BookOpen, 
  Clock, 
  CalendarDays, 
  CheckCircle2, 
  AlertTriangle, 
  Palmtree, 
  Sparkles, 
  ShieldCheck, 
  Sliders, 
  Save, 
  HelpCircle,
  FileText,
  Coffee,
  RotateCcw
} from "lucide-react";

export default function CompanyPoliciesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "Developer";
  const canManagePolicies = ["Admin", "CEO", "PM"].includes(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Policy Form & Data State
  const [fullDayHours, setFullDayHours] = useState<number>(9);
  const [halfDayMinHours, setHalfDayMinHours] = useState<number>(4.5);
  const [totalLeavesAllowed, setTotalLeavesAllowed] = useState<number>(2);
  const [halfDaysForOneLeave, setHalfDaysForOneLeave] = useState<number>(2);
  const [carryForwardLeaves, setCarryForwardLeaves] = useState<boolean>(true);
  const [policyRulesText, setPolicyRulesText] = useState<string>("");

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data) {
        setFullDayHours(data.full_day_hours || 9);
        setHalfDayMinHours(data.half_day_min_hours || (data.full_day_hours ? data.full_day_hours / 2 : 4.5));
        setTotalLeavesAllowed(data.total_leaves_allowed !== undefined ? data.total_leaves_allowed : 2);
        setHalfDaysForOneLeave(data.half_days_for_one_leave !== undefined ? data.half_days_for_one_leave : 2);
        setCarryForwardLeaves(data.carry_forward_leaves !== undefined ? data.carry_forward_leaves : true);
        setPolicyRulesText(data.policy_rules_text || "");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Failed to load company policies.");
    } finally {
      setLoading(false);
    }
  };

  const handleFullDayChange = (val: number) => {
    setFullDayHours(val);
    // Automatically suggest half day threshold as half of full day
    setHalfDayMinHours(Math.round((val / 2) * 10) / 10);
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePolicies) return;

    if (isNaN(fullDayHours) || fullDayHours <= 0 || fullDayHours > 24) {
      showWarning("Invalid Working Hours", "Full-day shift hours must be between 1 and 24 hours.");
      return;
    }

    if (isNaN(halfDayMinHours) || halfDayMinHours <= 0 || halfDayMinHours >= fullDayHours) {
      showWarning("Invalid Half-Day Hours", `Half-day threshold must be greater than 0 and less than ${fullDayHours} hours.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_day_hours: fullDayHours,
          half_day_min_hours: halfDayMinHours,
          total_leaves_allowed: totalLeavesAllowed,
          half_days_for_one_leave: halfDaysForOneLeave,
          carry_forward_leaves: carryForwardLeaves,
          policy_rules_text: policyRulesText,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess("Policies Updated", "Company attendance, shifts, and leave rules updated successfully across the system.");
        fetchPolicies();
      } else {
        showError("Save Failed", data.error || "Failed to update policies.");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "An unexpected error occurred while saving policies.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
            <ShieldCheck className="h-4 w-4" /> Official Company Regulations
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-indigo-600" />
            Attendance, Shifts & Leave Policy Hub
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Standard working hours, half-day & absent thresholds, monthly paid leaves, carry-forward roll-overs, and holiday rules.
          </p>
        </div>

        {canManagePolicies && (
          <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200 px-3 py-1 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
            <Sliders className="h-3.5 w-3.5 text-indigo-600" /> Management Edit Mode
          </Badge>
        )}
      </div>

      {/* 4 Interactive Policy Pillar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Full Day Shift Standard */}
        <Card className="border-indigo-100 bg-gradient-to-b from-indigo-50/50 to-white shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                <Clock className="h-5 w-5" />
              </span>
              <Badge className="bg-indigo-600 text-white font-bold text-[10px]">Standard Shift</Badge>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 mt-2">Full-Day Shift</CardTitle>
            <CardDescription className="text-xs text-slate-500">Active working hours needed for full attendance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-indigo-950">{fullDayHours} hrs</div>
            <p className="text-xs text-indigo-700 font-semibold mt-1">
              &ge; {fullDayHours} hrs logged = <strong>Present (Full Day)</strong>
            </p>
          </CardContent>
        </Card>

        {/* 2. Half-Day & Absent Thresholds */}
        <Card className="border-amber-100 bg-gradient-to-b from-amber-50/50 to-white shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <Badge className="bg-amber-600 text-white font-bold text-[10px]">Thresholds</Badge>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 mt-2">Absent & Half-Day</CardTitle>
            <CardDescription className="text-xs text-slate-500">Shift duration split thresholds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-950">&lt; {halfDayMinHours} hrs</div>
            <div className="space-y-0.5 text-xs text-amber-800 font-medium mt-1">
              <div>&bull; &lt; {halfDayMinHours} hrs = <strong className="text-red-600">Full Day Absent</strong></div>
              <div>&bull; {halfDayMinHours} to &lt; {fullDayHours} hrs = <strong className="text-amber-700">Half Day</strong></div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Monthly Paid Leaves & Carry Forward */}
        <Card className="border-emerald-100 bg-gradient-to-b from-emerald-50/50 to-white shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                <Palmtree className="h-5 w-5" />
              </span>
              <Badge className="bg-emerald-600 text-white font-bold text-[10px]">Monthly Credit</Badge>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 mt-2">Paid Leaves</CardTitle>
            <CardDescription className="text-xs text-slate-500">Monthly quota with carry-forward</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-950">{totalLeavesAllowed} leaves</div>
            <p className="text-xs text-emerald-700 font-semibold mt-1">
              {carryForwardLeaves ? "✨ Unused leaves roll over to next month (2+2=4)" : "Leaves expire at month end"}
            </p>
          </CardContent>
        </Card>

        {/* 4. Half-Day Ratio & Holidays */}
        <Card className="border-sky-100 bg-gradient-to-b from-sky-50/50 to-white shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-sky-100 text-sky-700">
                <CalendarDays className="h-5 w-5" />
              </span>
              <Badge className="bg-sky-600 text-white font-bold text-[10px]">Deductions</Badge>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 mt-2">Half-Days & Offs</CardTitle>
            <CardDescription className="text-xs text-slate-500">Conversion ratio & Sunday exemption</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-sky-950">{halfDaysForOneLeave} Half Days</div>
            <p className="text-xs text-sky-700 font-semibold mt-1">
              = 1 full leave deduction. Sundays & holidays are <strong>exempt</strong> from paid leaves.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Policy Content & Management Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (8 cols): Formal Company Policy Documentation */}
        <div className={`${canManagePolicies ? "lg:col-span-7" : "lg:col-span-12"} space-y-6`}>
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    Official Company Attendance Guidelines
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Applicable to all full-time and contractual employees across departments.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-white font-mono text-[11px]">
                  Version 2026.1
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6 text-slate-700">
              {/* Policy Item 1: Shift Hours */}
              <div className="flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">Shift Working Hours</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A standard working shift is <strong>{fullDayHours} hours</strong>. Active shifts are computed from IST check-in to check-out. Active shifts update continuously in real time.
                  </p>
                </div>
              </div>

              {/* Policy Item 2: Absent & Half Day */}
              <div className="flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  2
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">Absent & Half Day Rule</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    If an employee checks in and checks out before completing half of the shift (<strong>less than {halfDayMinHours} hours</strong>), the shift is automatically designated as <strong>FULL DAY ABSENT</strong>. Logging between <strong>{halfDayMinHours} hours and {fullDayHours} hours</strong> is designated as a <strong>HALF DAY</strong>.
                  </p>
                </div>
              </div>

              {/* Policy Item 3: Monthly Paid Leaves & Carry Forward */}
              <div className="flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  3
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">Monthly Paid Leaves & Roll-Over</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Every employee receives <strong>{totalLeavesAllowed} paid leaves per month</strong>. If an employee takes 0 leaves in a month, the unused balance passes on to the following month (e.g. 2 unused + 2 new = <strong>4 allowed leaves</strong> in the next month).
                  </p>
                </div>
              </div>

              {/* Policy Item 4: Half-Days Conversion */}
              <div className="flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  4
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">Half Days to Leave Ratio</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Every <strong>{halfDaysForOneLeave} half days</strong> are counted as 1 full day paid leave deduction.
                  </p>
                </div>
              </div>

              {/* Policy Item 5: Sundays & Holidays */}
              <div className="flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  5
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">Weekly Offs & Official Holidays</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Sundays (Weekly Offs) and Official Company Holidays scheduled by Management are <strong>never deducted as paid leaves</strong> when applying for leave across a date range.
                  </p>
                </div>
              </div>

              {/* Formatted Policy Document Text Preview */}
              {policyRulesText && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mt-4 space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Additional Policy Notes
                  </div>
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">
                    {policyRulesText}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols): Management Configuration Form (PM, CEO, Admin) */}
        {canManagePolicies && (
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-indigo-200 shadow-md bg-white">
              <CardHeader className="bg-indigo-50/60 border-b border-indigo-100">
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-indigo-600" />
                  Edit & Update Policy Rules
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Update shift thresholds, leave quotas, carry-forward, and custom notes.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                <form onSubmit={handleSavePolicies} className="space-y-5">
                  {/* Full Day Shift Hours */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullDayHoursInput" className="text-xs font-bold text-slate-700 uppercase">
                      Full-Day Shift Requirement (Hours) *
                    </Label>
                    <div className="relative">
                      <Input
                        id="fullDayHoursInput"
                        type="number"
                        min="1"
                        max="24"
                        step="0.5"
                        value={fullDayHours}
                        onChange={(e) => handleFullDayChange(parseFloat(e.target.value) || 0)}
                        required
                        className="font-bold text-sm pl-3 pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Hours
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Standard working hours required for 100% Present status.
                    </p>
                  </div>

                  {/* Half-Day / Absent Minimum Hours */}
                  <div className="space-y-1.5">
                    <Label htmlFor="halfDayMinInput" className="text-xs font-bold text-slate-700 uppercase">
                      Half-Shift / Absent Threshold (Hours) *
                    </Label>
                    <div className="relative">
                      <Input
                        id="halfDayMinInput"
                        type="number"
                        min="0.5"
                        max={fullDayHours}
                        step="0.5"
                        value={halfDayMinHours}
                        onChange={(e) => setHalfDayMinHours(parseFloat(e.target.value) || 0)}
                        required
                        className="font-bold text-sm pl-3 pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Hours
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700 font-medium">
                      Checking out under &lt; <strong>{halfDayMinHours} hrs</strong> = Full Day Absent.
                    </p>
                  </div>

                  {/* Monthly Leaves Allowed */}
                  <div className="space-y-1.5">
                    <Label htmlFor="monthlyLeavesInput" className="text-xs font-bold text-slate-700 uppercase">
                      Monthly Paid Leaves Allowed *
                    </Label>
                    <div className="relative">
                      <Input
                        id="monthlyLeavesInput"
                        type="number"
                        min="0"
                        max="31"
                        value={totalLeavesAllowed}
                        onChange={(e) => setTotalLeavesAllowed(parseInt(e.target.value, 10) || 0)}
                        required
                        className="font-bold text-sm pl-3 pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Leaves/Mo
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Baseline paid leave quota credited on the 1st of every month.
                    </p>
                  </div>

                  {/* Half Days for 1 Full Leave */}
                  <div className="space-y-1.5">
                    <Label htmlFor="halfDaysRatioInput" className="text-xs font-bold text-slate-700 uppercase">
                      Half-Days Equal to 1 Full Leave
                    </Label>
                    <div className="relative">
                      <Input
                        id="halfDaysRatioInput"
                        type="number"
                        min="1"
                        max="10"
                        value={halfDaysForOneLeave}
                        onChange={(e) => setHalfDaysForOneLeave(parseInt(e.target.value, 10) || 2)}
                        required
                        className="font-bold text-sm pl-3 pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Half-Days
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Standard: 2 half days = 1 full day leave deduction.
                    </p>
                  </div>

                  {/* Carry Forward Toggle Switch */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <div className="space-y-0.5 pr-2">
                      <Label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <RotateCcw className="h-4 w-4 text-emerald-600" />
                        Carry-Forward Unused Leaves
                      </Label>
                      <p className="text-[11px] text-emerald-700 leading-snug">
                        When enabled, remaining unused leaves pass on to next month (2+2=4).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={carryForwardLeaves}
                      onChange={(e) => setCarryForwardLeaves(e.target.checked)}
                      className="h-5 w-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Custom Policy Text */}
                  <div className="space-y-1.5">
                    <Label htmlFor="policyText" className="text-xs font-bold text-slate-700 uppercase">
                      Custom Policy Guidelines & Notes
                    </Label>
                    <Textarea
                      id="policyText"
                      rows={5}
                      value={policyRulesText}
                      onChange={(e) => setPolicyRulesText(e.target.value)}
                      placeholder="Write company-specific rules, attendance guidelines, and notes..."
                      className="text-xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 shadow-sm gap-2 mt-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving Policy Changes..." : "Save & Publish Company Policies"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
