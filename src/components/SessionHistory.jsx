import React from "react";
import { formatDate } from "../utils/timeUtils";

const SessionHistory = ({
  user,
  selectedDay,
  setSelectedDay,
  error,
  sessions = [], // Use sessions passed as a prop
}) => {
  return (
    <div className="flex flex-col gap-4 w-full h-96 mt-5 bg-white dark:bg-gray-800 p-4 rounded-lg overflow-y-scroll transition-colors duration-300">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Session History
      </h2>
      <div className="flex gap-4 my-4">
        <button
          className={`px-4 py-2 rounded transition-colors duration-300 ${
            selectedDay === "today"
              ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              : "bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white"
          }`}
          onClick={() => setSelectedDay("today")}
        >
          Today
        </button>
        <button
          className={`px-4 py-2 rounded transition-colors duration-300 ${
            selectedDay === "yesterday"
              ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              : "bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white"
          }`}
          onClick={() => setSelectedDay("yesterday")}
        >
          Yesterday
        </button>
      </div>

      {error ? (
        <p className="text-red-500">{error}</p>
      ) : sessions.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No sessions yet.</p>
      ) : (
        sessions.map((session, index) => (
          <div
            key={index}
            className="flex flex-col p-4 gap-2 rounded-md bg-gray-200/50 dark:bg-slate-300/20 transition-colors duration-300"
          >
            <div className="w-full flex justify-between items-center gap-2 bg-gray-300/50 dark:bg-slate-200/20 p-2 rounded-md transition-colors duration-300">
              <h2 className="text-gray-900 dark:text-white font-semibold">
                Session {index + 1}
              </h2>{" "}
              <p className="text-gray-700 dark:text-gray-300">
                {formatDate(session.date)}
              </p>
            </div>
            <div className="flex gap-4 text-gray-700 dark:text-gray-300">
              <p>Focus: {session.focusTime} min</p>
              <p>Break: {session.breakTime} min</p>
            </div>
            <hr className="w-[90%] self-center border-1 border-gray-400 dark:border-white" />
            <p className="font-bold text-gray-900 dark:text-white">Tasks:</p>
            <ul>
              {session.tasks &&
                session.tasks.map((taskObj, taskIndex) => (
                  <li
                    key={taskIndex}
                    className="flex gap-2 w-full justify-start items-center bg-gray-200/50 dark:bg-slate-200/20 p-2 rounded text-gray-900 dark:text-white transition-colors duration-300"
                  >
                    {taskObj.task}
                    <div className="flex justify-center items-center p-2 bg-gray-300/50 dark:bg-slate-200/20 rounded transition-colors duration-300">
                      {taskObj.brand && ` ${taskObj.brand.title}`}{" "}
                    </div>
                    <div className="flex justify-center items-center p-2 bg-gray-300/50 dark:bg-slate-200/20 rounded transition-colors duration-300">
                      {" "}
                      {taskObj.brand && ` ${taskObj.brand.milestone}`}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
};

export default SessionHistory;
