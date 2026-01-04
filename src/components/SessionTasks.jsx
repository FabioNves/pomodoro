"use client";
import React from "react";
import { motion } from "framer-motion";

const SessionTasks = ({
  tasks,
  toggleBackToDo,
  toggleTaskCompletion,
  activeProject,
}) => {
  return (
    <motion.div
      className="w-full h-full text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Active Session
      </h2>

      {/* Show current project */}
      {activeProject.title && (
        <div className="mb-6 p-3 bg-green-500/10 dark:bg-green-500/10 border border-green-500/50 dark:border-green-500/30 rounded-lg transition-colors duration-300">
          <h3 className="text-sm font-medium text-green-600 dark:text-green-300 mb-1">
            Working on
          </h3>
          <p className="text-lg font-semibold text-green-700 dark:text-green-400">
            {activeProject.title}
          </p>
        </div>
      )}

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {tasks && tasks.length > 0 ? (
          tasks.map((task, index) => (
            <motion.div
              key={index}
              className={`flex justify-between items-center p-3 rounded-lg border transition-colors duration-300 ${
                task.completed
                  ? "bg-gray-300/50 dark:bg-gray-500/20 border-gray-400 dark:border-gray-500/50"
                  : "bg-green-100 dark:bg-green-500/10 border-green-400 dark:border-green-500/30"
              }`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => toggleTaskCompletion(index)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                    task.completed
                      ? "bg-green-500 border-green-500"
                      : "border-green-500 dark:border-green-400 hover:border-green-600 dark:hover:border-green-500"
                  }`}
                >
                  {task.completed && (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
                <div className="flex-1 text-left">
                  <div
                    className={`font-medium ${
                      task.completed
                        ? "text-gray-500 dark:text-gray-400 line-through"
                        : "text-green-700 dark:text-green-300"
                    }`}
                  >
                    {task.task || "Working on project"}
                  </div>
                </div>
              </div>
              <motion.button
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white rounded transition-colors ml-2"
                onClick={() => toggleBackToDo(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Remove
              </motion.button>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            <p>No tasks in this session yet.</p>
            <p className="text-sm mt-2">
              {activeProject.title
                ? "Add tasks to track specific work items, or just start the timer to work on the project!"
                : "Select a project first, then add tasks or start working!"}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SessionTasks;
