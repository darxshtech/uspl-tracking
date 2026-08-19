"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Volume2, 
  Sparkles,
  AlertTriangle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { playBellChime } from "@/lib/audio";
import { 
  sendWebPushNotification, 
  isNotificationSupported 
} from "@/lib/pushNotification";
import { showToast } from "@/lib/swal";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const initialLoadRef = useRef(true);
  const prevUnreadCountRef = useRef(0);
  const seenIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchNotifications();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);

        const currentUnread = data.filter((n: any) => !n.is_read).length;
        const newUnreadItems = data.filter((n: any) => !n.is_read && !seenIdsRef.current.has(n.id));
        const hasNewUnread = !initialLoadRef.current && currentUnread > prevUnreadCountRef.current;
        const hasUnreadWarnings = data.some((n: any) => !n.is_read && n.type === "warning");

        // Ring audio bell chime whenever new notifications arrive or if unread warning exists on load
        if (hasNewUnread || (initialLoadRef.current && hasUnreadWarnings)) {
          playBellChime();
        }

        // Trigger native desktop push notification for newly arrived unread notifications
        if (newUnreadItems.length > 0 && !initialLoadRef.current) {
          const latest = newUnreadItems[0];
          let targetUrl = "/dashboard";
          if (latest.type?.includes("task")) targetUrl = "/dashboard/tasks";
          if (latest.type?.includes("demo")) targetUrl = "/dashboard";
          if (latest.type?.includes("attendance") || latest.type?.includes("warning")) targetUrl = "/dashboard/attendance";

          sendWebPushNotification({
            title: latest.title || "Unitglo Attendance Notice",
            body: latest.message || "You have a new update in your tracking portal.",
            tag: `unitglo-notif-${latest.id}`,
            url: targetUrl,
          });
        }

        // Mark all current items as seen
        data.forEach((n: any) => seenIdsRef.current.add(n.id));

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
  const hasUnreadWarning = notifications.some((n) => !n.is_read && n.type === "warning");

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className={`relative rounded-full transition-all ${
          hasUnreadWarning 
            ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 ring-2 ring-amber-400/60 bg-amber-50/60 animate-pulse"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
        title="Notifications & Alerts"
      >
        <Bell className={`h-5 w-5 ${
          hasUnreadWarning 
            ? "text-amber-600" 
            : unreadCount > 0 
            ? "text-sky-600 animate-bounce" 
            : ""
        }`} />
        {unreadCount > 0 && (
          <span className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-md ${
            hasUnreadWarning 
              ? "bg-amber-500 shadow-amber-500/50 animate-ping" 
              : "bg-sky-500 shadow-sky-500/50"
          }`}>
            {unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-88 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 z-50 animate-fade-in space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
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
                  className="text-[11px] text-sky-600 hover:underline font-bold"
                >
                  Mark all read
                </button>
              )}
              <span className="text-xs text-slate-500 font-medium">{unreadCount} unread</span>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
            {notifications.length === 0 ? (
              <p className="text-xs text-center text-slate-400 py-6">No notifications yet</p>
            ) : (
              notifications.map((n) => {
                const isWarning = n.type === "warning";
                return (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isWarning
                        ? n.is_read
                          ? "bg-amber-50/50 border-amber-200/60 opacity-80 hover:opacity-100"
                          : "bg-amber-50 border-amber-300 font-medium shadow-xs hover:bg-amber-100/70"
                        : n.is_read
                        ? "bg-slate-50 border-slate-100 opacity-75 hover:opacity-100"
                        : "bg-sky-50/70 border-sky-200 font-medium shadow-xs hover:bg-sky-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      {isWarning ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      ) : n.type === "task_pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : n.type === "task_fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      ) : n.type === "task_assigned" ? (
                        <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      ) : (
                        <Info className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                      )}
                      <span className={`truncate ${isWarning ? "text-amber-900 font-bold" : "text-slate-900"}`}>
                        {n.title}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isWarning ? "text-amber-950 font-medium" : "text-slate-600"}`}>
                      {n.message}
                    </p>
                    <span suppressHydrationWarning className="text-[9px] text-slate-400 mt-1 block">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
