import React from "react";
import { motion } from "framer-motion";

const WeekNavigation = ({
  selectedWeek,
  setSelectedWeek,
  startOfWeek,
  selectedDay,
  handleSelectDay,
}) => {
  return (
    <>
      {/* Week Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedWeek(selectedWeek - 1)}
          className="bg-white/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 p-2 rounded hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 shadow-sm hover:shadow-md"
        >
          Prev
        </button>
        <span className="bg-[#2563eb] text-white px-6 py-2 rounded shadow-md font-medium">
          Week {selectedWeek}
        </span>
        <button
          onClick={() => setSelectedWeek(selectedWeek + 1)}
          className="bg-white/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 p-2 rounded hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 shadow-sm hover:shadow-md"
        >
          Next
        </button>
      </div>

      {/* Day Selection */}
      <div className="flex gap-2">
        {[...Array(7)].map((_, i) => {
          if (!startOfWeek) return null;
          const startOfWeekDate = new Date(startOfWeek);
          const specificDay = new Date(startOfWeekDate);
          specificDay.setDate(startOfWeekDate.getDate() + i);
          const formattedDay = specificDay.toLocaleDateString();

          return (
            <motion.button
              key={i}
              onClick={() => handleSelectDay(i + 1)}
              className={`p-2 rounded transition-all duration-300 shadow-sm ${
                selectedDay === formattedDay
                  ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md"
                  : "bg-white/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Day {i + 1}
            </motion.button>
          );
        })}
      </div>
    </>
  );
};

export default WeekNavigation;
