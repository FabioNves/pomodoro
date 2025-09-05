"use client";
import React, { useState } from "react";

const TodoList = ({
  user,
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

  const userId = user?.userId || localStorage.getItem("userId");

  const addBrand = async () => {
    const newBrand = prompt("Enter new project name:");
    if (newBrand && newBrand.trim()) {
      try {
        const response = await fetch("/api/brands", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userId ? { "user-id": userId } : {}),
          },
          body: JSON.stringify({ name: newBrand.trim() }),
        });

        if (!response.ok) {
          throw new Error("Failed to add brand");
        }

        const addedBrand = await response.json();
        console.log("Added brand:", addedBrand);

        // Update the brands state with the new brand
        setBrands((prevBrands) => [...prevBrands, addedBrand]);

        // Optionally set as selected
        setSelectedBrand(addedBrand.name);
      } catch (error) {
        console.error("Error adding brand:", error);
        alert("Failed to add project. Please try again.");
      }
    }
  };

  const addMilestone = async () => {
    if (!selectedBrand) {
      alert("Please select a project first.");
      return;
    }

    const newMilestone = prompt("Enter new milestone:");
    if (newMilestone && newMilestone.trim()) {
      try {
        const response = await fetch("/api/milestones", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userId ? { "user-id": userId } : {}),
          },
          body: JSON.stringify({ name: newMilestone.trim() }),
        });

        if (!response.ok) {
          throw new Error("Failed to add milestone");
        }

        const { milestone } = await response.json();
        console.log("Added milestone:", milestone);

        // Update the milestones state with the new milestone
        setMilestones((prevMilestones) => [...prevMilestones, milestone]);

        // Optionally set as selected
        setSelectedMilestone(milestone.name);
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
    setSelectedBrand("");
    setSelectedMilestone("");
  };

  return (
    <div className="w-full mt-5 bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-bold">Task Planning</h2>
      <div className="flex flex-col mt-3 gap-2 bg-slate-200/20 p-2 rounded">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 p-2 rounded bg-gray-700 text-white placeholder-gray-400"
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            placeholder="What are you working on?"
            onKeyPress={(e) => e.key === "Enter" && handleAddTodoTask()}
          />
          <button
            className="bg-blue-500 hover:bg-blue-600 px-4 py-2 ml-2 rounded transition-colors"
            onClick={handleAddTodoTask}
          >
            Add Task
          </button>
        </div>

        <div className="flex gap-2">
          <select
            className="flex-1 p-2 rounded bg-gray-700 text-white border border-gray-600"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">Select Project</option>
            {brands.map((brand, index) => (
              <option key={brand._id || index} value={brand.name || ""}>
                {brand.name || ""}
              </option>
            ))}
          </select>
          <button
            className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded transition-colors"
            onClick={addBrand}
          >
            + Project
          </button>
        </div>

        <div className="flex gap-2">
          <select
            className="flex-1 p-2 rounded bg-gray-700 text-white border border-gray-600 disabled:opacity-50"
            value={selectedMilestone}
            onChange={(e) => setSelectedMilestone(e.target.value)}
            disabled={!selectedBrand}
          >
            <option value="">Select Milestone</option>
            {milestones.map((milestone, index) => (
              <option key={milestone._id || index} value={milestone.name || ""}>
                {milestone.name || ""}
              </option>
            ))}
          </select>
          <button
            className="bg-purple-500 hover:bg-purple-600 px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={addMilestone}
            disabled={!selectedBrand}
          >
            + Milestone
          </button>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Planned Tasks</h3>
        {todoTasks && todoTasks.length > 0 ? (
          <ul className="space-y-2">
            {todoTasks.map((task, index) => (
              <li
                key={index}
                className="flex justify-between items-center p-3 bg-gray-700/50 rounded border border-gray-600/50"
              >
                <div className="flex-1">
                  <div className="font-medium">{task.task}</div>
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
                <button
                  className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded text-white transition-colors"
                  onClick={() => transferTaskToSession(index)}
                >
                  Start
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4 text-gray-400">
            <p>No tasks planned yet. Add a task to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoList;
