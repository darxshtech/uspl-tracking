"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCircle2, XCircle, Info, Volume2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playBellChime } from "@/lib/audio";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const initialLoadRef = useRef(true);
  const prevUnreadCountRef = useRef(0);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);

        const currentUnread = data.filter((n: any) => !n.is_read).length;

        // If new unread notification arrived after initial page load, play chime!
        if (!initialLoadRef.current && currentUnread > prevUnreadCountRef.current) {
          playBellChime();
        }

        prevUnreadCountRef.current = currentUnread;
        initialLoadRef.current = false;
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    for (const id of unreadIds) {
      await markAsRead(id);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full"
        title="Notifications & Alerts"
      >
        <Bell className={`h-5 w-5 ${unreadCount > 0 ? "text-sky-600 animate-bounce" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white shadow-md shadow-sky-500/50">
            {unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-84 rounded-xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 z-50 animate-fade-in">
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-sm text-slate-900">Notifications</h4>
              <button
                type="button"
                onClick={() => playBellChime()}
                title="Test Chime Sound"
                className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[10px] text-sky-600 hover:underline font-semibold"
                >
                  Mark all read
                </button>
              )}
              <span className="text-xs text-slate-500 font-medium">{unreadCount} unread</span>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-center text-slate-400 py-4">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    n.is_read ? "bg-slate-50 border-slate-100 opacity-75" : "bg-sky-50/70 border-sky-200 font-medium shadow-xs"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold mb-1">
                    {n.type === "task_pass" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : n.type === "task_fail" ? (
                      <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    ) : n.type === "task_assigned" ? (
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    ) : (
                      <Info className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                    )}
                    <span className="truncate">{n.title}</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                  <span suppressHydrationWarning className="text-[9px] text-slate-400 mt-1 block">
                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
