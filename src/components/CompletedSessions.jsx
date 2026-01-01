"use client";
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { formatDate } from "../utils/timeUtils";

const CompletedSessions = ({ sessions = [] }) => {
  // Filter and sort today's sessions
  const todaysSessions = useMemo(() => {
    const today = new Date();
    const todayString = today.toDateString();

    return sessions
      .filter((session) => {
        const sessionDate = new Date(session.date);
        return sessionDate.toDateString() === todayString;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first
  }, [sessions]);

  if (todaysSessions.length === 0) {
    return (
      <motion.div
        className="text-center py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Today's Sessions
        </h2>
        <p className="text-gray-600 dark:text-gray-400 transition-colors duration-300">
          No sessions completed today yet. Start a pomodoro session to see your
          progress!
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Today's Sessions
        </h2>
        <span className="text-sm text-gray-700 dark:text-gray-300 bg-white/80 dark:bg-gray-800/50 px-3 py-1 rounded-full border border-gray-300 dark:border-gray-700 transition-colors duration-300 shadow-sm">
          {todaysSessions.length} session
          {todaysSessions.length !== 1 ? "s" : ""} completed
        </span>
      </div>

      <div className="grid gap-4 max-h-96 overflow-y-auto">
        {todaysSessions.map((session, index) => (
          <motion.div
            key={`${session._id || session.date}-${index}`}
            className="bg-white/80 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-300 dark:border-gray-600/50 shadow-md transition-colors duration-300"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                Session {todaysSessions.length - index}
              </h3>
              <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                {new Date(session.date).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>

            <div className="flex gap-4 mb-3 text-sm">
              <div className="bg-blue-500/20 px-3 py-1 rounded border border-blue-500/30">
                <span className="text-blue-600 dark:text-blue-300 transition-colors duration-300">
                  Focus: {session.focusTime} min
                </span>
              </div>
              <div className="bg-green-500/20 px-3 py-1 rounded border border-green-500/30">
                <span className="text-green-600 dark:text-green-300 transition-colors duration-300">
                  Break: {session.breakTime} min
                </span>
              </div>
            </div>

            {/* Show project information - either from currentProject or first task's brand */}
            {(session.currentProject?.title ||
              (session.tasks &&
                session.tasks.length > 0 &&
                session.tasks[0]?.brand?.title)) && (
              <div className="mb-3">
                <div className="flex items-center gap-2 p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                  <span className="text-indigo-600 dark:text-indigo-300 font-medium transition-colors duration-300">
                    📂 Project:
                  </span>
                  <span className="text-indigo-700 dark:text-indigo-200 font-semibold transition-colors duration-300">
                    {session.currentProject?.title ||
                      session.tasks[0]?.brand?.title}
                  </span>
                  {(session.currentProject?.milestone ||
                    session.tasks[0]?.brand?.milestone) && (
                    <span className="text-purple-600 dark:text-purple-300 text-sm transition-colors duration-300">
                      •{" "}
                      {session.currentProject?.milestone ||
                        session.tasks[0]?.brand?.milestone}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Show tasks OR project work info */}
            {session.tasks && session.tasks.length > 0 ? (
              // HAS TASKS - Show the tasks
              <div>
                <p className="font-medium mb-2 text-gray-700 dark:text-gray-300 transition-colors duration-300">
                  {session.tasks.some((task) => task.task && task.task.trim())
                    ? "Tasks Completed:"
                    : "Worked on:"}
                </p>
                <div className="space-y-2">
                  {session.tasks.map((taskObj, taskIndex) => (
                    <div
                      key={taskIndex}
                      className="flex items-center gap-2 text-sm bg-gray-100 dark:bg-gray-800/50 p-2 rounded border border-gray-200 dark:border-gray-700/50 transition-colors duration-300"
                    >
                      <span className="flex-1 text-gray-800 dark:text-gray-200 transition-colors duration-300">
                        {taskObj.task && taskObj.task.trim()
                          ? taskObj.task
                          : `General work on ${
                              taskObj?.brand?.title || "project"
                            }`}
                      </span>
                      {taskObj?.brand && (
                        <div className="flex gap-2">
                          <span className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 px-2 py-1 rounded text-xs transition-colors duration-300">
                            {taskObj.brand.title}
                          </span>
                          {taskObj.brand.milestone && (
                            <span className="bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/30 px-2 py-1 rounded text-xs transition-colors duration-300">
                              {taskObj.brand.milestone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // NO TASKS - Show project work or fallback message
              <div>
                {session.currentProject?.title ? (
                  // Has currentProject but no tasks
                  <div className="text-gray-600 dark:text-gray-400 text-sm italic p-2 bg-gray-100 dark:bg-gray-800/30 rounded border border-gray-200 dark:border-gray-700/50 transition-colors duration-300">
                    <span className="text-green-600 dark:text-green-400 font-medium transition-colors duration-300">
                      ✅ Worked on:
                    </span>{" "}
                    <span className="text-blue-600 dark:text-blue-300 transition-colors duration-300">
                      {session.currentProject.title}
                    </span>
                    {session.currentProject.milestone && (
                      <span className="text-purple-600 dark:text-purple-300 transition-colors duration-300">
                        {" "}
                        • {session.currentProject.milestone}
                      </span>
                    )}
                  </div>
                ) : (
                  // No currentProject and no tasks
                  <div className="text-gray-600 dark:text-gray-500 text-sm italic p-2 bg-gray-100 dark:bg-gray-800/30 rounded border border-gray-200 dark:border-gray-700/50 transition-colors duration-300">
                    📝 Focus session completed (no specific project tracked)
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Summary for today */}
      <motion.div
        className="mt-6 p-4 bg-white/80 dark:bg-gray-800/30 rounded-lg border border-gray-300 dark:border-gray-600/30 shadow-md transition-colors duration-300"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          Today's Summary
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {todaysSessions.reduce(
                (total, session) => total + session.focusTime,
                0
              )}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
              Focus Minutes
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {todaysSessions.reduce(
                (total, session) => total + session.breakTime,
                0
              )}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
              Break Minutes
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {todaysSessions.reduce(
                (total, session) => total + (session.tasks?.length || 0),
                0
              )}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
              Tasks Completed
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CompletedSessions;
