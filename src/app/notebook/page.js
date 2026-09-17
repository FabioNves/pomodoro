"use client";

// Notebook: rich-text notes with tabs, folders, saved views and the Brain
// graph. Same sign-in gate as the other pages; the app itself reads
// ?view= / ?doc= / ?tab= / ?folder= (hence the Suspense boundary, which the
// static export needs around useSearchParams).

import React, { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Navbar from "@/components/Navbar";
import NotebookApp from "@/components/notebook/NotebookApp";
import { LockedScreen } from "@/components/access/Gate";

export default function NotebookPage() {
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
      <main className="pb-4">
        <Suspense
          fallback={
            <div className="w-full max-w-7xl mx-auto px-4 text-sm text-fg-muted">Loading…</div>
          }
        >
          <LockedScreen feature="notebook" title="Notebook" description="Notes with tabs, folders, saved views, quotes and the Brain graph.">
            <NotebookApp />
          </LockedScreen>
        </Suspense>
      </main>
    </div>
  );
}
