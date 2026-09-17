"use client";

// AI news briefing. Same sign-in gate as the other pages; the dashboard
// itself reads ?tab= and ?kind= (hence the Suspense boundary, which the
// static export needs around useSearchParams).

import React, { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Navbar from "@/components/Navbar";
import NewsDashboard from "@/components/news/NewsDashboard";
import { LockedScreen } from "@/components/access/Gate";

export default function NewsPage() {
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
    const token = localStorage.getItem("accessToken");
    if (token && token.split(".").length === 3) {
      try {
        setUser(jwtDecode(token));
        return;
      } catch (error) {
        console.error("Error decoding token:", error);
        localStorage.removeItem("accessToken");
      }
    }
    router.replace("/");
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    setUser(null);
    router.replace("/");
  };

  if (!hasMounted || !user) return null;

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="pb-8">
        <Suspense fallback={<div className="container mx-auto px-4 max-w-4xl text-sm text-fg-muted">Loading…</div>}>
          <LockedScreen
            feature="news_briefing"
            title="News briefing"
            description="Real stories retrieved from the web through MCP, ranked and summarised for your topics."
          >
            <NewsDashboard />
          </LockedScreen>
        </Suspense>
      </main>
    </div>
  );
}
