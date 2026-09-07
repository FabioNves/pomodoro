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
      <h2 className="text-2xl font-bold mb-4 text-fg">
        Active Session
      </h2>

      {/* Show current project */}
      {activeProject.title && (
        <div className="mb-6 p-3 bg-success-soft border border-success rounded-lg transition-colors duration-300">
          <h3 className="text-sm font-medium text-success mb-1">
            Working on
          </h3>
          <p className="text-lg font-semibold text-success">
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
                  ? "bg-surface-2 border-edge-strong"
                  : "bg-success-soft border-success"
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
                      ? "bg-success border-success"
                      : "border-success hover:border-success-hover"
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
                        ? "text-fg-subtle line-through"
                        : "text-success"
                    }`}
                  >
                    {task.task || "Working on project"}
                  </div>
                </div>
              </div>
              <motion.button
                className="px-3 py-1 bg-warning hover:bg-warning-hover text-white rounded transition-colors ml-2"
                onClick={() => toggleBackToDo(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Remove
              </motion.button>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8 text-fg-muted">
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
