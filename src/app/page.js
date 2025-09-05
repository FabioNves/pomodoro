"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PomodoroTimer from "../components/PomodoroTimer";
import LoginPage from "../components/LoginPage";
import { jwtDecode } from "jwt-decode"; // Correct import for named export
import Navbar from "../components/Navbar";

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

  const handleSignOut = () => {
    localStorage.removeItem("accessToken");
    setUser(null);
  };

  // Prevent rendering until after hydration
  if (!hasMounted) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar user={user} onSignOut={handleSignOut} />
      <main className="pt-24 pb-8">
        <PomodoroTimer />
      </main>
      <footer className="flex justify-center items-center h-8 bg-gray-800 text-white">
        <p>&copy; 2025 PomoDRIVE App</p>
      </footer>
    </div>
  );
}
