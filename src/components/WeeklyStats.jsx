import React from "react";
import { motion } from "framer-motion";

const WeeklyStats = ({ selectedDay, daySessions, focusedHours }) => {
  if (!selectedDay) {
    return null;
  }

  return (
    <motion.div
      className="day-summary bg-surface p-4 rounded-lg transition-colors duration-300 shadow-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="bg-primary text-primary-fg p-2 rounded mb-2 font-semibold">
        Day {selectedDay} Summary
      </h3>
      <p className="mb-1 text-fg-muted">
        Total Sessions: {daySessions.length}
      </p>
      <p className="text-fg-muted">
        Focused Hours: {focusedHours}
      </p>
    </motion.div>
  );
};

export default WeeklyStats;
