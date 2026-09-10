// Platform layer.
//
// The whole UI is shared between the website, the Capacitor mobile shell and
// the Electron desktop shell. This module is the only place that knows which
// of the three it is running in, and it hides the few behaviours that differ:
//   - where the API lives (same origin on the web, a remote server in a shell)
//   - how to open a link in the system browser
//   - how deep links (pomodrive://...) reach the app
//
// Feature code keeps calling fetch("/api/...") and never checks the platform.

import axios from "axios";

const trimSlash = (value) => (value || "").replace(/\/+$/, "");

/** Base URL of the API server, used by the shells (baked in at build time). */
export const API_BASE = trimSlash(process.env.NEXT_PUBLIC_API_URL);

/** Website that hosts /auth/native, where the shells sign in. */
export const WEB_URL = trimSlash(process.env.NEXT_PUBLIC_WEB_URL) || API_BASE;

/** Custom URL scheme both shells register for deep links. */
export const DEEP_LINK_SCHEME = "pomodrive";

/** "web" | "capacitor" | "electron" | "server" */
export function getPlatform() {
  if (typeof window === "undefined") return "server";
  if (window.pomodrive?.platform === "electron") return "electron";
  if (window.Capacitor?.isNativePlatform?.()) return "capacitor";
  return "web";
}

export function isNative() {
  const platform = getPlatform();
  return platform === "electron" || platform === "capacitor";
}

// True when the page was loaded from the bundle inside a shell (app://,
// capacitor://, https://localhost) rather than from a dev server over the
// network. Only then must relative "/api" URLs be pointed at API_BASE.
function servedFromBundle() {
  if (!isNative()) return false;
  const { protocol, hostname, port } = window.location;
  if (!/^https?:$/.test(protocol)) return true;
  return hostname === "localhost" && !port;
}

/** Absolute URL for an "/api/..." path inside a shell; unchanged on the web. */
export function apiUrl(path) {
  if (typeof path !== "string" || !path.startsWith("/api/")) return path;
  return servedFromBundle() && API_BASE ? API_BASE + path : path;
}

let bridgeInstalled = false;

/**
 * Route relative "/api" requests (fetch and axios) to API_BASE when the UI is
 * running from a shell bundle. NativeBridge calls this once at startup, so
 * feature code never has to know about the shells.
 */
export function installNativeBridge() {
  if (bridgeInstalled || typeof window === "undefined") return;
  bridgeInstalled = true;
  if (!servedFromBundle()) return;
  if (!API_BASE) {
    console.warn(
      "[platform] NEXT_PUBLIC_API_URL is not set; API calls will fail in the app shell."
    );
    return;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string") return nativeFetch(apiUrl(input), init);
    const url = input instanceof URL ? input : new URL(input.url);
    if (
      url.origin === window.location.origin &&
      url.pathname.startsWith("/api/")
    ) {
      const target = API_BASE + url.pathname + url.search;
      return nativeFetch(
        input instanceof URL ? target : new Request(target, input),
        init
      );
    }
    return nativeFetch(input, init);
  };
  axios.defaults.baseURL = API_BASE;
}

/** Open a URL in the system browser (new tab on the web). */
export async function openExternal(url) {
  const platform = getPlatform();
  if (platform === "electron") return window.pomodrive.openExternal(url);
  if (platform === "capacitor") {
    const { Browser } = await import("@capacitor/browser");
    return Browser.open({ url });
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return undefined;
}

/**
 * Subscribe to deep links (pomodrive://...). The handler also receives the
 * link the app was launched with, if any. Returns an unsubscribe function.
 */
export function onDeepLink(handler) {
  const platform = getPlatform();

  if (platform === "electron") {
    const off = window.pomodrive.onDeepLink(handler);
    window.pomodrive.getLaunchUrl().then((url) => url && handler(url));
    return off;
  }

  if (platform === "capacitor") {
    let cancelled = false;
    let listener = null;
    import("@capacitor/app").then(async ({ App }) => {
      if (cancelled) return;
      listener = await App.addListener("appUrlOpen", ({ url }) => handler(url));
      if (cancelled) {
        listener.remove();
        return;
      }
      const launch = await App.getLaunchUrl();
      if (launch?.url) handler(launch.url);
    });
    return () => {
      cancelled = true;
      listener?.remove();
    };
  }

  return () => {};
}
