// Browser notification helpers shared by the public timer, the timer page
// and the dashboard.

// Notification utilities
export const requestNotificationPermission = async () => {
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
};

export const showNotification = (title, options = {}) => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  // `actions` and the callback props are only meaningful for persistent
  // (service-worker) notifications. Passing `actions` to the plain
  // Notification constructor throws a TypeError, which would abort whatever
  // called us (e.g. the focus-end handler before it can play the alarm), so
  // keep them out of the constructor.
  const { actions, onClick, onStartBreak, onFinishSession, ...notificationOptions } =
    options;

  let notification;
  try {
    notification = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      body: options.body || "",
      tag: "pomodoro-timer",
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      ...notificationOptions,
    });
  } catch (error) {
    console.error("Error showing notification:", error);
    return;
  }

  notification.onclick = function () {
    window.focus();
    notification.close();
    if (onClick) {
      onClick();
    }
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener(
      "notificationclick",
      function (event) {
        event.preventDefault();
        window.focus();

        if (event.action === "start-break" && onStartBreak) {
          onStartBreak();
        } else if (event.action === "finish-session" && onFinishSession) {
          onFinishSession();
        }

        event.notification.close();
      }
    );
  }

  setTimeout(() => {
    if (notification) {
      notification.close();
    }
  }, 15000);

  return notification;
};
