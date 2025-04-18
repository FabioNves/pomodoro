"use client";
import React, { useState } from "react";

const TodoList = ({
  user, // <-- Add this
  todoInput,
  setTodoInput,
  todoTasks,
  addTodoTask,
  setTodoTasks,
  transferTaskToSession,
  brands,
  setBrands,
  milestones,
  setMilestones,
}) => {
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedMilestone, setSelectedMilestone] = useState("");

  // Always get userId from user prop or fallback to localStorage
  const userId = user?.userId || localStorage.getItem("userId");

  const addBrand = async () => {
    const newBrand = prompt("Enter new brand:");
    if (newBrand) {
      try {
        const response = await fetch("/api/brands", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userId ? { "user-id": userId } : {}),
          },
          body: JSON.stringify({ name: newBrand }),
        });

        if (!response.ok) {
          throw new Error("Failed to add brand");
        }

        const addedBrand = await response.json();
        setBrands([...brands, addedBrand]); // Update brands using setter
      } catch (error) {
        console.error("Error adding brand:", error);
        alert("Failed to add brand. Please try again.");
      }
    }
  };

  const addMilestone = async () => {
    const newMilestone = prompt("Enter new milestone:");
    if (newMilestone) {
      try {
        const response = await fetch("/api/milestones", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userId ? { "user-id": userId } : {}),
          },
          body: JSON.stringify({ name: newMilestone }),
        });

        if (!response.ok) {
          throw new Error("Failed to add milestone");
        }

        const { milestone } = await response.json();
        setMilestones([...milestones, milestone]); // Update milestones using setter
      } catch (error) {
        console.error("Error adding milestone:", error);
        alert("Failed to add milestone. Please try again.");
      }
    }
  };

  const handleAddTodoTask = () => {
    if (todoInput.trim() === "") return;

    addTodoTask(todoInput, selectedBrand, selectedMilestone);
    setTodoInput("");
  };

  return (
    <div className="w-full mt-5 bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-bold">To-Do List</h2>
      <div className="flex flex-col mt-3 gap-2 bg-slate-200/20 p-2 rounded">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 p-2 rounded bg-gray-700 text-white"
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            placeholder="New Task..."
          />
          <button
            className="bg-blue-500 px-4 py-2 ml-2 rounded"
            onClick={handleAddTodoTask}
          >
            Add
          </button>
        </div>
        <div className="flex gap-2">
          <select
            className="ml-2 p-2 rounded bg-gray-700 text-white"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">Select Brand</option>
            {brands.map((brand, index) => (
              <option key={index} value={brand.name || ""}>
                {brand.name || ""}
              </option>
            ))}
          </select>
          <button
            className="bg-green-500 px-4 py-2 ml-2 rounded"
            onClick={addBrand}
          >
            Add Brand
          </button>
          <select
            className="ml-2 p-2 rounded bg-gray-700 text-white"
            value={selectedMilestone}
            onChange={(e) => setSelectedMilestone(e.target.value)}
            disabled={!selectedBrand}
          >
            <option value="">Select Milestone</option>
            {milestones.map((milestone, index) => (
              <option key={index} value={milestone.name || ""}>
                {milestone.name || ""}
              </option>
            ))}
          </select>
          <button
            className="bg-green-500 px-4 py-2 ml-2 rounded"
            onClick={addMilestone}
            disabled={!selectedBrand}
          >
            Add Milestone
          </button>
        </div>
      </div>
      <ul className="mt-3">
        {todoTasks &&
          todoTasks.map((task, index) => (
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
                className="bg-yellow-500 px-3 py-1 rounded text-white"
                onClick={() => transferTaskToSession(index)}
              >
                Doing
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
};

export default TodoList;
