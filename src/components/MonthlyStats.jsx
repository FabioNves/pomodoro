import React from "react";
import { motion } from "framer-motion";

const MonthlyStats = ({ monthlyStats }) => {
  return (
    <motion.div
      className="grid grid-cols-2 gap-4 bg-slate-200/20 p-4 rounded"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <motion.div
        className="bg-slate-200/20 p-3 rounded"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold">Total Sessions</h3>
        <p className="text-2xl">{monthlyStats.totalSessions}</p>
      </motion.div>
      <motion.div
        className="bg-slate-200/20 p-3 rounded"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold">Total Focus Hours</h3>
        <p className="text-2xl">{monthlyStats.totalFocusHours}</p>
      </motion.div>
      <motion.div
        className="bg-slate-200/20 p-3 rounded"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold">Avg Sessions/Day</h3>
        <p className="text-2xl">{monthlyStats.averageSessionsPerDay}</p>
      </motion.div>
      <motion.div
        className="bg-slate-200/20 p-3 rounded"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold">Most Productive Day</h3>
        <p className="text-2xl">
          {monthlyStats.mostProductiveDay
            ? `Day ${monthlyStats.mostProductiveDay}`
            : "No data"}
        </p>
      </motion.div>
    </motion.div>
  );
};

export default MonthlyStats;
