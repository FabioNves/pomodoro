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
          className="bg-slate-200/20 p-2 rounded hover:bg-slate-200/30 transition-colors"
        >
          Prev
        </button>
        <span className="bg-slate-200/20 p-2 rounded">Week {selectedWeek}</span>
        <button
          onClick={() => setSelectedWeek(selectedWeek + 1)}
          className="bg-slate-200/20 p-2 rounded hover:bg-slate-200/30 transition-colors"
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
              className={`bg-slate-200/20 p-2 rounded transition-colors ${
                selectedDay === formattedDay
                  ? "bg-blue-500/80"
                  : "hover:bg-slate-200/30"
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
