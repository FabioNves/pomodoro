// Service worker: today only for notifications.
//
// Timer notifications (data.timer, shown by showTimerNotification in
// src/utils/notifications.js) carry buttons: pause, resume, start-break,
// start-focus, end. A button is passed to an open tab as
// { type: "timer-action", action }, where TimerProvider acts on it, without
// bringing the tab to the front. A click on the notification itself focuses
// the app, or opens it when no tab is open.

const TIMER_ACTIONS = ["pause", "resume", "start-break", "start-focus", "end"];

function pickClient(list) {
  return list.find((c) => c.focused) || list.find((c) => c.visibilityState === "visible") || list[0] || null;
}

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const action = event.action;
  const isTimer = Boolean(event.notification.data && event.notification.data.timer);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      const client = pickClient(list);
      if (isTimer && TIMER_ACTIONS.includes(action)) {
        if (client) {
          client.postMessage({ type: "timer-action", action: action });
          return undefined;
        }
        // No tab open: open the dashboard; the button cannot reach a timer
        // that is not running anywhere.
        return self.clients.openWindow("/dashboard");
      }
      if (client) return client.focus();
      return self.clients.openWindow(isTimer ? "/dashboard" : "/");
    }),
  );
});

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
