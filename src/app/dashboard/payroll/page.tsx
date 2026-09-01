"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Banknote, 
  Calendar, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  TrendingDown, 
  Edit3, 
  Save, 
  ShieldAlert, 
  Info, 
  Sparkles,
  Check,
  X,
  AlertTriangle,
  FileSpreadsheet
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
  const [payrollData, setPayrollData] = useState<any>(null);

  // Waiver / note modal state
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
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
        showError("Failed to Load Payout Status", data.error || "Could not calculate payout advisor.");
      }
    } catch (err: any) {
      console.error("Error fetching payout advisor:", err);
      showError("Fetch Error", err.message || "Network error while loading data.");
    } finally {
      setLoading(false);
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
          notes: item.notes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          newWaiveState 
            ? `Deduction waived off: Pay full salary to ${item.name}` 
            : `Deduction re-enabled for ${item.name}`,
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

  const handleSaveNotesModal = async () => {
    if (!selectedRecord) return;
    setSavingAdjustment(true);
    try {
      const res = await fetch("/api/payroll/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedRecord.user_id,
          month_year: payrollData.month_year,
          waive_deduction: selectedRecord.is_waived,
          notes: customNotesInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess("Notes Saved", "Payroll remarks saved successfully.");
        setSelectedRecord(null);
        fetchPayroll();
      } else {
        showError("Save Failed", data.error || "Failed to update notes.");
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
      "Total Month Days",
      "Presents Logged",
      "Half Days Logged",
      "Paid Leaves Taken",
      "Remaining Paid Quota",
      "Unpaid (LWP) Days",
      "Salary Payout Decision",
      "Deduction Days",
      "Management Notes"
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
      p.remaining_paid_balance,
      p.total_lwp_days,
      `"${p.payout_label}"`,
      p.deduction_days,
      `"${p.notes || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `salary_payout_advisor_${payrollData.month_year}.csv`);
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
          The Salary Payout Advisor is restricted to Project Managers, Administrators, and Executives.
        </p>
      </div>
    );
  }

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
            <CheckCircle2 className="h-4 w-4" />
            Monthly Payout &amp; Salary Deduction Decision Advisor
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Salary Payout Status
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Audit which employees should receive 100% full salary and which have unpaid leaves (LWP) requiring deduction for the month.
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
                Staff Members Audited
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-600">
                {payrollData.summary.full_salary_count} Employees
              </div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Pay Full Salary (100%)
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-rose-600">
                {payrollData.summary.deduction_pending_count} Employees
              </div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Salary Deduction Pending
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-amber-700">
                {payrollData.summary.waived_count} Waived Off
              </div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total LWP: {payrollData.summary.total_lwp_days} Days
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
            <strong>Decision Logic:</strong> Paid leaves &amp; Sundays/Holidays = <strong>Full Salary</strong>. 
            Every 3 Half-Days = <strong>1 Paid Leave deducted</strong>. 
            When paid leave quota is exhausted, excess days are logged as <strong>Unpaid (LWP)</strong> requiring salary deduction unless waived.
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">
          Executive Roles (Admin &amp; CEO) are exempt.
        </span>
      </div>

      {/* Decision Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
              Employee Payout Recommendations ({monthNames[parseInt(selectedMonth, 10) - 1]} {selectedYear})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Clear recommendation on whether to pay full salary or deduct salary for unpaid days.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-xs font-semibold">Analyzing employee attendance and leave quotas...</p>
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
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Presents Logged</th>
                  <th className="py-3.5 px-4">Half-Days Logged</th>
                  <th className="py-3.5 px-4">Paid Leaves</th>
                  <th className="py-3.5 px-4">Unpaid (LWP) Days</th>
                  <th className="py-3.5 px-4">Should We Pay Full Salary?</th>
                  <th className="py-3.5 px-4">Action / Waiver</th>
                  <th className="py-3.5 px-4 text-center">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {payrollData.payroll.map((item: any) => {
                  const isFull = item.payout_decision === "PAY_FULL";

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

                      {/* Presents */}
                      <td className="py-3.5 px-4">
                        <span className="text-emerald-700 font-bold">{item.presents_count} days</span>
                      </td>

                      {/* Half-Days */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className={`${item.half_days_taken > 0 ? "text-amber-800 font-bold" : "text-slate-400"}`}>
                            {item.half_days_taken} half-days
                          </span>
                          {item.half_days_deducted > 0 && (
                            <span className="text-[10px] text-amber-700">
                              (-{item.half_days_deducted} leave by 3:1)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Paid Leaves */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-purple-700">
                            {item.paid_leaves_taken} taken
                          </span>
                          <span className="text-[10px] text-slate-400">
                            (Bal: {item.remaining_paid_balance} left)
                          </span>
                        </div>
                      </td>

                      {/* Unpaid (LWP) Days */}
                      <td className="py-3.5 px-4">
                        {item.total_lwp_days > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 inline-block">
                            {item.total_lwp_days} Days LWP
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-semibold">0 days</span>
                        )}
                      </td>

                      {/* Should we pay full salary? */}
                      <td className="py-3.5 px-4">
                        {isFull ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100/90 text-emerald-900 border border-emerald-300 font-bold text-xs shadow-2xs">
                            <Check className="h-4 w-4 text-emerald-700 shrink-0" />
                            <span>YES — Pay Full Salary</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 font-bold text-xs shadow-2xs">
                            <X className="h-4 w-4 text-rose-700 shrink-0" />
                            <span>NO — Deduct {item.deduction_days} Day{item.deduction_days === 1 ? "" : "s"} Salary</span>
                          </div>
                        )}
                      </td>

                      {/* Waiver Toggle Action */}
                      <td className="py-3.5 px-4">
                        {item.total_lwp_days > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleToggleWaiver(item)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                              item.is_waived
                                ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-indigo-600"
                            }`}
                            title="Click to toggle: Forgive deduction & pay full salary vs Apply deduction"
                          >
                            {item.is_waived ? "✨ Waived (Pay Full)" : "⚡ Waive Off & Pay Full"}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Notes / Remarks */}
                      <td className="py-3.5 px-4 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRecord(item);
                            setCustomNotesInput(item.notes || "");
                          }}
                          className="h-7 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          {item.notes ? "View Note" : "Add Note"}
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

      {/* Remarks Dialog Modal */}
      {selectedRecord && (
        <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-indigo-600" />
                Payroll Remarks: {selectedRecord.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Unpaid Days (LWP):</span>
                  <span className="font-bold text-rose-600">{selectedRecord.total_lwp_days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Payout Status:</span>
                  <span className="font-bold text-slate-900">{selectedRecord.payout_label}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Manager Notes / Reason for Waiver or Deduction
                </label>
                <Input
                  placeholder="e.g. Approved leave waiver due to emergency, or deduct 2 days for unsanctioned absences..."
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
                  onClick={handleSaveNotesModal}
                  disabled={savingAdjustment}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  {savingAdjustment ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save Note
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
