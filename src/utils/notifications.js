// Notification helpers shared by the public timer, the timer page and the
// dashboard. The website and the desktop app use the browser Notification
// API; the mobile app uses native local notifications, because Android's
// WebView has no Notification API at all.

import { DEEP_LINK_SCHEME, getPlatform, onDeepLink, showDesktopNotification } from "@/lib/platform";

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

  // Buttons need a service-worker notification: see showTimerNotification.
  const { actions: _actions, onClick, ...notificationOptions } = options;

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

  setTimeout(() => {
    if (notification) {
      notification.close();
    }
  }, 15000);

  return notification;
};

/* ── timer notifications with buttons ──────────────────── */

// The buttons a timer notification can carry. The ids travel through the
// service worker (website) or a pomodrive://timer?action= link (desktop
// app), and TimerProvider maps them onto its controls.
export const TIMER_ACTIONS = {
  pause: "pause",
  resume: "resume",
  startBreak: "start-break",
  startFocus: "start-focus",
  end: "end",
};
const ACTION_IDS = new Set(Object.values(TIMER_ACTIONS));
const TIMER_TAG = "pomodrive-timer";

/**
 * A timer notification with up to two buttons ({ id, label }):
 *  - desktop app: a Windows toast from the main process;
 *  - website: a service-worker notification (Chrome and Edge show the
 *    buttons; elsewhere it is a plain notification);
 *  - phone app, or no service worker: the plain notification, no buttons.
 */
export async function showTimerNotification({ title, body = "", actions = [] }) {
  const buttons = actions.filter((a) => ACTION_IDS.has(a.id)).slice(0, 2);
  const platform = getPlatform();
  if (platform === "electron") {
    if (await showDesktopNotification({ title, body, actions: buttons })) return;
  }
  if (platform === "web" && "serviceWorker" in navigator && "Notification" in window && Notification.permission === "granted") {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: TIMER_TAG,
          renotify: true,
          requireInteraction: true,
          actions: buttons.map((b) => ({ action: b.id, title: b.label })),
          data: { timer: true },
        });
        return;
      }
    } catch (error) {
      console.error("Timer notification failed, falling back:", error);
    }
  }
  showNotification(title, { body });
}

/** Calls `handler(actionId)` when a timer notification's button is pressed. Returns an unsubscribe. */
export function onTimerNotificationAction(handler) {
  if (typeof window === "undefined") return () => {};
  const platform = getPlatform();
  if (platform === "electron") {
    const prefix = `${DEEP_LINK_SCHEME}://timer?action=`;
    return onDeepLink((url) => {
      if (typeof url !== "string" || !url.startsWith(prefix)) return;
      const id = url.slice(prefix.length);
      if (ACTION_IDS.has(id)) handler(id);
    });
  }
  if (platform === "web" && "serviceWorker" in navigator) {
    const onMessage = (event) => {
      const data = event.data;
      if (data?.type === "timer-action" && ACTION_IDS.has(data.action)) handler(data.action);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }
  return () => {};
}
