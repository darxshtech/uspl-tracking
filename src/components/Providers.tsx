"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { registerServiceWorker, requestNotificationPermission, isNotificationSupported } from "@/lib/pushNotification";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Auto-register service worker for native Web Push Notifications
    registerServiceWorker();

    // Auto-prompt / request desktop push notification permission on portal load
    if (isNotificationSupported() && Notification.permission === "default") {
      setTimeout(() => {
        requestNotificationPermission().catch(console.warn);
      }, 1500);
    }
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
