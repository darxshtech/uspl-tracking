/**
 * Web App Push Notification Helper for Unitglo Tracking Portal
 * Supports native Desktop & Mobile OS push notifications via Web Notifications API & Service Worker.
 */

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    swRegistration = reg;
    return reg;
  } catch (err) {
    console.warn("Service Worker registration failed:", err);
    return null;
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await registerServiceWorker();
    }
    return permission;
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return "denied";
  }
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
}

export async function sendWebPushNotification(payload: NotificationPayload): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  const { title, body, icon = "/android-chrome-192x192.png", badge = "/favicon-32x32.png", tag, url = "/dashboard" } = payload;

  try {
    // 1. Prefer Service Worker notification (works smoothly with OS action buttons & background tabs)
    if ("serviceWorker" in navigator) {
      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.ready.catch(() => null);
      }

      if (swRegistration && "showNotification" in swRegistration) {
        await swRegistration.showNotification(title, {
          body,
          icon,
          badge,
          tag: tag || `unitglo-${Date.now()}`,
          data: { url },
          vibrate: [200, 100, 200],
        } as any);
        return true;
      }
    }

    // 2. Fallback to standard Notification API
    const notification = new Notification(title, {
      body,
      icon,
      badge,
      tag: tag || `unitglo-${Date.now()}`,
      data: { url },
    });

    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (url && window.location.pathname !== url) {
        window.location.href = url;
      }
      notification.close();
    };

    return true;
  } catch (err) {
    console.error("Failed to show web push notification:", err);
    return false;
  }
}
