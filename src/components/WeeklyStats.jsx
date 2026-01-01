import React from "react";
import { motion } from "framer-motion";

const WeeklyStats = ({ selectedDay, daySessions, focusedHours }) => {
  if (!selectedDay) {
    return null;
  }

  return (
    <motion.div
      className="day-summary bg-white/80 dark:bg-gray-800/50 p-4 rounded-lg transition-colors duration-300 shadow-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="bg-[#2563eb] text-white p-2 rounded mb-2 font-semibold">
        Day {selectedDay} Summary
      </h3>
      <p className="mb-1 text-gray-700 dark:text-gray-300">
        Total Sessions: {daySessions.length}
      </p>
      <p className="text-gray-700 dark:text-gray-300">
        Focused Hours: {focusedHours}
      </p>
    </motion.div>
  );
};

export default WeeklyStats;
