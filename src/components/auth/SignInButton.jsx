"use client";

// One sign-in button for every platform.
//   website: Google's own button (credential flow) -> /api/auth/google
//   app shells: opens the website's /auth/native page in the system browser;
//               the website deep-links back with a code and NativeBridge
//               finishes the sign-in.
// Google Identity Services refuses to run inside app webviews, which is why
// the shells sign in through the browser.

import { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { WEB_URL, getPlatform, openExternal } from "@/lib/platform";
import { signInWithGoogleCredential } from "@/lib/auth";

/** Google's button; reports the raw credential (ID token). */
export function GoogleCredentialButton({ onCredential, onError }) {
  return (
    <GoogleLogin
      onSuccess={(response) => onCredential(response.credential)}
      onError={onError}
      size="large"
      text="signin_with"
      shape="rectangular"
      theme="filled_blue"
    />
  );
}

function GoogleMark({ className = "" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.3 0 11.7-2.1 15.5-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/** The platform is only known in the browser; avoids a hydration mismatch. */
function usePlatform() {
  const [platform, setPlatform] = useState("server");
  useEffect(() => setPlatform(getPlatform()), []);
  return platform;
}

export default function SignInButton({ onSuccess, onError }) {
  const platform = usePlatform();
  const [busy, setBusy] = useState(false);

  if (platform === "server") return null;

  if (platform === "electron" || platform === "capacitor") {
    const openBrowserSignIn = async () => {
      setBusy(true);
      try {
        await openExternal(`${WEB_URL}/auth/native?platform=${platform}`);
      } catch (error) {
        console.error("Could not open the browser for sign-in:", error);
        onError?.(error);
      } finally {
        setTimeout(() => setBusy(false), 1500);
      }
    };

    return (
      <button
        type="button"
        onClick={openBrowserSignIn}
        disabled={busy}
        className="inline-flex items-center gap-3 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-fg shadow-md transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
          <GoogleMark className="h-4 w-4" />
        </span>
        {busy ? "Opening your browser..." : "Sign in with Google"}
      </button>
    );
  }

  return (
    <GoogleCredentialButton
      onCredential={async (credential) => {
        try {
          const user = await signInWithGoogleCredential(credential);
          onSuccess?.(user);
        } catch (error) {
          console.error("Sign-in failed:", error);
          onError?.(error);
        }
      }}
      onError={() => onError?.(new Error("Google sign-in failed"))}
    />
  );
}
