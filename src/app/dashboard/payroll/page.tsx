"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Banknote, 
  Calendar, 
  Download, 
  Printer, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  TrendingDown, 
  DollarSign, 
  Edit3, 
  Save, 
  X, 
  ShieldAlert, 
  Info, 
  HelpCircle, 
  Sparkles,
  ArrowRight,
  Check,
  Percent
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showSuccess, showError, showToast, showWarning } from "@/lib/swal";

export default function PayrollPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "Developer";

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(String(today.getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState<string>(String(today.getFullYear()));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payrollData, setPayrollData] = useState<any>(null);

  // Inline salary editing state: { [userId]: salaryString }
  const [editingSalaries, setEditingSalaries] = useState<Record<number, string>>({});
  const [savingSalaryId, setSavingSalaryId] = useState<number | null>(null);

  // Waiver / adjustment modal state
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [customBonusInput, setCustomBonusInput] = useState<string>("0");
  const [customNotesInput, setCustomNotesInput] = useState<string>("");
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const isManagement = ["Admin", "CEO", "PM"].includes(userRole);

  useEffect(() => {
    if (isManagement) {
      fetchPayroll();
    }
  }, [selectedMonth, selectedYear, isManagement]);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/calculate?month=${selectedMonth}&year=${selectedYear}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPayrollData(data);
      } else {
        showError("Failed to Load Payroll", data.error || "Could not calculate payroll.");
      }
    } catch (err: any) {
      console.error("Error fetching payroll:", err);
      showError("Fetch Error", err.message || "Network error while loading payroll.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleWaiver = async (item: any) => {
    const newWaiveState = !item.is_waived;
    try {
      const res = await fetch("/api/payroll/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: item.user_id,
          month_year: payrollData.month_year,
          waive_deduction: newWaiveState,
          custom_bonus: item.custom_bonus,
          notes: item.notes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          newWaiveState 
            ? `Salary deduction waived off for ${item.name}` 
            : `Salary deduction re-enabled for ${item.name}`,
          "success"
        );
        fetchPayroll();
      } else {
        showError("Action Failed", data.error || "Failed to update waiver status.");
      }
    } catch (err: any) {
      showError("Error", err.message || "Network error.");
    }
  };

  const handleSaveSalary = async (userId: number) => {
    const rawVal = editingSalaries[userId];
    if (rawVal === undefined) return;

    const parsed = parseFloat(rawVal);
    if (isNaN(parsed) || parsed < 0) {
      showWarning("Invalid Salary", "Please enter a valid monthly salary amount.");
      return;
    }

    setSavingSalaryId(userId);
    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          monthly_salary: parsed,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Monthly salary updated successfully", "success");
        setEditingSalaries((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        fetchPayroll();
      } else {
        showError("Failed to update salary", data.error || "Error saving salary.");
      }
    } catch (err: any) {
      showError("Error", err.message || "Network error.");
    } finally {
      setSavingSalaryId(null);
    }
  };

  const handleSaveAdjustmentModal = async () => {
    if (!selectedRecord) return;
    setSavingAdjustment(true);
    try {
      const bonusNum = parseFloat(customBonusInput) || 0;
      const res = await fetch("/api/payroll/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedRecord.user_id,
          month_year: payrollData.month_year,
          waive_deduction: selectedRecord.is_waived,
          custom_bonus: bonusNum,
          notes: customNotesInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess("Adjustments Saved", "Bonus & notes recorded for this payroll cycle.");
        setSelectedRecord(null);
        fetchPayroll();
      } else {
        showError("Save Failed", data.error || "Failed to update adjustment.");
      }
    } catch (err: any) {
      showError("Error", err.message || "Network error.");
    } finally {
      setSavingAdjustment(false);
    }
  };

  const exportCSV = () => {
    if (!payrollData || !payrollData.payroll) return;

    const headers = [
      "Employee Name",
      "Role",
      "Email",
      "Month",
      "Days in Month",
      "Presents",
      "Half Days",
      "Paid Leaves Taken",
      "Unpaid (LWP) Days",
      "Base Salary (INR)",
      "Daily Rate (INR)",
      "LWP Deduction (INR)",
      "Deduction Status",
      "Custom Bonus (INR)",
      "Net Payable Salary (INR)",
      "Notes"
    ];

    const rows = payrollData.payroll.map((p: any) => [
      `"${p.name}"`,
      `"${p.role}"`,
      `"${p.email}"`,
      `"${payrollData.month_year}"`,
      p.total_days_in_month,
      p.presents_count,
      p.half_days_taken,
      p.paid_leaves_taken,
      p.total_lwp_days,
      p.monthly_salary,
      p.daily_rate,
      p.final_deduction,
      p.is_waived ? "Waived Off (Forgiven)" : "Deducted",
      p.custom_bonus,
      p.net_payable,
      `"${p.notes || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payroll_summary_${payrollData.month_year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isManagement) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-lg mx-auto my-12">
        <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 text-sm mt-1">
          The Payroll &amp; Salary Deduction Calculator is restricted to Project Managers, Administrators, and Executives.
        </p>
      </div>
    );
  }

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-md relative overflow-hidden border border-indigo-900/40">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Banknote className="h-4 w-4" />
            Financial &amp; Payroll Intelligence
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Payroll &amp; Salary Deductions
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Automated monthly salary calculation based on employee attendance, paid leave quotas, and unpaid leave (LWP) deductions.
          </p>
        </div>

        {/* Month Picker & Actions */}
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/15 backdrop-blur-md">
            <Calendar className="h-4 w-4 text-indigo-300 ml-1" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-900 text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-white/20 focus:outline-none cursor-pointer"
            >
              {monthNames.map((m, idx) => {
                const val = String(idx + 1).padStart(2, "0");
                return (
                  <option key={val} value={val}>
                    {m}
                  </option>
                );
              })}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-900 text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-white/20 focus:outline-none cursor-pointer"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <Button
            size="sm"
            onClick={fetchPayroll}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm h-9 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={exportCSV}
            disabled={!payrollData}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs gap-1.5 h-9 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {payrollData?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                {payrollData.summary.total_employees}
              </div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Staff Employees
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
            <div className="p-3.5 bg-sky-50 text-sky-600 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-sky-600">
                {formatINR(payrollData.summary.total_gross_payroll)}
              </div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Gross Payroll
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-rose-600">
                -{formatINR(payrollData.summary.total_lwp_deductions)}
              </div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                LWP Salary Deductions ({payrollData.summary.total_lwp_days} days)
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-600">
                {formatINR(payrollData.summary.total_net_disbursable)}
              </div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Net Payable Disbursable
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Policy Explanation Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Calculation Rules:</strong> Daily Rate = <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">Base Salary ÷ {payrollData?.total_days_in_month || 30} Days</code>. 
            Paid leaves = <strong>₹0 deduction</strong>. 
            Every 3 Half-Days = <strong>1 Leave deducted</strong>. 
            Unpaid Leaves (LWP) = <strong>1 Daily Rate deducted</strong> per day.
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">
          Executive Roles (Admin &amp; CEO) are exempt.
        </span>
      </div>

      {/* Interactive Payroll Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Banknote className="h-4 w-4 text-indigo-600" />
              Employee Payroll Breakdown ({monthNames[parseInt(selectedMonth, 10) - 1]} {selectedYear})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and adjust individual employee salary deductions and bonuses for this month.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-xs font-semibold">Computing payroll and attendance statistics...</p>
          </div>
        ) : !payrollData?.payroll || payrollData.payroll.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No staff employee records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px] tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Monthly Salary</th>
                  <th className="py-3 px-4">Daily Rate</th>
                  <th className="py-3 px-4">Presents / Half-Days</th>
                  <th className="py-3 px-4">Paid Leaves</th>
                  <th className="py-3 px-4">Unpaid (LWP)</th>
                  <th className="py-3 px-4">Deduction (LWP)</th>
                  <th className="py-3 px-4">Deduct Salary?</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4 text-center">Adjustments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {payrollData.payroll.map((item: any) => {
                  const isEditingSalary = editingSalaries[item.user_id] !== undefined;

                  return (
                    <tr key={item.user_id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Employee */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.email}</div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50">
                          {item.role}
                        </Badge>
                      </td>

                      {/* Base Monthly Salary */}
                      <td className="py-3.5 px-4">
                        {isEditingSalary ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              value={editingSalaries[item.user_id]}
                              onChange={(e) =>
                                setEditingSalaries((prev) => ({
                                  ...prev,
                                  [item.user_id]: e.target.value,
                                }))
                              }
                              className="w-24 h-7 text-xs font-bold"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveSalary(item.user_id)}
                              disabled={savingSalaryId === item.user_id}
                              className="h-7 w-7 p-0 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              title="Save salary"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditingSalaries((prev) => {
                                  const next = { ...prev };
                                  delete next[item.user_id];
                                  return next;
                                })
                              }
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">
                              {formatINR(item.monthly_salary)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingSalaries((prev) => ({
                                  ...prev,
                                  [item.user_id]: item.monthly_salary.toString(),
                                }))
                              }
                              className="text-slate-300 hover:text-indigo-600 transition-colors p-1 cursor-pointer"
                              title="Edit monthly salary"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Daily Rate */}
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {formatINR(item.daily_rate)}/day
                      </td>

                      {/* Presents / Half-Days */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-700 font-semibold">{item.presents_count}p</span>
                          <span className="text-slate-300">•</span>
                          <span className={`${item.half_days_taken > 0 ? "text-amber-700 font-bold" : "text-slate-400"}`}>
                            {item.half_days_taken} half-days
                          </span>
                        </div>
                      </td>

                      {/* Paid Leaves */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-purple-700">
                            {item.paid_leaves_taken} days taken
                          </span>
                          <span className="text-[10px] text-slate-400">
                            (Bal: {item.remaining_paid_balance} left)
                          </span>
                        </div>
                      </td>

                      {/* Unpaid Leaves (LWP) */}
                      <td className="py-3.5 px-4">
                        {item.total_lwp_days > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            {item.total_lwp_days} days LWP
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-semibold">0 days</span>
                        )}
                      </td>

                      {/* Deduction Amount */}
                      <td className="py-3.5 px-4">
                        {item.final_deduction > 0 ? (
                          <span className="font-bold text-rose-600">
                            -{formatINR(item.final_deduction)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">₹0</span>
                        )}
                      </td>

                      {/* Deduct Salary Toggle */}
                      <td className="py-3.5 px-4">
                        {item.total_lwp_days > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleToggleWaiver(item)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                              item.is_waived
                                ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            }`}
                            title="Click to toggle salary deduction on/off"
                          >
                            {item.is_waived ? "✨ Waived Off" : "⚡ Deducting"}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No LWP</span>
                        )}
                      </td>

                      {/* Net Payable Salary */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="text-sm font-black text-emerald-600">
                          {formatINR(item.net_payable)}
                        </div>
                        {item.custom_bonus > 0 && (
                          <div className="text-[10px] font-bold text-sky-600">
                            +{formatINR(item.custom_bonus)} Bonus
                          </div>
                        )}
                      </td>

                      {/* Adjustments Modal Trigger */}
                      <td className="py-3.5 px-4 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRecord(item);
                            setCustomBonusInput(item.custom_bonus ? item.custom_bonus.toString() : "0");
                            setCustomNotesInput(item.notes || "");
                          }}
                          className="h-7 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Adjust
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjustment Dialog Modal */}
      {selectedRecord && (
        <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-indigo-600" />
                Payroll Adjustments: {selectedRecord.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Base Salary:</span>
                  <span className="font-bold text-slate-900">{formatINR(selectedRecord.monthly_salary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Unpaid Days (LWP):</span>
                  <span className="font-bold text-rose-600">{selectedRecord.total_lwp_days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Calculated Deduction:</span>
                  <span className="font-bold text-rose-600">-{formatINR(selectedRecord.final_deduction)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Custom Bonus / Allowance Addition (₹)
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={customBonusInput}
                  onChange={(e) => setCustomBonusInput(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Payroll Notes / Remarks
                </label>
                <Input
                  placeholder="e.g. Approved incentive for milestone delivery..."
                  value={customNotesInput}
                  onChange={(e) => setCustomNotesInput(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRecord(null)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveAdjustmentModal}
                  disabled={savingAdjustment}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  {savingAdjustment ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save Adjustments
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
