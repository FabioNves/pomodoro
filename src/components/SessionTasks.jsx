import React from "react";

const SessionTasks = ({ tasks, toggleBackToDo }) => {
  return (
    <div className="w-full h-full bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-bold">Session tasks doing</h2>
      <ul className="mt-3 overflow-y-scroll">
        {tasks.map((task, index) => (
          <li
            key={index}
            className={`flex justify-between items-center p-2 mt-2 rounded ${
              task.completed ? "line-through text-gray-500" : ""
            }`}
          >
            <div>
              {task.task}
              {task.brand?.title && (
                <span className="ml-2 text-blue-300">{task.brand.title}</span>
              )}
              {task.brand?.milestone && (
                <span className="ml-2 text-green-300">
                  {task.brand.milestone}
                </span>
              )}
            </div>
            <button
              className="bg-green-500 px-3 py-1 rounded text-white"
              onClick={() => toggleBackToDo(index)}
            >
              Not doing
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SessionTasks;
