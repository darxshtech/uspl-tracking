// Unitglo Solutions - Web Push & Background Notification Service Worker

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle native push event (if push server triggers it)
self.addEventListener("push", (event) => {
  let data = {
    title: "Unitglo Tracking Alert",
    body: "You have a new update in your tracking portal.",
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    url: "/dashboard",
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (_) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/android-chrome-192x192.png",
    badge: data.badge || "/favicon-32x32.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/dashboard",
    },
    actions: [
      { action: "open_app", title: "View Dashboard" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click to focus or open browser tab
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
