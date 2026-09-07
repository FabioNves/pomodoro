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
        <div className="bg-surface p-3 rounded-lg border border-edge transition-colors duration-300">
          <p className="text-fg font-semibold">{`${label}`}</p>
          <p className="text-chart-1">{`Focus Hours: ${payload[0].value}`}</p>
          <p className="text-fg-muted">
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
        className="w-full bg-surface p-6 rounded-lg transition-colors duration-300 shadow-md"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h3 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
          Weekly Focus Hours
        </h3>
        <div className="h-[300px] flex items-center justify-center text-fg-subtle">
          No data available for this week
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="w-full bg-surface p-6 rounded-lg transition-colors duration-300 shadow-md"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <h3 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
        Weekly Focus Hours
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={weekChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="day" stroke="var(--chart-axis)" fontSize={12} />
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
            stroke="var(--chart-1)"
            strokeWidth={3}
            dot={{
              fill: "var(--chart-1)",
              strokeWidth: 2,
              r: 6,
            }}
            activeDot={{
              r: 8,
              stroke: "var(--chart-1)",
              strokeWidth: 2,
              fill: "var(--surface)",
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default WeeklyChart;
