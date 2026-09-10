"use client";

// Mounted once in the root layout. Connects the shared UI to the app shells:
// routes API calls to the server and completes sign-in from pomodrive://auth
// deep links. Does nothing on the website.

import { useEffect } from "react";
import toast from "react-hot-toast";
import { installNativeBridge, isNative, onDeepLink } from "@/lib/platform";
import { parseAuthDeepLink, signInWithHandoffCode } from "@/lib/auth";

// Runs at module load, before any page effect can call fetch.
installNativeBridge();

// A launch URL is reported again after a reload; every link is handled once.
const HANDLED_KEY = "pomodrive:handledDeepLink";

export default function NativeBridge() {
  useEffect(() => {
    if (!isNative()) return undefined;

    return onDeepLink(async (url) => {
      const auth = parseAuthDeepLink(url);
      if (!auth) return;
      if (sessionStorage.getItem(HANDLED_KEY) === url) return;
      sessionStorage.setItem(HANDLED_KEY, url);

      try {
        await signInWithHandoffCode(auth.code);
        // The home page forwards signed-in users to the dashboard.
        window.location.assign("/");
      } catch (error) {
        console.error("Native sign-in failed:", error);
        toast.error("Sign-in failed. Please try again.");
      }
    });
  }, []);

  return null;
}
