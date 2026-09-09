"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess, showWarning, showToast } from "@/lib/swal";
import { 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Rocket, 
  AlertTriangle, 
  ExternalLink, 
  UserCheck, 
  Briefcase,
  Play,
  CheckSquare,
  Clock,
  FileSpreadsheet,
  AlertCircle,
  Link as LinkIcon,
  RefreshCw,
  ListTodo,
  ChevronDown,
  ChevronUp,
  Paperclip
} from "lucide-react";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function TestingQueuePage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isAuthorized = ["Tester", "Admin", "CEO", "PM"].includes(role);
  const isManagement = ["Admin", "CEO", "PM"].includes(role);

  const [tasks, setTasks] = useState<any[]>([]);
  const [testersSummary, setTestersSummary] = useState<any[]>([]);
  const [projectQueue, setProjectQueue] = useState<any[]>([]);
  const [projectsSummary, setProjectsSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "testers" | "projects">("queue");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Finish Testing Modal State
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [issuesCount, setIssuesCount] = useState<number>(0);
  const [testSheetLink, setTestSheetLink] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [submittingAudit, setSubmittingAudit] = useState(false);

  // Sub-task / Checklist Expand State in QA Station
  const [expandedChecklistTaskId, setExpandedChecklistTaskId] = useState<number | null>(null);

  const formatDateSent = (dateStr?: string) => {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "--";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    if (isToday) return `Today, ${timeStr}`;
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${timeStr}`;
  };

  const calculateWorkingDuration = (startedAt?: string) => {
    if (!startedAt) return "Pending QA Start";
    const d = new Date(startedAt);
    if (isNaN(d.getTime())) return "Pending QA Start";
    const diffSecs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    const days = Math.floor(diffSecs / 86400);
    const hrs = Math.floor((diffSecs % 86400) / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    if (days > 0) return `${days}d ${hrs}h in QA`;
    if (hrs > 0) return `${hrs}h ${mins}m in QA`;
    return `${mins}m in QA`;
  };

  // Toggle checklist sub-task verification status
  const handleToggleChecklist = async (checklistId: number, currentCompleted: boolean) => {
    // Optimistic UI update for tasks table
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        checklists: (t.checklists || []).map((c: any) =>
          c.id === checklistId ? { ...c, is_completed: !currentCompleted } : c
        ),
      }))
    );

    // Also update selectedTask if modal is currently open
    setSelectedTask((prev: any) => {
      if (!prev || !prev.checklists) return prev;
      return {
        ...prev,
        checklists: prev.checklists.map((c: any) =>
          c.id === checklistId ? { ...c, is_completed: !currentCompleted } : c
        ),
      };
    });

    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_checklist",
          checklist_id: checklistId,
          is_completed: !currentCompleted,
        }),
      });
    } catch (err) {
      console.error("Failed to toggle checklist:", err);
      fetchTestingQueue();
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchTestingQueue();
      const interval = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        fetchTestingQueue();
      }, 20000);
      return () => clearInterval(interval);
    } else if (role) {
      setLoading(false);
    }
  }, [role, isAuthorized]);

  const fetchTestingQueue = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/testing?_=" + Date.now());
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      } else if (data && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        setTestersSummary(data.testers || []);
        setProjectQueue(data.project_queue || []);
        if (data.projects_submitted) {
          setProjectsSummary(data.projects_submitted);
        }
      }
      if (isManual) showToast("Testing queue refreshed!");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  // 1. Start Testing (Check-in time recorded)
  const handleStartTesting = async (taskId: number) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, action: "start_testing" }),
      });
      if (res.ok) {
        fetchTestingQueue();
        showToast("Testing session started!");
      } else {
        showError("Failed to Start Session", "Failed to start testing session.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Open Finish Testing Modal
  const openFinishModal = (task: any) => {
    setSelectedTask(task);
    setIssuesCount(task.issues_count || 0);
    setTestSheetLink(task.test_sheet_link || "");
    setRemarks(task.remarks || "");
    setFinishModalOpen(true);
  };

  // 3. Submit Finish Testing Audit (Check-out time recorded)
  const handleFinishTestingSubmit = async (e: React.FormEvent, forcePass: boolean = false) => {
    e.preventDefault();
    if (!selectedTask) return;

    const parsedCount = forcePass ? 0 : Math.max(0, parseInt(issuesCount as any) || 0);

    if (parsedCount > 0 && !testSheetLink.trim()) {
      showWarning("Link Required", "Please provide the link to the test sheet or bug tracker so the developer can review the issues.");
      return;
    }

    setSubmittingAudit(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTask.id,
          action: "finish_testing",
          issues_count: parsedCount,
          test_sheet_link: testSheetLink.trim() || null,
          remarks: remarks.trim() || (parsedCount === 0 ? "All test cases passed cleanly and verified." : "Issues found during QA verification."),
        }),
      });

      if (res.ok) {
        setFinishModalOpen(false);
        setSelectedTask(null);
        setIssuesCount(0);
        setTestSheetLink("");
        setRemarks("");
        fetchTestingQueue();
        if (parsedCount === 0) {
          showSuccess("Testing Complete", "Task verified with 0 issues! Logged to Work Accomplishments.");
        } else {
          showToast(`Returned to developer with ${parsedCount} issues.`);
        }
      } else {
        const data = await res.json();
        showError("Audit Failed", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Audit Failed", "Failed to complete testing audit.");
    } finally {
      setSubmittingAudit(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-lg mx-auto mt-8">
        <div className="h-16 w-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">QA Testing Queue Access Restricted</h2>
        <p className="text-sm text-slate-500">
          The QA Testing Queue is reserved for <strong>Testers, PMs, Admin, and CEO</strong>.
        </p>
        <Link href="/dashboard/tasks">
          <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs mt-2">
            Return to Daily Tasks
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-sky-500" />
            QA Verification & Testing Queue
          </h1>
          <p className="text-slate-500 mt-1">
            {isManagement
              ? "Management Briefing: Overview of active testing queue, tester workload, tasks sent by developers, and project test history."
              : "Active testing tasks submitted by developers. Completed verifications automatically log to Work Accomplishments."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchTestingQueue(true)}
            disabled={refreshing}
            className="h-8 px-2.5 text-xs font-bold gap-1 text-slate-700 hover:text-sky-600 bg-white shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-sky-600" : ""}`} />
            Refresh Queue
          </Button>
          <Link href="/dashboard/work">
            <Button size="sm" className="h-8 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 shadow-xs">
              <Clock className="h-3.5 w-3.5" /> View Logged Accomplishments
            </Button>
          </Link>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY METRIC CARDS (Projects Submitted, QA Queue, Testers) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Projects Submitted for Testing</span>
            <div className="text-2xl font-black text-indigo-900 mt-0.5 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-indigo-600" />
              {projectQueue.length} Projects
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {tasks.length} tasks submitted across active projects
            </p>
          </div>
          <button
            onClick={() => setActiveTab("projects")}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
          >
            View Brief →
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tasks in QA Queue</span>
            <div className="text-2xl font-black text-amber-700 mt-0.5 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-amber-500" />
              {tasks.length} Tasks
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {tasks.filter((t) => t.status === "Ready for Testing").length} Ready for QA • {tasks.filter((t) => t.status === "Testing").length} In Testing
            </p>
          </div>
          <button
            onClick={() => setActiveTab("queue")}
            className="text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors cursor-pointer"
          >
            View Tasks →
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active QA Testers</span>
            <div className="text-2xl font-black text-purple-900 mt-0.5 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              {testersSummary.length} Testers
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {testersSummary.reduce((acc, t) => acc + (t.working_today?.length || 0), 0)} testing sessions logged today
            </p>
          </div>
          <button
            onClick={() => setActiveTab("testers")}
            className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition-colors cursor-pointer"
          >
            Tester Stats →
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION FOR BRIEF TESTING OVERVIEW (Admin, CEO, PM, Tester) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("queue")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "queue"
              ? "bg-sky-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <ListTodo className="h-4 w-4" />
          Active Testing Queue ({tasks.length})
        </button>

        <button
          onClick={() => setActiveTab("testers")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "testers"
              ? "bg-sky-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Tester Workload & Same Project Stats ({testersSummary.length})
        </button>

        <button
          onClick={() => setActiveTab("projects")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "projects"
              ? "bg-sky-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Projects Submitted for Testing ({projectQueue.length})
        </button>
      </div>

      {/* FINISH TESTING AUDIT MODAL */}
      <Dialog open={finishModalOpen} onOpenChange={setFinishModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-sky-500" />
              Complete QA Testing & Record Audit
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => handleFinishTestingSubmit(e, false)} className="space-y-4 pt-2">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 font-medium border border-slate-200 space-y-1">
              <div>Task: <span className="font-bold text-slate-900">{selectedTask?.title}</span></div>
              <div className="text-slate-600">Project: <strong>{selectedTask?.project_name || "N/A"}</strong></div>
              <div className="text-slate-600">
                Assigned by: <strong>{selectedTask?.project_creator_name || selectedTask?.creator_name || "Management"} ({selectedTask?.project_creator_role || selectedTask?.creator_role || "PM"})</strong>
              </div>
              <div className="text-slate-600">Developer: <strong>{selectedTask?.assignee_name || "N/A"}</strong></div>
              
              {selectedTask?.testing_started_at && (
                <div className="text-[11px] text-sky-700 font-semibold pt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-sky-500" />
                  Testing Check-in Time: {new Date(selectedTask.testing_started_at).toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Sub-tasks / Checklists Passed from Developer */}
            {Array.isArray(selectedTask?.checklists) && selectedTask.checklists.length > 0 && (
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <ListTodo className="h-4 w-4 text-sky-600" />
                    Sub-tasks Verification ({selectedTask.checklists.filter((c: any) => c.is_completed).length}/{selectedTask.checklists.length} Verified)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Verify the developer's sub-tasks below as you complete your test pass:
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 pt-1">
                  {selectedTask.checklists.map((c: any) => (
                    <div
                      key={c.id}
                      onClick={() => handleToggleChecklist(c.id, c.is_completed)}
                      className={`p-2 rounded-lg border text-xs flex items-start gap-2 cursor-pointer transition-colors ${
                        c.is_completed ? "bg-emerald-50/70 border-emerald-200" : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={c.is_completed}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-sky-600 h-3.5 w-3.5 mt-0.5 shrink-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <span className={`whitespace-pre-wrap break-words leading-relaxed block ${
                          c.is_completed ? "line-through text-slate-400 font-normal" : "text-slate-800 font-semibold"
                        }`}>
                          {c.item_text}
                        </span>
                        {Array.isArray(c.attachments) && c.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.attachments.map((att: any, attIdx: number) => (
                              <a
                                key={attIdx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white text-[10px] font-semibold text-slate-600 border border-slate-200 hover:text-sky-600"
                              >
                                <Paperclip className="h-2.5 w-2.5" />
                                <span className="truncate max-w-[120px]">{att.title || "File"}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total Issues Found */}
            <div className="space-y-1.5">
              <Label htmlFor="issuesCount" className="font-bold text-slate-900 text-xs">
                Total Number of Issues / Bugs Found * (0 = All Passed)
              </Label>
              <Input
                id="issuesCount"
                type="number"
                min="0"
                value={issuesCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setIssuesCount(isNaN(val) ? 0 : Math.max(0, val));
                }}
                className="text-sm font-bold"
                required
              />
              <p className="text-[11px] text-slate-500">
                If issues are greater than 0, task will be returned to the developer for fixes. If 0, it passes and is logged as completed.
              </p>
            </div>

            {/* Link of Test Sheet */}
            <div className="space-y-1.5">
              <Label htmlFor="testSheetLink" className="font-bold text-slate-900 text-xs flex items-center gap-1">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Link of Test Sheet / Bug Tracker {issuesCount > 0 && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="testSheetLink"
                value={testSheetLink}
                onChange={(e) => setTestSheetLink(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... or Jira/Notion URL"
                className="text-xs"
                required={issuesCount > 0}
              />
              <p className="text-[11px] text-slate-500">
                Developers will click this link from their Daily Tasks board to inspect failing test cases.
              </p>
            </div>

            {/* QA Remarks */}
            <div className="space-y-1.5">
              <Label htmlFor="remarks" className="font-semibold text-slate-700 text-xs">
                Testing Observations & QA Notes
              </Label>
              <textarea
                id="remarks"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Summary of test coverage, edge cases tested, browsers checked..."
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Decision Submission Buttons */}
            <div className="pt-2 space-y-2">
              {issuesCount > 0 ? (
                <Button
                  type="submit"
                  disabled={submittingAudit}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 shadow-md flex items-center justify-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  {submittingAudit ? "Submitting..." : `Return to Developer with ${issuesCount} Issue(s)`}
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submittingAudit}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submittingAudit ? "Submitting..." : "Mark Fully Fixed & PASS QA (0 Issues)"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* TAB 1: ACTIVE TESTING QUEUE */}
      {activeTab === "queue" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Task & Preview Links</TableHead>
                <TableHead className="font-bold">Project & Assigner</TableHead>
                <TableHead className="font-bold">Developer (Sent By)</TableHead>
                <TableHead className="font-bold">Sent Date & Time / QA Duration</TableHead>
                <TableHead className="font-bold text-right">Testing Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading QA queue...</TableCell></TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-12">
                    <div className="max-w-sm mx-auto space-y-2">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-70" />
                      <p className="font-bold text-slate-800">All Testing Tasks Clear!</p>
                      <p className="text-xs text-slate-500">
                        No active tasks awaiting QA verification. Completed testing records are preserved in Work Accomplishments.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => {
                  const taskLinksList: string[] = Array.isArray(task.task_links) && task.task_links.length > 0
                    ? task.task_links
                    : task.task_link ? [task.task_link] : [];

                  return (
                    <TableRow key={task.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="align-top max-w-xs sm:max-w-sm md:max-w-md break-words whitespace-normal">
                        <div className="font-bold text-slate-900 text-sm whitespace-pre-wrap break-words leading-snug">{task.title}</div>
                        {task.description && (
                          <p className="text-xs text-slate-600 whitespace-pre-wrap break-words mt-1 leading-relaxed max-w-full">
                            {task.description}
                          </p>
                        )}
                        
                        {/* Preview Links */}
                        {taskLinksList.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Developer Deliverable URLs:</span>
                            <div className="flex flex-wrap gap-1">
                              {taskLinksList.map((link, lIdx) => (
                                <a
                                  key={lIdx}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 text-[11px] font-bold border border-sky-200 transition-colors max-w-full truncate"
                                >
                                  <ExternalLink className="h-3 w-3 shrink-0" /> Preview Link {lIdx + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-semibold mt-1 inline-block">No links provided</span>
                        )}

                        {/* Developer Sub-tasks / Checklists Passed to Tester */}
                        {Array.isArray(task.checklists) && task.checklists.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2 max-w-full">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <ListTodo className="h-3.5 w-3.5 text-sky-600" />
                                Sub-tasks to Test ({task.checklists.filter((c: any) => c.is_completed).length}/{task.checklists.length} Verified)
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpandedChecklistTaskId(expandedChecklistTaskId === task.id ? null : task.id)}
                                className="text-[10px] text-sky-600 hover:text-sky-800 font-bold flex items-center gap-0.5 cursor-pointer"
                              >
                                {expandedChecklistTaskId === task.id ? "Collapse" : "Inspect All"}
                                {expandedChecklistTaskId === task.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            </div>

                            <div className="space-y-1.5">
                              {(expandedChecklistTaskId === task.id ? task.checklists : task.checklists.slice(0, 3)).map((c: any) => (
                                <div
                                  key={c.id}
                                  onClick={() => handleToggleChecklist(c.id, c.is_completed)}
                                  className={`p-1.5 rounded-md border text-xs flex items-start gap-2 cursor-pointer transition-colors ${
                                    c.is_completed ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={c.is_completed}
                                    onChange={() => {}}
                                    className="rounded border-slate-300 text-sky-600 h-3.5 w-3.5 mt-0.5 shrink-0 cursor-pointer"
                                    title="Check off sub-task as tested/verified"
                                  />
                                  <div className="flex-1 min-w-0 break-words whitespace-normal">
                                    <span className={`whitespace-pre-wrap break-words leading-snug block ${
                                      c.is_completed ? "line-through text-slate-400 font-normal" : "font-medium text-slate-800"
                                    }`}>
                                      {c.item_text}
                                    </span>

                                    {Array.isArray(c.attachments) && c.attachments.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {c.attachments.map((att: any, attIdx: number) => (
                                          <a
                                            key={attIdx}
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white text-[10px] font-semibold text-slate-600 border border-slate-200 hover:text-sky-600 max-w-full"
                                          >
                                            <Paperclip className="h-2.5 w-2.5 shrink-0" />
                                            <span className="truncate max-w-[120px]">{att.title || "File"}</span>
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {expandedChecklistTaskId !== task.id && task.checklists.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedChecklistTaskId(task.id)}
                                  className="text-[11px] font-semibold text-sky-600 hover:text-sky-800"
                                >
                                  +{task.checklists.length - 3} more sub-tasks...
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="align-top max-w-[180px] break-words whitespace-normal">
                        <div className="font-bold text-slate-900 text-xs break-words">{task.project_name || "N/A"}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1 break-words">
                          <UserCheck className="h-3 w-3 text-sky-500 shrink-0" />
                          <span>
                            Assigned By:{" "}
                            <strong className="break-words">
                              {task.project_creator_name || task.creator_name || "Management"} ({task.project_creator_role || task.creator_role || "PM"})
                            </strong>
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="align-top max-w-[150px] break-words whitespace-normal text-slate-700 text-xs font-semibold">
                        <div className="font-bold text-slate-900 break-words">{task.developer_name || "Developer"}</div>
                        <span className="text-[10px] text-slate-400 font-normal block">Assigned Developer</span>
                      </TableCell>

                      <TableCell className="align-top space-y-1">
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-purple-600" />
                          Sent: {formatDateSent(task.sent_to_testing_at || task.date_time_sent)}
                        </div>

                        {task.expected_date && (
                          <div className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 inline-flex items-center gap-1">
                            <span>Expected:</span>
                            <span className="font-mono">{new Date(task.expected_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </div>
                        )}

                        <div>
                          {task.status === "Ready for Testing" && (
                            <Badge className="bg-amber-500 text-white font-bold animate-pulse text-[10px]">Ready for QA</Badge>
                          )}
                          {task.status === "Testing" && (
                            <Badge className="bg-sky-600 text-white font-bold flex items-center gap-1 animate-pulse text-[10px]">
                              <Clock className="h-3 w-3" /> Testing In Progress
                            </Badge>
                          )}
                          {task.status === "In Progress" && (
                            <Badge className="bg-purple-600 text-white font-bold text-[10px]">
                              QA In Progress
                            </Badge>
                          )}
                        </div>

                        {task.testing_started_at && (
                          <div className="text-[10px] text-sky-700 font-semibold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                            Working Duration: {calculateWorkingDuration(task.testing_started_at)}
                          </div>
                        )}
                      </TableCell>

                      {/* Action Buttons */}
                      <TableCell className="align-top text-right space-y-1.5">
                        {task.status === "Ready for Testing" && (
                          <Button
                            size="sm"
                            onClick={() => handleStartTesting(task.id)}
                            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                          >
                            <Play className="h-3.5 w-3.5" /> Start Testing
                          </Button>
                        )}

                        {(task.status === "Testing" || task.status === "In Progress") && (
                          <Button
                            size="sm"
                            onClick={() => openFinishModal(task)}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5 shadow-md animate-pulse"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Finish Testing & Submit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* TAB 2: TESTER WORKLOAD & SAME PROJECT STATS */}
      {activeTab === "testers" && (
        <div className="space-y-6">
          {testersSummary.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
              No active QA testers found.
            </div>
          ) : (
            testersSummary.map((tester) => (
              <div key={tester.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
                {/* Tester Header & Overview Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    {tester.avatar ? (
                      <img src={tester.avatar} alt={tester.name} className="h-11 w-11 rounded-full object-cover border-2 border-purple-200" />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-purple-100 text-purple-800 font-extrabold flex items-center justify-center text-sm border-2 border-purple-200">
                        {tester.name?.charAt(0) || "T"}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-base">{tester.name}</h3>
                        <Badge className="bg-purple-600 text-white text-[10px] font-bold">QA Tester</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{tester.email}</p>
                    </div>
                  </div>

                  {/* 5-Column KPI Strip for Executive Briefing */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-center">
                      <span className="text-[10px] text-sky-600 font-bold uppercase block">Working Today</span>
                      <span className="text-base font-extrabold text-sky-950">{tester.working_today?.length || 0} tasks</span>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-center">
                      <span className="text-[10px] text-amber-600 font-bold uppercase block">Active QA Projects</span>
                      <span className="text-base font-extrabold text-amber-950">{tester.active_projects_count || 0} proj</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase block">Tasks Tested</span>
                      <span className="text-base font-extrabold text-emerald-950">{tester.total_tasks_tested || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
                      <span className="text-[10px] text-indigo-600 font-bold uppercase block">Completed Projects</span>
                      <span className="text-base font-extrabold text-indigo-950">{tester.total_projects_tested || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-purple-50 border border-purple-100 text-center">
                      <span className="text-[10px] text-purple-600 font-bold uppercase block">Developers</span>
                      <span className="text-base font-extrabold text-purple-950">{tester.developers_involved_count || 1} dev(s)</span>
                    </div>
                  </div>
                </div>

                {/* 1. SECTION: TESTING WORKING ON TODAY */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-sky-600" />
                    Testing Working on Today ({tester.working_today?.length || 0})
                  </h4>

                  {Array.isArray(tester.working_today) && tester.working_today.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {tester.working_today.map((wt: any, wtIdx: number) => (
                        <div key={wtIdx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-900 line-clamp-1">{wt.task_title}</span>
                            {wt.is_active === 1 ? (
                              <Badge className="bg-emerald-600 text-white text-[9px] animate-pulse">Timer Running</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px]">Logged Today</Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 space-y-0.5">
                            <div>Project: <strong>{wt.project_name}</strong></div>
                            <div>Sent by Dev: <strong>{wt.developer_name}</strong></div>
                            <div>Date Sent: <span className="font-mono">{formatDateSent(wt.date_time_sent)}</span></div>
                            {wt.expected_date && (
                              <div className="text-amber-800 font-semibold">
                                Expected Date: {new Date(wt.expected_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                      No active testing timers logged yet today.
                    </p>
                  )}
                </div>

                {/* 2. SECTION: COMPLETED TESTED PROJECTS & SAME PROJECT TESTED STATS */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 text-purple-600" />
                      Tasks Sent to Tester & Completed by Project ({tester.completed_projects?.length || 0} Projects)
                    </h4>
                  </div>

                  {Array.isArray(tester.completed_projects) && tester.completed_projects.length > 0 ? (
                    <div className="space-y-3">
                      {tester.completed_projects.map((cp: any) => (
                        <div key={cp.project_id} className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200/80 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-sm">{cp.project_name}</span>
                              {cp.tested_count > 1 && (
                                <Badge className="bg-purple-600 text-white text-[10px] font-extrabold py-0.5 px-2">
                                  📁 Same Project Tested ({cp.tested_count} tested)
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-purple-900 font-semibold">
                              Developers Involved ({cp.developers_count}): <strong>{cp.developer_names?.join(", ") || "Smita Tikone"}</strong>
                            </div>
                          </div>

                          {/* List of completed tasks in this project */}
                          <div className="space-y-1.5 pt-1">
                            {cp.tasks.map((ct: any) => (
                              <div key={ct.task_id} className="p-2.5 rounded-lg bg-white border border-purple-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900">{ct.task_title}</div>
                                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                    <span>Sent by Dev: <strong className="text-slate-700">{ct.developer_name}</strong></span>
                                    <span>Sent: <strong className="font-mono text-slate-700">{formatDateSent(ct.date_time_sent)}</strong></span>
                                    {ct.expected_date && (
                                      <span className="text-amber-700 font-semibold">
                                        Expected: {new Date(ct.expected_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                                    Verified & Tested
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                      No completed tasks tested yet.
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: PROJECTS SUBMITTED FOR TESTING EXECUTIVE BRIEF */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          {projectQueue.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
              No projects currently submitted for QA testing.
            </div>
          ) : (
            projectQueue.map((pq) => (
              <div key={pq.project_id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                {/* Project Header Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-indigo-600" />
                      <h3 className="font-extrabold text-slate-900 text-base">{pq.project_name}</h3>
                      <Badge className="bg-purple-100 text-purple-900 border-purple-200 font-bold text-[10px]">
                        📁 {pq.total_queue_tasks} Tasks in QA
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        Project Lead / PM: <strong className="text-slate-700">{pq.project_creator_name || "Management"}</strong>
                      </span>
                      {Array.isArray(pq.developers) && pq.developers.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span>Developers who submitted:</span>
                          <div className="flex flex-wrap gap-1">
                            {pq.developers.map((dev: string, dIdx: number) => (
                              <span key={dIdx} className="bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                💻 {dev}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 font-bold border-amber-200">
                      {pq.ready_count} Ready for QA
                    </Badge>
                    <Badge variant="outline" className="bg-sky-50 text-sky-800 font-bold border-sky-200">
                      {pq.testing_count} Testing In Progress
                    </Badge>
                  </div>
                </div>

                {/* Submitted Tasks Table/Cards for this Project */}
                <div className="space-y-2.5">
                  {pq.tasks.map((t: any) => {
                    const taskLinksList: string[] = Array.isArray(t.task_links) && t.task_links.length > 0
                      ? t.task_links
                      : t.task_link ? [t.task_link] : [];

                    return (
                      <div key={t.id} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs hover:bg-slate-100/70 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="font-extrabold text-slate-900 text-sm">{t.title}</div>
                          <div className="text-slate-600 text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                            <span>
                              Developer (Sent By): <strong className="text-slate-900 font-bold">{t.developer_name || "Developer"}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-purple-600" />
                              Date Sent: <strong className="text-purple-900 font-mono">{formatDateSent(t.date_time_sent)}</strong>
                            </span>
                            {t.expected_date && (
                              <span className="text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Expected: {new Date(t.expected_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>

                          {/* Preview / PR links */}
                          {taskLinksList.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {taskLinksList.map((link, lIdx) => (
                                <a
                                  key={lIdx}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 text-[10px] font-bold border border-sky-200"
                                >
                                  <ExternalLink className="h-2.5 w-2.5" /> Preview Link {lIdx + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Status & Quick Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {t.status === "Testing" && t.testing_started_at && (
                            <span className="text-[10px] text-sky-700 font-semibold bg-sky-100 px-2 py-0.5 rounded">
                              {calculateWorkingDuration(t.testing_started_at)}
                            </span>
                          )}

                          <Badge className={t.status === "Testing" ? "bg-sky-600 text-white font-bold text-[10px]" : "bg-amber-500 text-white font-bold text-[10px]"}>
                            {t.status === "Ready for Testing" ? "Ready for QA" : t.status}
                          </Badge>

                          {t.status === "Ready for Testing" && (
                            <Button
                              size="sm"
                              onClick={() => handleStartTesting(t.id)}
                              className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-7 px-2.5 gap-1 shadow-xs cursor-pointer"
                            >
                              <Play className="h-3 w-3" /> Start Testing
                            </Button>
                          )}

                          {(t.status === "Testing" || t.status === "In Progress") && (
                            <Button
                              size="sm"
                              onClick={() => openFinishModal(t)}
                              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-7 px-2.5 gap-1 shadow-xs cursor-pointer"
                            >
                              <ShieldCheck className="h-3 w-3" /> Finish Testing
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}


