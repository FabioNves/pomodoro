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
    <div className="flex flex-col gap-4 w-full h-96 mt-5 bg-surface p-4 rounded-lg overflow-y-scroll transition-colors duration-300">
      <h2 className="text-xl font-bold text-fg">
        Session History
      </h2>
      <div className="flex gap-4 my-4">
        <button
          className={`px-4 py-2 rounded transition-colors duration-300 ${
            selectedDay === "today"
              ? "bg-primary hover:bg-primary-hover text-primary-fg"
              : "bg-surface-2 text-fg"
          }`}
          onClick={() => setSelectedDay("today")}
        >
          Today
        </button>
        <button
          className={`px-4 py-2 rounded transition-colors duration-300 ${
            selectedDay === "yesterday"
              ? "bg-primary hover:bg-primary-hover text-primary-fg"
              : "bg-surface-2 text-fg"
          }`}
          onClick={() => setSelectedDay("yesterday")}
        >
          Yesterday
        </button>
      </div>

      {error ? (
        <p className="text-danger">{error}</p>
      ) : sessions.length === 0 ? (
        <p className="text-fg-muted">No sessions yet.</p>
      ) : (
        sessions.map((session, index) => (
          <div
            key={index}
            className="flex flex-col p-4 gap-2 rounded-md bg-surface-2 transition-colors duration-300"
          >
            <div className="w-full flex justify-between items-center gap-2 bg-edge p-2 rounded-md transition-colors duration-300">
              <h2 className="text-fg font-semibold">
                Session {index + 1}
              </h2>{" "}
              <p className="text-fg-muted">
                {formatDate(session.date)}
              </p>
            </div>
            <div className="flex gap-4 text-fg-muted">
              <p>Focus: {session.focusTime} min</p>
              <p>Break: {session.breakTime} min</p>
            </div>
            <hr className="w-[90%] self-center border-1 border-edge-strong" />
            <p className="font-bold text-fg">Tasks:</p>
            <ul>
              {session.tasks &&
                session.tasks.map((taskObj, taskIndex) => (
                  <li
                    key={taskIndex}
                    className="flex gap-2 w-full justify-start items-center bg-surface-2 p-2 rounded text-fg transition-colors duration-300"
                  >
                    {taskObj.task}
                    <div className="flex justify-center items-center p-2 bg-edge rounded transition-colors duration-300">
                      {taskObj.brand && ` ${taskObj.brand.title}`}{" "}
                    </div>
                    <div className="flex justify-center items-center p-2 bg-edge rounded transition-colors duration-300">
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
