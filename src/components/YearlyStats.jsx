import React from "react";
import { motion } from "framer-motion";

const YearlyStats = ({ yearlyStats }) => {
  return (
    <motion.div
      className="grid grid-cols-2 gap-4 bg-white/60 dark:bg-gray-800/30 p-4 rounded transition-colors duration-300"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <motion.div
        className="bg-white/80 dark:bg-gray-800/50 p-3 rounded transition-colors duration-300 shadow-sm"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold text-gray-700 dark:text-gray-300">
          Total Sessions
        </h3>
        <p className="text-2xl bg-gradient-to-r from-[#88b6ff] to-[#014acd] bg-clip-text text-transparent">
          {yearlyStats.totalSessions}
        </p>
      </motion.div>
      <motion.div
        className="bg-white/80 dark:bg-gray-800/50 p-3 rounded transition-colors duration-300 shadow-sm"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold text-gray-700 dark:text-gray-300">
          Total Focus Hours
        </h3>
        <p className="text-2xl bg-gradient-to-r from-[#88b6ff] to-[#014acd] bg-clip-text text-transparent">
          {yearlyStats.totalFocusHours}
        </p>
      </motion.div>
      <motion.div
        className="bg-white/80 dark:bg-gray-800/50 p-3 rounded transition-colors duration-300 shadow-sm"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold text-gray-700 dark:text-gray-300">
          Avg Sessions/Month
        </h3>
        <p className="text-2xl bg-gradient-to-r from-[#88b6ff] to-[#014acd] bg-clip-text text-transparent">
          {yearlyStats.averageSessionsPerMonth}
        </p>
      </motion.div>
      <motion.div
        className="bg-white/80 dark:bg-gray-800/50 p-3 rounded transition-colors duration-300 shadow-sm"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="font-bold text-gray-700 dark:text-gray-300">
          Most Productive Month
        </h3>
        <p className="text-2xl bg-gradient-to-r from-[#88b6ff] to-[#014acd] bg-clip-text text-transparent">
          {yearlyStats.mostProductiveMonth || "No data"}
        </p>
      </motion.div>
    </motion.div>
  );
};

export default YearlyStats;
