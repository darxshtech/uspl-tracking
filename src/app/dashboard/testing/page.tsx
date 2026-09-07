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
  const isTesterOrAdmin = role === "Tester" || role === "Admin";

  const [tasks, setTasks] = useState<any[]>([]);
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
    if (isTesterOrAdmin) {
      const interval = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        fetchTestingQueue();
      }, 20000);
      return () => clearInterval(interval);
    } else if (role) {
      setLoading(false);
    }
  }, [role, isTesterOrAdmin]);

  const fetchTestingQueue = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/testing?_=" + Date.now());
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
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

  if (!isTesterOrAdmin) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-lg mx-auto mt-8">
        <div className="h-16 w-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">QA Testing Queue Access Restricted</h2>
        <p className="text-sm text-slate-500">
          The QA Testing Verification Station is dedicated exclusively to team members with the <strong>Tester</strong> role.
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
            QA Verification & Active Testing Station
          </h1>
          <p className="text-slate-500 mt-1">
            Active testing tasks submitted by developers. Completed verifications automatically log to Work Accomplishments & Audit Log.
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

      {/* QA Tasks Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Task & Preview Links</TableHead>
              <TableHead className="font-bold">Project & Assigner</TableHead>
              <TableHead className="font-bold">Developer</TableHead>
              <TableHead className="font-bold">QA Status</TableHead>
              <TableHead className="font-bold text-right">Testing Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading QA station...</TableCell></TableRow>
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
                    <TableCell className="align-top max-w-sm">
                      <div className="font-bold text-slate-900 text-sm">{task.title}</div>
                      {task.description && (
                        <p className="text-xs text-slate-600 whitespace-pre-wrap break-words mt-1 leading-relaxed max-w-md">
                          {task.description}
                        </p>
                      )}
                      
                      {/* Multiple Developer Preview Links */}
                      {taskLinksList.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Developer Deliverable URLs:</span>
                          <div className="flex flex-wrap gap-1">
                            {taskLinksList.map((link, lIdx) => (
                              <a
                                key={lIdx}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 text-[11px] font-bold border border-sky-200 transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" /> Preview Link {lIdx + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-600 font-semibold mt-1 inline-block">No links provided</span>
                      )}

                      {/* Developer Sub-tasks / Checklists Passed to Tester */}
                      {Array.isArray(task.checklists) && task.checklists.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
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

                          {/* Preview first 3 or all if expanded */}
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
                                <div className="flex-1 min-w-0">
                                  <span className={`whitespace-pre-wrap break-words leading-snug block ${
                                    c.is_completed ? "line-through text-slate-400 font-normal" : "font-medium text-slate-800"
                                  }`}>
                                    {c.item_text}
                                  </span>

                                  {/* Subtask Attachments */}
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

                    <TableCell className="align-top">
                      <div className="font-bold text-slate-900 text-xs">{task.project_name || "N/A"}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-sky-500" />
                        <span>
                          Assigned By:{" "}
                          <strong>
                            {task.project_creator_name || task.creator_name || "Management"} ({task.project_creator_role || task.creator_role || "PM"})
                          </strong>
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="align-top text-slate-700 text-xs font-semibold">
                      {task.assignee_name || "N/A"}
                    </TableCell>

                    <TableCell className="align-top space-y-1">
                      <div>
                        {task.status === "Ready for Testing" && (
                          <Badge className="bg-amber-500 text-white font-bold animate-pulse">Ready for QA</Badge>
                        )}
                        {task.status === "Testing" && (
                          <Badge className="bg-sky-600 text-white font-bold flex items-center gap-1 animate-pulse">
                            <Clock className="h-3 w-3" /> Testing In Progress
                          </Badge>
                        )}
                      </div>

                      {task.testing_started_at && (
                        <div className="text-[10px] text-slate-500">
                          Started: {new Date(task.testing_started_at).toLocaleTimeString()}
                        </div>
                      )}

                      {task.test_sheet_link && (
                        <div>
                          <a
                            href={task.test_sheet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold hover:underline"
                          >
                            <FileSpreadsheet className="h-3 w-3" /> QA Test Sheet
                          </a>
                        </div>
                      )}
                    </TableCell>

                    {/* Action Buttons */}
                    <TableCell className="align-top text-right space-y-1.5">
                      {/* Step 1: Start Testing (Check-in) */}
                      {task.status === "Ready for Testing" && (
                        <Button
                          size="sm"
                          onClick={() => handleStartTesting(task.id)}
                          className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                        >
                          <Play className="h-3.5 w-3.5" /> Start Testing
                        </Button>
                      )}

                      {/* Step 2: Testing active -> Finish Testing (Check-out & Record Audit) */}
                      {task.status === "Testing" && (
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
    </div>
  );
}
