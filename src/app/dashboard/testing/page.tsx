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
  Briefcase 
} from "lucide-react";

export default function TestingQueuePage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [remarks, setRemarks] = useState("");
  const [submitToDemo, setSubmitToDemo] = useState(true);
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState<"PASS" | "FAIL">("PASS");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTestingQueue();
  }, []);

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

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/testing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: selectedTask.id,
          result: actionType,
          remarks,
          submit_to_demo: actionType === "PASS" ? submitToDemo : false,
        }),
      });

      if (res.ok) {
        setOpen(false);
        setRemarks("");
        setSelectedTask(null);
        fetchTestingQueue();
      } else {
        alert("Failed to submit test result");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const openTestModal = (task: any, type: "PASS" | "FAIL") => {
    setSelectedTask(task);
    setActionType(type);
    setRemarks(type === "PASS" ? "All test cases passed cleanly and verified on staging." : "Issue found during verification.");
    setSubmitToDemo(true);
    setOpen(true);
  };

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-sky-500" />
            QA Verification & Demo Release Queue
          </h1>
          <p className="text-slate-500 mt-1">
            Audit submitted tasks via developer test links, verify deliverables, and trigger Demo Ready alerts to PM & CEO.
          </p>
        </div>
      </div>

      {/* QA Verification Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {actionType === "PASS" ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
              {actionType === "PASS" ? "Pass QA Verification" : "Fail Task & Request Changes"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTestSubmit} className="space-y-4 pt-2">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 font-medium border border-slate-200 space-y-1">
              <div>Task: <span className="font-bold text-slate-900">{selectedTask?.title}</span></div>
              <div className="text-slate-600">Project: <strong>{selectedTask?.project_name || "N/A"}</strong></div>
              <div className="text-slate-600">
                Assigned by: <strong>{selectedTask?.project_creator_name || selectedTask?.creator_name || "Management"} ({selectedTask?.project_creator_role || selectedTask?.creator_role || "PM"})</strong>
              </div>
              <div className="text-slate-600">Developer: <strong>{selectedTask?.assignee_name || "N/A"}</strong></div>
              {selectedTask?.task_link && (
                <div className="pt-1">
                  <a
                    href={selectedTask.task_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-600 font-bold hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Open Test / PR Link
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remarks" className="font-semibold text-slate-700">Testing Remarks & QA Notes *</Label>
              <Input
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Detail verification results..."
                required
              />
            </div>

            {actionType === "PASS" && (
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1">
                <label className="flex items-center gap-2 text-xs font-bold text-indigo-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={submitToDemo}
                    onChange={(e) => setSubmitToDemo(e.target.checked)}
                    className="rounded border-indigo-300 text-indigo-600 h-4 w-4"
                  />
                  <span>Flag as "Submit to Demo" (Throw Instant Alert to PM & CEO)</span>
                </label>
                <p className="text-[11px] text-indigo-700 pl-6">
                  Notifies CEO and PM immediately that the feature is ready for executive/client review.
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className={`w-full font-bold text-white shadow-md ${
                actionType === "PASS"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {submitting ? "Submitting..." : `Confirm ${actionType} & Notify Team`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Task & Test Link</TableHead>
              <TableHead className="font-bold">Project & Assigner</TableHead>
              <TableHead className="font-bold">Developer</TableHead>
              <TableHead className="font-bold">Current QA Status</TableHead>
              <TableHead className="font-bold text-right">Audit & Demo Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading QA queue...</TableCell></TableRow>
            ) : tasks.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-10">No tasks in QA queue.</TableCell></TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="align-top">
                    <div className="font-bold text-slate-900 text-sm">{task.title}</div>
                    {task.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{task.description}</p>}
                    {task.task_link ? (
                      <div className="mt-1">
                        <a
                          href={task.task_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 text-[11px] font-bold border border-sky-200 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" /> Test Link: {task.task_link}
                        </a>
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-semibold mt-1 inline-block">No link provided</span>
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

                  <TableCell className="align-top">
                    {task.status === "Ready for Testing" && (
                      <Badge className="bg-amber-500 text-white font-bold animate-pulse">Ready for QA</Badge>
                    )}
                    {task.status === "Tested (PASS)" && (
                      <Badge className="bg-emerald-600 text-white font-bold">QA Passed</Badge>
                    )}
                    {task.status === "Ready for Demo" && (
                      <Badge className="bg-indigo-600 text-white font-bold shadow-xs animate-pulse">🚀 Demo Ready (PM/CEO Alerted)</Badge>
                    )}
                    {task.status === "Changes Required" && (
                      <Badge className="bg-red-500 text-white font-bold">Changes Required (Failed)</Badge>
                    )}
                    {task.status === "Completed" && (
                      <Badge className="bg-emerald-500 text-white font-bold">Completed</Badge>
                    )}
                    {!["Ready for Testing", "Tested (PASS)", "Ready for Demo", "Changes Required", "Completed"].includes(task.status) && (
                      <Badge variant="outline">{task.status}</Badge>
                    )}
                  </TableCell>

                  <TableCell className="align-top text-right space-x-2">
                    {task.status === "Ready for Testing" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openTestModal(task, "PASS")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 shadow-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> PASS
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openTestModal(task, "FAIL")}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1 shadow-xs"
                        >
                          <XCircle className="h-3.5 w-3.5" /> FAIL
                        </Button>
                      </>
                    )}

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
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                        Demo Alert Dispatched
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
