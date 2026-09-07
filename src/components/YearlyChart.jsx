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

const YearlyChart = ({ yearlySessions, selectedYear }) => {
  const prepareYearChartData = (sessions, year) => {
    const chartData = [];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    for (let month = 0; month < 12; month++) {
      const monthSessions = sessions.filter((session) => {
        const sessionDate = new Date(session.date);
        return (
          sessionDate.getFullYear() === year && sessionDate.getMonth() === month
        );
      });

      const totalFocusMinutes = monthSessions.reduce(
        (total, session) => total + session.focusTime,
        0
      );

      chartData.push({
        month: months[month],
        monthNumber: month + 1,
        focusHours: parseFloat((totalFocusMinutes / 60).toFixed(1)),
        sessions: monthSessions.length,
      });
    }

    return chartData;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface p-3 rounded-lg border border-edge transition-colors duration-300">
          <p className="text-fg font-semibold">{`${label}`}</p>
          <p className="text-chart-3">{`Focus Hours: ${payload[0].value}`}</p>
          <p className="text-fg-muted">
            {`Sessions: ${payload[0].payload.sessions}`}
          </p>
        </div>
      );
    }
    return null;
  };

  const yearChartData = prepareYearChartData(
    yearlySessions || [],
    selectedYear
  );

  console.log("Year chart data:", yearChartData);
  console.log("Year sessions:", yearlySessions);

  // Show loading state if no data
  if (!yearlySessions || yearlySessions.length === 0) {
    return (
      <motion.div
        className="w-full bg-surface p-6 rounded-lg mb-6 transition-colors duration-300 shadow-md"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h3 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
          Yearly Focus Hours
        </h3>
        <div className="h-[300px] flex items-center justify-center text-fg-subtle">
          No data available for this year
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="w-full bg-surface p-6 rounded-lg mb-6 transition-colors duration-300 shadow-md"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <h3 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
        Yearly Focus Hours
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={yearChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="month" stroke="var(--chart-axis)" fontSize={12} />
          <YAxis
            stroke="var(--chart-axis)"
            fontSize={12}
            label={{
              value: "Hours",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "var(--chart-axis)" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="focusHours"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={{
              fill: "var(--chart-3)",
              strokeWidth: 2,
              r: 4,
            }}
            activeDot={{
              r: 6,
              stroke: "var(--chart-3)",
              strokeWidth: 2,
              fill: "var(--surface)",
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default YearlyChart;
