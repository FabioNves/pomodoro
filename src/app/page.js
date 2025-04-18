"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PomodoroTimer from "../components/PomodoroTimer";
import LoginPage from "../components/LoginPage";
import { jwtDecode } from "jwt-decode"; // Correct import for named export

export default function App() {
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedDay, setSelectedDay] = useState("today");
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token && token.split(".").length === 3) {
        try {
          const decodedUser = jwtDecode(token);
          setUser(decodedUser);
        } catch (error) {
          console.error("Error decoding token:", error);
          localStorage.removeItem("accessToken");
        }
      } else {
        localStorage.removeItem("accessToken");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedDay === "today") {
        const today = new Date().toISOString().split("T")[0];
        setFilteredSessions(
          sessions.filter((session) => session.date.startsWith(today))
        );
      } else if (selectedDay === "yesterday") {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        setFilteredSessions(
          sessions.filter((session) => session.date.startsWith(yesterdayStr))
        );
      }
    }
  }, [selectedDay, sessions]);

  const handleLoginSuccess = (userData) => {
    console.log("Logged-in User Data:", userData);
    setUser(userData);
  };

  // Prevent rendering until after hydration
  if (!hasMounted) return null;

  return (
    <div>
      {!user ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          <nav className="flex h-16 justify-center gap-5 p-4 bg-gray-800 text-white">
            <Link href="/" className="hover:underline">
              Timer
            </Link>
            <Link href="/analytics" className="hover:underline">
              Analytics
            </Link>
          </nav>
          <main>
            <PomodoroTimer />
          </main>
        </>
      )}
    </div>
  );
}
