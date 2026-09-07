"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import PomodoroTimer from "@/components/PomodoroTimer";
import Navbar from "@/components/Navbar";
import {
  requestNotificationPermission,
  showNotification,
} from "@/utils/notifications";

export default function TimerPage() {
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
    requestNotificationPermission();

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
    setUser(null);
    router.replace("/");
  };

  if (!hasMounted || !user) return null;

  return (
    <div className="min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="pb-8">
        <PomodoroTimer showNotification={showNotification} />
      </main>
      <footer className="flex justify-center items-center h-8 bg-surface/60 text-fg-muted backdrop-blur-sm transition-colors duration-300">
        <p>&copy; 2026 PomoDRIVE App</p>
      </footer>
    </div>
  );
}
