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
    <div className="flex flex-col gap-4 w-full h-96 mt-5 bg-gray-800 p-4 rounded-lg overflow-y-scroll">
      <h2 className="text-xl font-bold">Session History</h2>
      <div className="flex gap-4 my-4">
        <button
          className={`px-4 py-2 rounded ${
            selectedDay === "today" ? "bg-blue-500" : "bg-gray-600"
          }`}
          onClick={() => setSelectedDay("today")}
        >
          Today
        </button>
        <button
          className={`px-4 py-2 rounded ${
            selectedDay === "yesterday" ? "bg-blue-500" : "bg-gray-600"
          }`}
          onClick={() => setSelectedDay("yesterday")}
        >
          Yesterday
        </button>
      </div>

      {error ? (
        <p className="text-red-500">{error}</p>
      ) : sessions.length === 0 ? (
        <p>No sessions yet.</p>
      ) : (
        sessions.map((session, index) => (
          <div
            key={index}
            className="flex flex-col p-4 gap-2 rounded-md bg-slate-300/20 "
          >
            <div className="w-full flex justify-between items-center gap-2 bg-slate-200/20 p-2 rounded-md">
              <h2>Session {index + 1}</h2> <p>{formatDate(session.date)}</p>
            </div>
            <div className="flex gap-4">
              <p>Focus: {session.focusTime} min</p>
              <p>Break: {session.breakTime} min</p>
            </div>
            <hr className="w-[90%] self-center border-1 border-white" />
            <p className="font-bold">Tasks:</p>
            <ul>
              {session.tasks &&
                session.tasks.map((taskObj, taskIndex) => (
                  <li
                    key={taskIndex}
                    className="flex gap-2 w-full justify-start items-center bg-slate-200/20 p-2 rounded"
                  >
                    {taskObj.task}
                    <div className="flex justify-center items-center p-2 bg-slate-200/20 rounded">
                      {taskObj.brand && ` ${taskObj.brand.title}`}{" "}
                    </div>
                    <div className="flex justify-center items-center p-2 bg-slate-200/20 rounded">
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
