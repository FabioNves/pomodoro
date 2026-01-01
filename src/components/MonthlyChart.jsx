import React from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MonthlyChart = ({ monthSessions, selectedMonth, selectedYear }) => {
  const prepareMonthChartData = (sessions, month, year) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const chartData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const formattedDate = currentDate.toLocaleDateString();

      const daySessions = sessions.filter(
        (session) =>
          new Date(session.date).toLocaleDateString() === formattedDate
      );

      const totalFocusMinutes = daySessions.reduce(
        (total, session) => total + session.focusTime,
        0
      );

      chartData.push({
        day: day,
        focusHours: parseFloat((totalFocusMinutes / 60).toFixed(1)),
        sessions: daySessions.length,
        date: formattedDate,
      });
    }

    return chartData;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 dark:bg-gray-800/90 p-3 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors duration-300">
          <p className="text-gray-900 dark:text-white font-semibold">{`Day ${label}`}</p>
          <p className="text-green-600 dark:text-green-400">{`Focus Hours: ${payload[0].value}`}</p>
          <p className="text-blue-600 dark:text-blue-400">
            {`Sessions: ${payload[0].payload.sessions}`}
          </p>
        </div>
      );
    }
    return null;
  };

  const monthChartData = prepareMonthChartData(
    monthSessions || [],
    selectedMonth,
    selectedYear
  );

  console.log("Month chart data:", monthChartData);
  console.log("Month sessions:", monthSessions);

  // Show loading state if no data
  if (!monthSessions || monthSessions.length === 0) {
    return (
      <motion.div
        className="w-full bg-white/80 dark:bg-gray-800/50 p-6 rounded-lg mb-6 transition-colors duration-300 shadow-md"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h3 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-[#88b6ff] to-[#014acd] bg-clip-text text-transparent">
          Monthly Focus Hours
        </h3>
        <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available for this month
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="w-full bg-white/80 dark:bg-gray-800/50 p-6 rounded-lg mb-6 transition-colors duration-300 shadow-md"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <h3 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-[#88b6ff] to-[#014acd] bg-clip-text text-transparent">
        Monthly Focus Hours
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={monthChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="day"
            stroke="#9CA3AF"
            fontSize={12}
            interval="preserveStartEnd"
            tickFormatter={(value) =>
              value % 5 === 0 || value === 1 ? value : ""
            }
          />
          <YAxis
            stroke="#9CA3AF"
            fontSize={12}
            label={{
              value: "Hours",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "#9CA3AF" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="focusHours"
            stroke="#10B981"
            strokeWidth={2}
            dot={{
              fill: "#10B981",
              strokeWidth: 2,
              r: 4,
            }}
            activeDot={{
              r: 6,
              stroke: "#10B981",
              strokeWidth: 2,
              fill: "#059669",
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default MonthlyChart;
