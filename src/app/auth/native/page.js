"use client";

// Sign-in page for the mobile and desktop apps.
// Google's sign-in only works in a real browser, so the apps open this page in
// the system browser. Once Google returns, the server gives us a short-lived
// code and we send the user back to the app with a pomodrive://auth deep link.

import { useState } from "react";
import Image from "next/image";
import { GoogleCredentialButton } from "@/components/auth/SignInButton";
import { authDeepLink, createHandoffCode } from "@/lib/auth";

export default function NativeAuthPage() {
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [appLink, setAppLink] = useState("");

  const handleCredential = async (credential) => {
    setStatus("working");
    try {
      const code = await createHandoffCode(credential);
      const link = authDeepLink(code);
      setAppLink(link);
      setStatus("done");
      // Browsers may only open custom schemes from a click; the button below
      // covers that case.
      window.location.href = link;
    } catch (error) {
      console.error("Native sign-in failed:", error);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface/80 backdrop-blur-sm rounded-2xl p-8 border border-edge shadow-2xl text-center space-y-6">
        <div className="flex justify-center">
          <Image
            src="/logo/pomodrive-svg/pomoDrive-logo-light.svg"
            alt="PomoDRIVE"
            width={160}
            height={64}
            className="h-14 w-auto block dark:hidden"
            priority
          />
          <Image
            src="/logo/pomodrive-svg/pomoDrive-logo.svg"
            alt="PomoDRIVE"
            width={160}
            height={64}
            className="h-14 w-auto hidden dark:block"
            priority
          />
        </div>

        {status === "done" ? (
          <>
            <h1 className="text-2xl font-bold text-fg">You are signed in</h1>
            <p className="text-fg-muted">
              Returning you to the PomoDRIVE app. If nothing happens, use the
              button below.
            </p>
            <a
              href={appLink}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-fg hover:bg-primary-hover transition-colors"
            >
              Open PomoDRIVE
            </a>
            <p className="text-sm text-fg-subtle">
              This link expires in two minutes. You can close this tab once the
              app opens.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-fg">Sign in to PomoDRIVE</h1>
            <p className="text-fg-muted">
              Sign in with Google and you will be sent straight back to the
              app.
            </p>
            <div className="flex justify-center">
              {status === "working" ? (
                <p className="text-fg-muted">Signing you in...</p>
              ) : (
                <GoogleCredentialButton
                  onCredential={handleCredential}
                  onError={() => setStatus("error")}
                />
              )}
            </div>
            {status === "error" ? (
              <p className="text-sm text-danger">
                Sign-in failed. Please try again.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
