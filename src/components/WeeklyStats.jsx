import React from "react";
import { motion } from "framer-motion";

const WeeklyStats = ({ selectedDay, daySessions, focusedHours }) => {
  if (!selectedDay) {
    return null;
  }

  return (
    <motion.div
      className="day-summary bg-slate-200/20 p-4 rounded-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="bg-slate-200/20 p-2 rounded mb-2 font-semibold">
        Day {selectedDay} Summary
      </h3>
      <p className="mb-1">Total Sessions: {daySessions.length}</p>
      <p>Focused Hours: {focusedHours}</p>
    </motion.div>
  );
};

export default WeeklyStats;
