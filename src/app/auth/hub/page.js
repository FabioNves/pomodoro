"use client";

// Landing page for "Open admin" in the Movez Hub. /api/hub/sso put a
// one-time ticket in the URL fragment (never sent to a server); this trades
// it for a normal session and continues to the admin page.

import { useEffect, useRef, useState } from "react";
import { storeSession } from "@/lib/auth";

export default function HubAuthPage() {
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const ticket = params.get("ticket");
    const next = params.get("next") ?? "";
    // Drop the ticket from the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);
    const target = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/admin";

    if (!ticket) {
      setFailed(true);
      return;
    }
    fetch("/api/hub/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Sign-in refused");
        storeSession(data);
        window.location.href = target;
      })
      .catch((error) => {
        console.error("Hub sign-in failed:", error);
        setFailed(true);
      });
  }, []);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-8 text-center">
      <p>
        {failed
          ? "This sign-in link has expired or was already used. Open PomoDRIVE again from the hub."
          : "Signing you in…"}
      </p>
    </main>
  );
}
