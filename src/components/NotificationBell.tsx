"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Volume2, 
  Sparkles, 
  BellRing, 
  BellOff, 
  Send 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { playBellChime } from "@/lib/audio";
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendWebPushNotification, 
  isNotificationSupported 
} from "@/lib/pushNotification";
import { showToast } from "@/lib/swal";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const initialLoadRef = useRef(true);
  const prevUnreadCountRef = useRef(0);
  const seenIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (isNotificationSupported()) {
      setPushPermission(getNotificationPermission());
    }

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

        // If new unread notification arrived after initial page load
        if (!initialLoadRef.current && currentUnread > prevUnreadCountRef.current) {
          playBellChime();

          // Find the newly arrived unread notifications
          const newItems = data.filter((n: any) => !n.is_read && !seenIdsRef.current.has(n.id));
          if (newItems.length > 0) {
            const latest = newItems[0];
            let targetUrl = "/dashboard";
            if (latest.type?.includes("task")) targetUrl = "/dashboard/tasks";
            if (latest.type?.includes("demo")) targetUrl = "/dashboard";
            if (latest.type?.includes("attendance")) targetUrl = "/dashboard/attendance";

            sendWebPushNotification({
              title: latest.title || "Unitglo Task Notification",
              body: latest.message || "You have a new update in your tracking portal.",
              tag: `unitglo-notif-${latest.id}`,
              url: targetUrl,
            });
          }
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

  const handleRequestPushPermission = async () => {
    const perm = await requestNotificationPermission();
    setPushPermission(perm);
    if (perm === "granted") {
      showToast("Web Push Notifications Enabled!");
      sendWebPushNotification({
        title: "🔔 Notifications Activated!",
        body: "You will now receive instant desktop & mobile push alerts for tasks and releases.",
        url: "/dashboard",
      });
    } else if (perm === "denied") {
      showToast("Notification permission was denied in browser settings.");
    }
  };

  const handleTestPush = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pushPermission !== "granted") {
      await handleRequestPushPermission();
    }

    playBellChime();
    const success = await sendWebPushNotification({
      title: "⚡ Test Notification Alert",
      body: "Web App Push notifications are actively running for your Unitglo tracking account!",
      url: "/dashboard",
    });

    if (success) {
      showToast("Test push notification sent!");
    } else {
      showToast("Please enable notifications in browser permissions.");
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

          {/* Web Push Banner / Controls */}
          {pushPermission !== "granted" ? (
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-sky-600 shrink-0" />
                <div className="text-[11px] leading-tight">
                  <span className="font-bold text-slate-900 block">Enable Desktop Push</span>
                  <span className="text-slate-500">Get native OS alert popups</span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleRequestPushPermission}
                className="h-7 px-2.5 text-[11px] font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
              >
                Enable
              </Button>
            </div>
          ) : (
            <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Web Push Active</span>
              </div>
              <button
                type="button"
                onClick={handleTestPush}
                className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline flex items-center gap-1"
              >
                <Send className="h-3 w-3" /> Test Push
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
            {notifications.length === 0 ? (
              <p className="text-xs text-center text-slate-400 py-6">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    n.is_read
                      ? "bg-slate-50 border-slate-100 opacity-75 hover:opacity-100"
                      : "bg-sky-50/70 border-sky-200 font-medium shadow-xs hover:bg-sky-50"
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
                    {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
