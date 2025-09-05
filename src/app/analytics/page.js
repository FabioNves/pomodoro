"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";
import WeeklyAnalytics from "@/components/WeeklyAnalytics";
import MonthlyChart from "@/components/MonthlyChart";
import MonthlyStats from "@/components/MonthlyStats";
import YearlyChart from "@/components/YearlyChart";
import YearlyStats from "@/components/YearlyStats";
import { motion } from "framer-motion";
import { jwtDecode } from "jwt-decode";

const getCurrentMonth = () => {
  return new Date().getMonth();
};

const getCurrentYear = () => {
  return new Date().getFullYear();
};

const Analytics = () => {
  const [activeTab, setActiveTab] = useState("weekly");

  // Monthly states
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [monthSessions, setMonthSessions] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState({
    totalSessions: 0,
    totalFocusHours: 0,
    averageSessionsPerDay: 0,
    mostProductiveDay: null,
  });

  // Yearly states
  const [yearForYearlyView, setYearForYearlyView] = useState(getCurrentYear());
  const [yearlySessions, setYearlySessions] = useState([]);
  const [yearlyStats, setYearlyStats] = useState({
    totalSessions: 0,
    totalFocusHours: 0,
    averageSessionsPerMonth: 0,
    mostProductiveMonth: null,
  });

  useEffect(() => {
    if (activeTab === "monthly") {
      fetchMonthSessions();
    } else if (activeTab === "yearly") {
      fetchYearSessions();
    }
  }, [selectedMonth, selectedYear, yearForYearlyView, activeTab]);

  const fetchYearSessions = async () => {
    try {
      console.log(`Fetching year sessions for ${yearForYearlyView}`);

      // Get user ID from localStorage
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

      const response = await axios.get(
        `/api/sessions/year/${yearForYearlyView}`,
        { headers }
      );

      console.log("Year sessions response:", response.data);
      const sessions = response.data;
      setYearlySessions(sessions);

      // Calculate yearly statistics
      const totalSessions = sessions.length;
      const totalFocusMinutes = sessions.reduce(
        (total, session) => total + session.focusTime,
        0
      );
      const totalFocusHours = (totalFocusMinutes / 60).toFixed(2);

      const averageSessionsPerMonth = (totalSessions / 12).toFixed(2);

      // Find most productive month
      const monthStats = {};
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      sessions.forEach((session) => {
        const month = new Date(session.date).getMonth();
        if (!monthStats[month]) {
          monthStats[month] = { sessions: 0, focusTime: 0 };
        }
        monthStats[month].sessions += 1;
        monthStats[month].focusTime += session.focusTime;
      });

      const mostProductiveMonth = Object.entries(monthStats).reduce(
        (max, [month, stats]) => {
          return stats.focusTime > (max.stats?.focusTime || 0)
            ? { month: monthNames[parseInt(month)], stats }
            : max;
        },
        {}
      );

      setYearlyStats({
        totalSessions,
        totalFocusHours,
        averageSessionsPerMonth,
        mostProductiveMonth: mostProductiveMonth.month || null,
      });
    } catch (error) {
      console.error("Error fetching year sessions:", error);
      setYearlySessions([]);
      setYearlyStats({
        totalSessions: 0,
        totalFocusHours: 0,
        averageSessionsPerMonth: 0,
        mostProductiveMonth: null,
      });
    }
  };

  const fetchMonthSessions = async () => {
    try {
      console.log(
        `Fetching month sessions for ${selectedYear}/${selectedMonth + 1}`
      );

      // Get user ID from localStorage
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

      const response = await axios.get(
        `/api/sessions/month/${selectedYear}/${selectedMonth + 1}`,
        { headers }
      );

      console.log("Month sessions response:", response.data);
      const sessions = response.data;
      setMonthSessions(sessions);

      // Calculate monthly statistics
      const totalSessions = sessions.length;
      const totalFocusMinutes = sessions.reduce(
        (total, session) => total + session.focusTime,
        0
      );
      const totalFocusHours = (totalFocusMinutes / 60).toFixed(2);

      const daysInMonth = new Date(
        selectedYear,
        selectedMonth + 1,
        0
      ).getDate();
      const averageSessionsPerDay = (totalSessions / daysInMonth).toFixed(2);

      // Find most productive day
      const dayStats = {};
      sessions.forEach((session) => {
        const day = new Date(session.date).getDate();
        if (!dayStats[day]) {
          dayStats[day] = { sessions: 0, focusTime: 0 };
        }
        dayStats[day].sessions += 1;
        dayStats[day].focusTime += session.focusTime;
      });

      const mostProductiveDay = Object.entries(dayStats).reduce(
        (max, [day, stats]) => {
          return stats.focusTime > (max.stats?.focusTime || 0)
            ? { day, stats }
            : max;
        },
        {}
      );

      setMonthlyStats({
        totalSessions,
        totalFocusHours,
        averageSessionsPerDay,
        mostProductiveDay: mostProductiveDay.day || null,
      });
    } catch (error) {
      console.error("Error fetching month sessions:", error);
      setMonthSessions([]);
      setMonthlyStats({
        totalSessions: 0,
        totalFocusHours: 0,
        averageSessionsPerDay: 0,
        mostProductiveDay: null,
      });
    }
  };

  const getMonthName = (monthIndex) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[monthIndex];
  };

  return (
    <div className="w-screen min-h-screen flex flex-col justify-start items-center gap-4 bg-gray-900 text-white overflow-y-auto pt-24">
      <Navbar />
      <h1 className="text-3xl font-bold py-4">Analytics Dashboard</h1>

      {/* Tab Navigation */}
      <motion.div
        className="flex gap-2 mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <button
          onClick={() => setActiveTab("weekly")}
          className={`px-6 py-2 rounded transition-colors ${
            activeTab === "weekly" ? "bg-blue-500" : "bg-slate-200/20"
          }`}
        >
          Weekly Analytics
        </button>
        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-6 py-2 rounded transition-colors ${
            activeTab === "monthly" ? "bg-blue-500" : "bg-slate-200/20"
          }`}
        >
          Monthly Analytics
        </button>
        <button
          onClick={() => setActiveTab("yearly")}
          className={`px-6 py-2 rounded transition-colors ${
            activeTab === "yearly" ? "bg-blue-500" : "bg-slate-200/20"
          }`}
        >
          Yearly Analytics
        </button>
      </motion.div>

      {/* Weekly Analytics Tab */}
      {activeTab === "weekly" && <WeeklyAnalytics />}

      {/* Monthly Analytics Tab */}
      {activeTab === "monthly" && (
        <motion.div
          className="flex flex-col items-center gap-4 w-full max-w-6xl px-4"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                if (selectedMonth === 0) {
                  setSelectedMonth(11);
                  setSelectedYear(selectedYear - 1);
                } else {
                  setSelectedMonth(selectedMonth - 1);
                }
              }}
              className="bg-slate-200/20 p-2 rounded hover:bg-slate-200/30 transition-colors"
            >
              Prev
            </button>
            <span className="bg-slate-200/20 p-2 rounded">
              {getMonthName(selectedMonth)} {selectedYear}
            </span>
            <button
              onClick={() => {
                if (selectedMonth === 11) {
                  setSelectedMonth(0);
                  setSelectedYear(selectedYear + 1);
                } else {
                  setSelectedMonth(selectedMonth + 1);
                }
              }}
              className="bg-slate-200/20 p-2 rounded hover:bg-slate-200/30 transition-colors"
            >
              Next
            </button>
          </div>

          {/* Monthly Chart */}
          {monthSessions.length > 0 && (
            <MonthlyChart
              monthSessions={monthSessions}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />
          )}

          {/* Monthly Stats */}
          <MonthlyStats monthlyStats={monthlyStats} />
        </motion.div>
      )}

      {/* Yearly Analytics Tab */}
      {activeTab === "yearly" && (
        <motion.div
          className="flex flex-col items-center gap-4 w-full max-w-6xl px-4"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setYearForYearlyView(yearForYearlyView - 1)}
              className="bg-slate-200/20 p-2 rounded hover:bg-slate-200/30 transition-colors"
            >
              Prev
            </button>
            <span className="bg-slate-200/20 p-2 rounded">
              {yearForYearlyView}
            </span>
            <button
              onClick={() => setYearForYearlyView(yearForYearlyView + 1)}
              className="bg-slate-200/20 p-2 rounded hover:bg-slate-200/30 transition-colors"
            >
              Next
            </button>
          </div>

          {/* Yearly Chart */}
          {yearlySessions.length > 0 && (
            <YearlyChart
              yearlySessions={yearlySessions}
              selectedYear={yearForYearlyView}
            />
          )}

          {/* Yearly Stats */}
          <YearlyStats yearlyStats={yearlyStats} />
        </motion.div>
      )}
    </div>
  );
};

export default Analytics;
