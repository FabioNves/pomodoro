import React from "react";

const TaskList = ({ tasks, onTransferTask, onToggleBackToDo }) => {
  return (
    <div className="w-full h-full bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-bold">Session tasks doing</h2>
      <ul className="mt-3 overflow-scroll">
        {tasks.map((task, index) => (
          <li
            key={index}
            className={`flex justify-between items-center p-2 mt-2 rounded ${
              task.completed ? "line-through text-gray-500" : ""
            }`}
          >
            {task.text}
            <button
              className="bg-green-500 px-3 py-1 rounded text-white"
              onClick={() => onToggleBackToDo(index)}
            >
              Not doing
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskList;
