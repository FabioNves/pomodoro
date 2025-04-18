"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";

const BACKEND_URL =
  process.env.NODE_ENV === "development"
    ? process.env.NEXT_PUBLIC_BACKEND_URL_DEV
    : process.env.NEXT_PUBLIC_BACKEND_URL_PROD;

const getCurrentWeek = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysSinceStartOfYear = Math.floor(
    (now - startOfYear) / (1000 * 60 * 60 * 24)
  );
  return Math.floor(daysSinceStartOfYear / 7);
};

const Analytics = () => {
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [selectedDay, setSelectedDay] = useState(null);
  const [daySessions, setDaySessions] = useState([]);
  const [focusedHours, setFocusedHours] = useState(0);
  const [weekSessions, setWeekSessions] = useState([]);
  const [startOfWeek, setStartOfWeek] = useState(null);

  useEffect(() => {
    const fetchWeekSessions = async () => {
      try {
        const response = await axios.get(
          `${BACKEND_URL}/api/sessions/week/${selectedWeek}`
        );
        const { sessions, startOfWeek } = response.data;
        setWeekSessions(sessions);
        setStartOfWeek(startOfWeek);

        // Set the first day of the week as the selectedDay
        if (startOfWeek) {
          const startOfWeekDate = new Date(startOfWeek);
          const formattedDay = startOfWeekDate.toLocaleDateString();
          setSelectedDay(formattedDay);

          // Filter sessions for the first day of the week
          const filteredSessions = sessions.filter(
            (session) =>
              new Date(session.date).toLocaleDateString() === formattedDay
          );
          setDaySessions(filteredSessions);

          // Calculate total focused hours for the first day
          const totalFocusedMinutes = filteredSessions.reduce(
            (total, session) => total + session.focusTime,
            0
          );
          setFocusedHours((totalFocusedMinutes / 60).toFixed(2));
        } else {
          setSelectedDay(null);
          setDaySessions([]);
          setFocusedHours(0);
        }
      } catch (error) {
        console.error("Error fetching week sessions:", error);
        setWeekSessions([]);
        setSelectedDay(null);
        setDaySessions([]);
        setFocusedHours(0);
      }
    };

    fetchWeekSessions();
  }, [selectedWeek]);

  const handleSelectDay = (day) => {
    if (!startOfWeek) return;
    const startOfWeekDate = new Date(startOfWeek);
    const specificDay = new Date(startOfWeekDate);
    specificDay.setDate(startOfWeekDate.getDate() + day - 1);
    const formattedDay = specificDay.toLocaleDateString();

    setSelectedDay(formattedDay);

    const filteredSessions = weekSessions.filter(
      (session) => new Date(session.date).toLocaleDateString() === formattedDay
    );

    setDaySessions(filteredSessions);

    const totalFocusedMinutes = filteredSessions.reduce(
      (total, session) => total + session.focusTime,
      0
    );
    setFocusedHours((totalFocusedMinutes / 60).toFixed(2));
  };

  return (
    <div className="w-screen h-screen flex flex-col justify-center items-center gap-4 bg-gray-900 text-white">
      <Navbar />
      <h1 className="text-3xl font-bold py-4">Weekly Analytics</h1>
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedWeek(selectedWeek - 1)}
          className="bg-slate-200/20 p-2 rounded"
        >
          Prev
        </button>
        <span className="bg-slate-200/20 p-2 rounded">Week {selectedWeek}</span>
        <button
          onClick={() => setSelectedWeek(selectedWeek + 1)}
          className="bg-slate-200/20 p-2 rounded"
        >
          Next
        </button>
      </div>
      <div className="flex gap-2">
        {[...Array(7)].map((_, i) => {
          if (!startOfWeek) return null;
          const startOfWeekDate = new Date(startOfWeek);
          const specificDay = new Date(startOfWeekDate);
          specificDay.setDate(startOfWeekDate.getDate() + i);
          const formattedDay = specificDay.toLocaleDateString();

          return (
            <button
              key={i}
              onClick={() => handleSelectDay(i + 1)}
              className={`bg-slate-200/20 p-2 rounded ${
                selectedDay === formattedDay ? "bg-blue-500/80" : ""
              }`}
            >
              Day {i + 1}
            </button>
          );
        })}
      </div>
      {selectedDay && (
        <div className="day-summary bg-slate-200/20 p-2 rounded ">
          <h3 className="bg-slate-200/20 p-2 rounded ">
            Day {selectedDay} Summary
          </h3>
          <p>Total Sessions: {daySessions.length}</p>
          <p>Focused Hours: {focusedHours}</p>
        </div>
      )}
    </div>
  );
};

export default Analytics;
