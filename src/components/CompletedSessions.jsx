"use client";
import React from "react";
import { motion } from "framer-motion";
import { formatDate } from "../utils/timeUtils";

const CompletedSessions = ({ sessions = [] }) => {
  if (sessions.length === 0) {
    return (
      <motion.div
        className="text-center py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold mb-4">Completed Sessions</h2>
        <p className="text-gray-400">
          No completed sessions yet. Start a pomodoro session to see your
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
      <h2 className="text-2xl font-bold mb-6">Completed Sessions</h2>

      <div className="grid gap-4 max-h-96 overflow-y-auto">
        {sessions.slice(0, 10).map((session, index) => (
          <motion.div
            key={index}
            className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-lg">Session {index + 1}</h3>
              <span className="text-sm text-gray-400">
                {formatDate
                  ? formatDate(session.date)
                  : new Date(session.date).toLocaleDateString()}
              </span>
            </div>

            <div className="flex gap-4 mb-3 text-sm">
              <div className="bg-blue-500/20 px-3 py-1 rounded">
                <span className="text-blue-300">
                  Focus: {session.focusTime} min
                </span>
              </div>
              <div className="bg-green-500/20 px-3 py-1 rounded">
                <span className="text-green-300">
                  Break: {session.breakTime} min
                </span>
              </div>
            </div>

            {session.tasks && session.tasks.length > 0 && (
              <div>
                <p className="font-medium mb-2 text-gray-300">
                  Tasks Completed:
                </p>
                <div className="space-y-2">
                  {session.tasks.map((taskObj, taskIndex) => (
                    <div
                      key={taskIndex}
                      className="flex items-center gap-2 text-sm bg-gray-800/50 p-2 rounded"
                    >
                      <span className="flex-1">{taskObj.task}</span>
                      {taskObj.brand && (
                        <div className="flex gap-2">
                          <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-xs">
                            {taskObj.brand.title}
                          </span>
                          <span className="bg-orange-500/20 text-orange-300 px-2 py-1 rounded text-xs">
                            {taskObj.brand.milestone}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default CompletedSessions;
