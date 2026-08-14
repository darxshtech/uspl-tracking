"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Link as LinkIcon
} from "lucide-react";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function TestingQueuePage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isTesterOrAdmin = role === "Tester" || role === "Admin";

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Finish Testing Modal State
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [issuesCount, setIssuesCount] = useState<number>(0);
  const [testSheetLink, setTestSheetLink] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [submittingAudit, setSubmittingAudit] = useState(false);

  useEffect(() => {
    if (isTesterOrAdmin) {
      fetchTestingQueue();
    } else if (role) {
      setLoading(false);
    }
  }, [role, isTesterOrAdmin]);

  const fetchTestingQueue = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
      } else {
        alert("Failed to start testing session.");
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
      alert("Please provide the link to the test sheet or bug tracker so the developer can review the issues.");
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
      } else {
        const data = await res.json();
        alert(`Failed to submit QA audit: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to complete testing audit.");
    } finally {
      setSubmittingAudit(false);
    }
  };

  // 4. Submit to Demo (Only when QA fully passed) -> Alert CEO & PM
  const handleDirectDemoSubmit = async (taskId: number) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: "Ready for Demo" }),
      });
      if (res.ok) {
        fetchTestingQueue();
      }
    } catch (err) {
      console.error(err);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-sky-500" />
            QA Verification & Testing Station
          </h1>
          <p className="text-slate-500 mt-1">
            Start testing sessions (timed check-in), audit multiple developer deliverable links, record issue counts with test sheet links, and pass fully fixed features for Demo release.
          </p>
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
                If issues are greater than 0, task will be returned to the developer for fixes and will NOT go to PM or CEO.
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
              <TableHead className="font-bold">QA Status & Audit</TableHead>
              <TableHead className="font-bold text-right">Testing Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading QA station...</TableCell></TableRow>
            ) : tasks.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-10">No tasks in QA queue.</TableCell></TableRow>
            ) : (
              tasks.map((task) => {
                const taskLinksList: string[] = Array.isArray(task.task_links) && task.task_links.length > 0
                  ? task.task_links
                  : task.task_link ? [task.task_link] : [];

                return (
                  <TableRow key={task.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="align-top max-w-sm">
                      <div className="font-bold text-slate-900 text-sm">{task.title}</div>
                      {task.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{task.description}</p>}
                      
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
                        {task.status === "Tested (PASS)" && (
                          <Badge className="bg-emerald-600 text-white font-bold">QA Passed (Fully Fixed)</Badge>
                        )}
                        {task.status === "Ready for Demo" && (
                          <Badge className="bg-indigo-600 text-white font-bold shadow-xs animate-pulse">🚀 Demo Ready (PM/CEO Alerted)</Badge>
                        )}
                        {task.status === "Changes Required" && (
                          <Badge className="bg-red-500 text-white font-bold">Changes Required ({task.issues_count || 1} Issues)</Badge>
                        )}
                        {task.status === "Completed" && (
                          <Badge className="bg-emerald-500 text-white font-bold">Completed</Badge>
                        )}
                        {!["Ready for Testing", "Testing", "Tested (PASS)", "Ready for Demo", "Changes Required", "Completed"].includes(task.status) && (
                          <Badge variant="outline">{task.status}</Badge>
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

                      {/* Re-test if changes were requested and dev resubmitted */}
                      {task.status === "Changes Required" && (
                        <Button
                          size="sm"
                          onClick={() => handleStartTesting(task.id)}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                        >
                          <Play className="h-3.5 w-3.5" /> Re-test Task
                        </Button>
                      )}

                      {/* Step 3: Tested (PASS) -> Submit to Demo (Alert CEO & PM) */}
                      {task.status === "Tested (PASS)" && (
                        <Button
                          size="sm"
                          onClick={() => handleDirectDemoSubmit(task.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-md animate-bounce"
                        >
                          <Rocket className="h-3.5 w-3.5" /> Submit to Demo
                        </Button>
                      )}

                      {task.status === "Ready for Demo" && (
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 inline-block">
                          Demo Alert Sent to CEO/PM
                        </span>
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
