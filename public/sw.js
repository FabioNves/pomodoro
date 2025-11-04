self.addEventListener("notificationclick", function (event) {
  console.log("Notification clicked:", event);

  event.preventDefault();
  event.notification.close();

  // Handle different actions
  if (event.action === "start-break") {
    // Focus the app and send message to start break
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then(function (clients) {
          if (clients.length > 0) {
            clients[0].focus();
            clients[0].postMessage({ action: "start-break" });
          } else {
            // Open new window if no clients
            clients.openWindow("/");
          }
        })
    );
  } else if (event.action === "finish-session") {
    // Focus the app and send message to finish session
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then(function (clients) {
          if (clients.length > 0) {
            clients[0].focus();
            clients[0].postMessage({ action: "finish-session" });
          } else {
            clients.openWindow("/");
          }
        })
    );
  } else {
    // Default click - just focus the app
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then(function (clients) {
          if (clients.length > 0) {
            clients[0].focus();
          } else {
            clients.openWindow("/");
          }
        })
    );
  }
});

self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
