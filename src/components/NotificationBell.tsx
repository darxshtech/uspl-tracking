"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Volume2, 
  Sparkles,
  AlertTriangle,
  X,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { playBellChime } from "@/lib/audio";
import { 
  sendWebPushNotification, 
  isNotificationSupported 
} from "@/lib/pushNotification";

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [latestPopup, setLatestPopup] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialLoadRef = useRef(true);
  const prevUnreadCountRef = useRef(0);
  const seenIdsRef = useRef<Set<number>>(new Set());

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getNotificationRedirectUrl = (n: any): string => {
    const title = (n.title || "").toLowerCase();
    const msg = (n.message || "").toLowerCase();
    const type = (n.type || "").toLowerCase();

    if (
      type.includes("task") ||
      type.includes("demo") ||
      title.includes("submit") ||
      title.includes("fast-track") ||
      title.includes("demo") ||
      title.includes("test") ||
      title.includes("task") ||
      msg.includes("task") ||
      msg.includes("fast-tracked") ||
      msg.includes("demo")
    ) {
      return "/dashboard/tasks";
    }

    if (
      type.includes("attendance") ||
      type.includes("warning") ||
      title.includes("attendance") ||
      title.includes("shift") ||
      title.includes("leave") ||
      title.includes("absent") ||
      title.includes("half day") ||
      msg.includes("attendance") ||
      msg.includes("shift") ||
      msg.includes("half day") ||
      msg.includes("absent")
    ) {
      return "/dashboard/attendance";
    }

    if (title.includes("credential") || msg.includes("credential")) {
      return "/dashboard/credentials";
    }

    if (title.includes("project") || msg.includes("project")) {
      return "/dashboard/projects";
    }

    if (title.includes("policy") || msg.includes("policy")) {
      return "/dashboard/policies";
    }

    return "/dashboard";
  };

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

        // Ring audio bell chime and trigger popup when new notifications arrive
        if (hasNewUnread || (initialLoadRef.current && hasUnreadWarnings)) {
          playBellChime();
        }

        if (newUnreadItems.length > 0 && !initialLoadRef.current) {
          const latest = newUnreadItems[0];
          setLatestPopup(latest);
          setTimeout(() => {
            setLatestPopup(null);
          }, 8000);

          const targetUrl = getNotificationRedirectUrl(latest);

          sendWebPushNotification({
            title: latest.title || "Unitglo Notice",
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

  const handleNotificationClick = async (n: any) => {
    if (!n.is_read) {
      await markAsRead(n.id);
    }
    setOpen(false);
    setLatestPopup(null);
    const targetUrl = getNotificationRedirectUrl(n);
    router.push(targetUrl);
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
    <div ref={containerRef} className="relative">
      {/* Floating Live Pop-up Toast for Newly Arrived Notification */}
      {latestPopup && (
        <div 
          onClick={() => handleNotificationClick(latestPopup)}
          className="fixed top-5 right-5 z-[9999] max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-sky-200/80 cursor-pointer animate-blink-twice hover:shadow-sky-200/50 hover:scale-[1.02] transition-all duration-300 ring-2 ring-sky-400/40"
        >
          <div className="flex items-start gap-3">
            <div className="p-1 rounded-full bg-sky-100 text-sky-600 mt-0.5 shrink-0">
              <Info className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center justify-between gap-1 mb-1">
                <h5 className="font-extrabold text-sm text-slate-900 truncate">
                  {latestPopup.title}
                </h5>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {new Date(latestPopup.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                {latestPopup.message}
              </p>
              <div className="mt-2 text-[10px] font-bold text-sky-600 flex items-center gap-1">
                <span>Click to view</span> &rarr;
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setLatestPopup(null);
              }}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bell Button */}
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
              : "bg-sky-500 shadow-sky-500/50 animate-blink-twice"
          }`}>
            {unreadCount}
          </span>
        )}
      </Button>

      {/* Notification Dropdown Panel */}
      {open && (
        <div className="absolute -right-2 sm:right-0 mt-2 w-[calc(100vw-1.75rem)] sm:w-96 max-w-[400px] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 z-50 animate-fade-in space-y-3">
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
          <div className="max-h-80 overflow-y-auto space-y-2 pr-0.5">
            {notifications.length === 0 ? (
              <p className="text-xs text-center text-slate-400 py-6">No notifications yet</p>
            ) : (
              notifications.map((n) => {
                const isWarning = n.type === "warning";
                const isUnread = !n.is_read;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-200 relative group hover:scale-[1.01] ${
                      isUnread ? "animate-blink-twice" : ""
                    } ${
                      isWarning
                        ? isUnread
                          ? "bg-amber-50 border-amber-300 font-medium shadow-xs hover:bg-amber-100/70"
                          : "bg-amber-50/40 border-amber-200/50 opacity-80 hover:opacity-100"
                        : isUnread
                        ? "bg-sky-50/80 border-sky-200 font-medium shadow-xs hover:bg-sky-100/80"
                        : "bg-slate-50 border-slate-100 opacity-75 hover:opacity-100 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {isWarning ? (
                        <div className="p-1 rounded-full bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </div>
                      ) : n.type === "task_pass" ? (
                        <div className="p-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                      ) : n.type === "task_fail" ? (
                        <div className="p-1 rounded-full bg-red-100 text-red-700 shrink-0 mt-0.5">
                          <XCircle className="h-3.5 w-3.5" />
                        </div>
                      ) : n.type === "task_assigned" ? (
                        <div className="p-1 rounded-full bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-full bg-sky-100 text-sky-600 shrink-0 mt-0.5">
                          <Info className="h-3.5 w-3.5" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h5 className={`font-bold text-xs truncate ${isWarning ? "text-amber-950" : "text-slate-900"}`}>
                            {n.title}
                          </h5>
                          <span suppressHydrationWarning className="text-[10px] text-slate-400 font-mono shrink-0">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className={`text-[11px] leading-relaxed line-clamp-2 ${isWarning ? "text-amber-900" : "text-slate-600"}`}>
                          {n.message}
                        </p>
                      </div>
                    </div>
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
