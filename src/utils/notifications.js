// Notification helpers shared by the public timer, the timer page and the
// dashboard. The website and the desktop app use the browser Notification
// API; the mobile app uses native local notifications, because Android's
// WebView has no Notification API at all.

import { getPlatform } from "@/lib/platform";

async function nativeNotifications() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

export const requestNotificationPermission = async () => {
  if (getPlatform() === "capacitor") {
    try {
      const LocalNotifications = await nativeNotifications();
      const { display } = await LocalNotifications.requestPermissions();
      return display === "granted";
    } catch (error) {
      console.error("Notification permission request failed:", error);
      return false;
    }
  }

  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
};

async function showNativeNotification(title, body) {
  try {
    const LocalNotifications = await nativeNotifications();
    await LocalNotifications.schedule({
      notifications: [{ id: Date.now() % 2147483647, title, body }],
    });
  } catch (error) {
    console.error("Error showing notification:", error);
  }
}

export const showNotification = (title, options = {}) => {
  if (getPlatform() === "capacitor") {
    showNativeNotification(title, options.body || "");
    return undefined;
  }

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return undefined;
  }

  // `actions` and the callback props are only meaningful for persistent
  // (service-worker) notifications. Passing `actions` to the plain
  // Notification constructor throws a TypeError, which would abort whatever
  // called us (e.g. the focus-end handler before it can play the alarm), so
  // keep them out of the constructor.
  const {
    actions,
    onClick,
    onStartBreak,
    onFinishSession,
    ...notificationOptions
  } = options;

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
    return undefined;
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
