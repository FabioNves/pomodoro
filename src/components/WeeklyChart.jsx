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

const WeeklyChart = ({ weekChartData }) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-600">
          <p className="text-white font-semibold">{`${label}`}</p>
          <p className="text-blue-400">{`Focus Hours: ${payload[0].value}`}</p>
          <p className="text-green-400">
            {`Sessions: ${payload[0].payload.sessions}`}
          </p>
        </div>
      );
    }
    return null;
  };

  // Show loading state if no data
  if (!weekChartData || weekChartData.length === 0) {
    return (
      <motion.div
        className="w-full bg-slate-200/10 p-6 rounded-lg"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h3 className="text-xl font-bold mb-4 text-center">
          Weekly Focus Hours
        </h3>
        <div className="h-[300px] flex items-center justify-center text-gray-400">
          No data available for this week
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="w-full bg-slate-200/10 p-6 rounded-lg"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <h3 className="text-xl font-bold mb-4 text-center">Weekly Focus Hours</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={weekChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} />
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
            stroke="#3B82F6"
            strokeWidth={3}
            dot={{
              fill: "#3B82F6",
              strokeWidth: 2,
              r: 6,
            }}
            activeDot={{
              r: 8,
              stroke: "#3B82F6",
              strokeWidth: 2,
              fill: "#1D4ED8",
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default WeeklyChart;
