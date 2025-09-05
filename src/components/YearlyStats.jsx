import React from "react";
import { motion } from "framer-motion";

const YearlyStats = ({ yearlyStats }) => {
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
        <p className="text-2xl">{yearlyStats.totalSessions}</p>
      </motion.div>
      <motion.div
        className="bg-slate-200/20 p-3 rounded"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold">Total Focus Hours</h3>
        <p className="text-2xl">{yearlyStats.totalFocusHours}</p>
      </motion.div>
      <motion.div
        className="bg-slate-200/20 p-3 rounded"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold">Avg Sessions/Month</h3>
        <p className="text-2xl">{yearlyStats.averageSessionsPerMonth}</p>
      </motion.div>
      <motion.div
        className="bg-slate-200/20 p-3 rounded"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold">Most Productive Month</h3>
        <p className="text-2xl">
          {yearlyStats.mostProductiveMonth || "No data"}
        </p>
      </motion.div>
    </motion.div>
  );
};

export default YearlyStats;
