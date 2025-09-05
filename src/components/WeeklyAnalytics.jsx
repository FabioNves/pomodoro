import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import WeeklyChart from "./WeeklyChart";
import WeeklyStats from "./WeeklyStats";
import WeekNavigation from "./WeekNavigation";

const getCurrentWeek = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysSinceStartOfYear = Math.floor(
    (now - startOfYear) / (1000 * 60 * 60 * 24)
  );
  return Math.floor(daysSinceStartOfYear / 7);
};

const WeeklyAnalytics = () => {
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [selectedDay, setSelectedDay] = useState(null);
  const [daySessions, setDaySessions] = useState([]);
  const [focusedHours, setFocusedHours] = useState(0);
  const [weekSessions, setWeekSessions] = useState([]);
  const [startOfWeek, setStartOfWeek] = useState(null);
  const [weekChartData, setWeekChartData] = useState([]);

  useEffect(() => {
    fetchWeekSessions();
  }, [selectedWeek]);

  const prepareWeekChartData = (sessions, startOfWeek) => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const chartData = [];

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(currentDay.getDate() + i);
      const formattedDay = currentDay.toLocaleDateString();

      const daySessions = sessions.filter(
        (session) =>
          new Date(session.date).toLocaleDateString() === formattedDay
      );

      const totalFocusMinutes = daySessions.reduce(
        (total, session) => total + session.focusTime,
        0
      );

      chartData.push({
        day: days[i],
        focusHours: (totalFocusMinutes / 60).toFixed(1),
        sessions: daySessions.length,
        date: formattedDay,
      });
    }

    return chartData;
  };

  const fetchWeekSessions = async () => {
    try {
      const userId =
        typeof window !== "undefined" ? localStorage.getItem("userId") : null;
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;

      let actualUserId = userId;
      if (!userId && token) {
        try {
          const decoded = jwtDecode(token);
          actualUserId = decoded.userId;
        } catch (e) {
          console.error("Error decoding token:", e);
        }
      }

      const headers = {};
      if (actualUserId) {
        headers["user-id"] = actualUserId;
      }

      const response = await axios.get(`/api/sessions/week/${selectedWeek}`, {
        headers,
      });
      const { sessions, startOfWeek } = response.data;
      setWeekSessions(sessions);
      setStartOfWeek(startOfWeek);

      // Prepare chart data
      if (startOfWeek) {
        const chartData = prepareWeekChartData(sessions, startOfWeek);
        setWeekChartData(chartData);

        // Set the first day of the week as the selectedDay
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
        setWeekChartData([]);
      }
    } catch (error) {
      console.error("Error fetching week sessions:", error);
      setWeekSessions([]);
      setSelectedDay(null);
      setDaySessions([]);
      setFocusedHours(0);
      setWeekChartData([]);
    }
  };

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
    <motion.div
      className="flex flex-col items-center gap-6 w-full max-w-6xl px-4"
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <WeekNavigation
        selectedWeek={selectedWeek}
        setSelectedWeek={setSelectedWeek}
        startOfWeek={startOfWeek}
        selectedDay={selectedDay}
        handleSelectDay={handleSelectDay}
      />

      <WeeklyChart weekChartData={weekChartData} />

      <WeeklyStats
        selectedDay={selectedDay}
        daySessions={daySessions}
        focusedHours={focusedHours}
      />
    </motion.div>
  );
};

export default WeeklyAnalytics;
