"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, BellPlus, CalendarDays, Clock, Trash2, Users } from "lucide-react";
import { showError, showSuccess } from "@/lib/swal";

export default function RemindersWidget({ role, currentUserId }: { role: string; currentUserId: number }) {
  const [reminders, setReminders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [targetUserId, setTargetUserId] = useState<string>("GLOBAL");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isExecutive = ["Admin", "CEO", "PM"].includes(role);

  useEffect(() => {
    fetchReminders();
    if (isExecutive) fetchEmployees();
  }, [isExecutive]);

  const fetchReminders = async () => {
    try {
      const res = await fetch("/api/reminders");
      const data = await res.json();
      if (Array.isArray(data)) setReminders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err) {}
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetDate || !targetTime) return;

    setIsSubmitting(true);
    try {
      const isGlobal = targetUserId === "GLOBAL";
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          target_date: targetDate,
          target_time: targetTime,
          is_global: isGlobal,
          target_user_id: isGlobal ? null : parseInt(targetUserId)
        })
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess("Reminder Created");
        setModalOpen(false);
        fetchReminders();
        setTitle("");
        setMessage("");
      } else {
        showError("Failed to Create Reminder", data.error);
      }
    } catch (err) {
      showError("Error creating reminder.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    try {
      const res = await fetch(`/api/reminders?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchReminders();
      else showError("Failed to delete reminder");
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return null;
  if (!isExecutive && reminders.length === 0) return null; // Don't show empty widget to normal users

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Bell className="h-5 w-5 text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Meetings & Reminders</h2>
        </div>

        {isExecutive && (
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2">
                  <BellPlus className="h-4 w-4" /> Add Reminder
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Reminder</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Daily Standup" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase">Message (Optional)</Label>
                  <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Zoom link or details..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 uppercase">Date</Label>
                    <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 uppercase">Time</Label>
                    <Input type="time" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase">Assign To</Label>
                  <Select value={targetUserId} onValueChange={setTargetUserId}>
                    <SelectTrigger><SelectValue placeholder="Select target..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GLOBAL">All Employees (Global)</SelectItem>
                      <SelectItem value={currentUserId.toString()}>Myself Only</SelectItem>
                      {employees.filter((e: any) => e.id !== currentUserId).map((e: any) => (
                        <SelectItem key={e.id} value={e.id.toString()}>{e.name} ({e.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-2">
                  <Button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    {isSubmitting ? "Saving..." : "Create Reminder"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {reminders.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No active reminders.</p>
        ) : (
          reminders.map((r: any) => (
            <div key={r.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/80 transition-colors">
              <div className="flex gap-4 items-start">
                <div className="mt-1">
                  {r.is_global ? (
                    <Users className="h-5 w-5 text-indigo-500" />
                  ) : (
                    <Bell className="h-5 w-5 text-sky-500" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{r.title}</h4>
                  {r.message && <p className="text-sm text-slate-600 mt-0.5">{r.message}</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {new Date(r.target_date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {r.target_time}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200">
                      For: {r.is_global ? "Everyone" : r.target_user_id === currentUserId ? "Me" : r.target_name}
                    </span>
                  </div>
                </div>
              </div>
              {(isExecutive || r.created_by === currentUserId) && (
                <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
