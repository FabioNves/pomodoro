"use client";
import React from "react";
import { motion } from "framer-motion";

const SessionTasks = ({ tasks, toggleBackToDo, activeProject }) => {
  return (
    <motion.div
      className="w-full h-full text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">Active Session</h2>

      {/* Show current project */}
      {activeProject.title && (
        <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <h3 className="text-sm font-medium text-green-300 mb-1">
            Working on
          </h3>
          <p className="text-lg font-semibold text-green-400">
            {activeProject.title}
            {activeProject.milestone && (
              <span className="text-purple-400 ml-2">
                • {activeProject.milestone}
              </span>
            )}
          </p>
        </div>
      )}

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {tasks && tasks.length > 0 ? (
          tasks.map((task, index) => (
            <motion.div
              key={index}
              className="flex justify-between items-center p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex-1 text-left">
                <div className="font-medium text-green-300">
                  {task.task || "Working on project"}
                </div>
                {/* Remove brand display since it's shown at session level */}
              </div>
              <motion.button
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
                onClick={() => toggleBackToDo(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Remove
              </motion.button>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
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
