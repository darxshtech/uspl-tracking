"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Mail, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Play, 
  RefreshCw, 
  Send, 
  Calendar, 
  ShieldCheck, 
  Zap, 
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  Info,
  CalendarDays,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showSuccess, showError, showToast, showWarning } from "@/lib/swal";

export default function CronLogsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "Developer";
  const userEmail = (session?.user as any)?.email || "";

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [testEmailInput, setTestEmailInput] = useState(userEmail);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    if (userEmail && !testEmailInput) {
      setTestEmailInput(userEmail);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cron/logs?limit=50");
      const data = await res.json();
      if (res.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualTrigger = async (type: "weekly" | "monthly" | "auto" | "test" | "dry_run") => {
    setTriggering(type);
    try {
      let endpoint = `/api/cron/attendance-emails?type=${type}`;
      if (type === "test") {
        if (!testEmailInput) {
          showWarning("Email Required", "Please enter a destination email address for the test.");
          setTriggering(null);
          return;
        }
        endpoint = `/api/cron/attendance-emails?type=weekly&test_email=${encodeURIComponent(testEmailInput)}`;
      } else if (type === "dry_run") {
        endpoint = `/api/cron/attendance-emails?type=weekly&dry_run=true`;
      }

      const res = await fetch(endpoint);
      const data = await res.json();

      if (res.ok && data.success) {
        showSuccess(
          "Job Executed! 🚀",
          data.message || `Successfully processed ${type} attendance task.`
        );
        fetchLogs();
      } else {
        showError("Execution Failed", data.error || "Failed to trigger cron job.");
      }
    } catch (err: any) {
      showError("Trigger Error", err.message || "Network error while triggering job.");
    } finally {
      setTriggering(null);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.job_type?.toLowerCase().includes(q) ||
      log.status?.toLowerCase().includes(q) ||
      log.trigger_source?.toLowerCase().includes(q) ||
      log.target_period?.toLowerCase().includes(q)
    );
  });

  const totalRuns = logs.length;
  const successfulRuns = logs.filter((l) => l.status === "success").length;
  const totalEmailsSent = logs.reduce((acc, l) => acc + (l.success_count || 0), 0);
  const avgDuration = totalRuns > 0 
    ? Math.round(logs.reduce((acc, l) => acc + (l.execution_time_ms || 0), 0) / totalRuns) 
    : 0;

  if (!["Admin", "CEO", "PM"].includes(userRole)) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-500 mt-1">
          Attendance Email & Cron logs are accessible only to Admin, CEO, and PM roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-xs">
              <Mail className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            Automated Attendance Emails &amp; Cron Logs
          </h1>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">
            Monitor automated Vercel Cron executions, review employee email deliveries, and dispatch manual reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              fetchLogs();
            }}
            disabled={refreshing || loading}
            className="bg-white hover:bg-slate-50 border-slate-300 font-bold text-xs gap-1.5 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{totalRuns}</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Recorded Runs</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">{successfulRuns}</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Successful Runs</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-sky-600">{totalEmailsSent}</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Emails Sent</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{avgDuration} ms</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Avg Duration</div>
          </div>
        </div>
      </div>

      {/* Manual Dispatch & Testing Control Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider">
              <Zap className="h-4 w-4" /> On-Demand Trigger Center
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">Manual Job Dispatch &amp; Testing</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Trigger background email broadcasts or test an individual inbox delivery without waiting for the automated 7:30 AM IST schedule.
            </p>
          </div>
          <div className="bg-indigo-50/80 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-semibold border border-indigo-100 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Schedule: Daily @ 07:30 AM IST (02:00 UTC)
          </div>
        </div>

        {/* 3 Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-5">
          {/* Card 1: Broadcasts */}
          <div className="bg-slate-50/80 border border-slate-200/90 p-4 rounded-xl flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UsersIcon className="h-3.5 w-3.5 text-indigo-600" />
                1. Company Broadcasts
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Dispatch personalized attendance reports to all active employees.
              </p>
            </div>
            <div className="space-y-2">
              <Button
                size="sm"
                onClick={() => handleManualTrigger("weekly")}
                disabled={triggering !== null}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-xs h-9 justify-center"
              >
                {triggering === "weekly" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Send Weekly Reports
              </Button>

              <Button
                size="sm"
                onClick={() => handleManualTrigger("monthly")}
                disabled={triggering !== null}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 shadow-xs h-9 justify-center"
              >
                {triggering === "monthly" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Send Monthly Reports
              </Button>
            </div>
          </div>

          {/* Card 2: Single Test Email */}
          <div className="bg-slate-50/80 border border-slate-200/90 p-4 rounded-xl flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-emerald-600" />
                2. Test Inbox Delivery
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Send a sample attendance report to any email address for preview.
              </p>
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Enter recipient email..."
                value={testEmailInput}
                onChange={(e) => setTestEmailInput(e.target.value)}
                className="bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 text-xs h-9"
              />
              <Button
                size="sm"
                onClick={() => handleManualTrigger("test")}
                disabled={triggering !== null || !testEmailInput}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs h-9 justify-center"
              >
                {triggering === "test" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Test Email
              </Button>
            </div>
          </div>

          {/* Card 3: Simulation */}
          <div className="bg-slate-50/80 border border-slate-200/90 p-4 rounded-xl flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-amber-600" />
                3. Dry-Run Simulation
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Calculate shift statistics and verify database queries without emailing.
              </p>
            </div>
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleManualTrigger("dry_run")}
                disabled={triggering !== null}
                className="w-full bg-white hover:bg-slate-100 text-slate-700 border-slate-300 font-bold text-xs gap-1.5 shadow-xs h-9 justify-center"
              >
                {triggering === "dry_run" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 text-amber-600" />}
                Run Calculation Dry-Run
              </Button>
              <div className="text-[10px] text-center text-slate-400 font-medium">
                Safe preview mode • 0 emails dispatched
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              Execution History Logs
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing the latest automated and manual cron triggers from the database.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search logs by status, type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9 bg-slate-50 border-slate-200"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-xs font-semibold">Loading execution logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Info className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No cron execution logs found.</p>
            <p className="text-xs text-slate-400 mt-1">
              Trigger a test above to create the first execution log entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px] tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Job Type</th>
                  <th className="py-3 px-4">Trigger Source</th>
                  <th className="py-3 px-4">Target Period</th>
                  <th className="py-3 px-4">Deliveries</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Executed At (IST)</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  let statusBadge = (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[11px] gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Success
                    </Badge>
                  );
                  if (log.status === "failed") {
                    statusBadge = (
                      <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[11px] gap-1">
                        <XCircle className="h-3 w-3" /> Failed
                      </Badge>
                    );
                  } else if (log.status === "partial") {
                    statusBadge = (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[11px] gap-1">
                        <AlertTriangle className="h-3 w-3" /> Partial
                      </Badge>
                    );
                  } else if (log.status === "skipped") {
                    statusBadge = (
                      <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-bold text-[11px] gap-1">
                        <Clock className="h-3 w-3" /> Skipped
                      </Badge>
                    );
                  }

                  const executedTime = new Date(log.created_at).toLocaleString("en-US", {
                    timeZone: "Asia/Kolkata",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">{statusBadge}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <span className="capitalize">{log.job_type.replace(/_/g, " ")}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <Badge variant="outline" className="bg-white font-mono text-[10px]">
                          {log.trigger_source}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {log.target_period || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <span className="font-bold text-emerald-600">{log.success_count || 0} sent</span>
                        {log.failed_count > 0 && (
                          <span className="text-rose-600 font-bold ml-1.5">({log.failed_count} failed)</span>
                        )}
                        <span className="text-slate-400 text-[10px] ml-1">/ {log.recipients_count || 0} total</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {log.execution_time_ms ? `${log.execution_time_ms} ms` : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {executedTime}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedLog(log)}
                          className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 font-bold text-xs h-7 px-2"
                        >
                          View <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
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

      {/* Log Details Modal */}
      <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="w-[92vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <FileText className="h-5 w-5 text-indigo-600" />
              Cron Execution Log #{selectedLog?.id}
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="text-slate-500 uppercase text-[10px] font-bold">Job Type</div>
                  <div className="font-bold text-slate-900 mt-0.5 capitalize">{selectedLog.job_type.replace(/_/g, " ")}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase text-[10px] font-bold">Status</div>
                  <div className="font-bold text-slate-900 mt-0.5 capitalize">{selectedLog.status}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase text-[10px] font-bold">Duration</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedLog.execution_time_ms} ms</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase text-[10px] font-bold">Source</div>
                  <div className="font-mono text-slate-900 mt-0.5">{selectedLog.trigger_source}</div>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  <div className="font-bold mb-1 flex items-center gap-1.5 text-rose-900">
                    <XCircle className="h-4 w-4 text-rose-600" /> Error Details
                  </div>
                  <div className="font-mono text-xs">{selectedLog.error_message}</div>
                </div>
              )}

              <div>
                <div className="font-bold text-slate-700 uppercase text-[11px] mb-1.5">JSON Payload &amp; Sub-tasks</div>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
                  {JSON.stringify(
                    typeof selectedLog.details === "string" 
                      ? JSON.parse(selectedLog.details || "{}") 
                      : selectedLog.details || {},
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Icon helper
function UsersIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
