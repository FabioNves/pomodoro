"use client";
import React from "react";
import { motion } from "framer-motion";

const SessionTasks = ({ tasks, toggleBackToDo }) => {
  return (
    <motion.div
      className="w-full h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-6">Active Session Tasks</h2>

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
              <div className="flex-1">
                <div className="font-medium text-green-300">{task.task}</div>
                <div className="flex gap-2 mt-1">
                  {task.brand?.title && (
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                      {task.brand.title}
                    </span>
                  )}
                  {task.brand?.milestone && (
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                      {task.brand.milestone}
                    </span>
                  )}
                </div>
              </div>
              <motion.button
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
                onClick={() => toggleBackToDo(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Move Back
              </motion.button>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No tasks in this session yet.</p>
            <p className="text-sm mt-2">
              Move tasks from your plan to start working on them!
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SessionTasks;
