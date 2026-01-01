"use client";
import React, { useState, useEffect } from "react";
import Button from "./Button";

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
  activeProject,
  setActiveProject,
}) => {
  const [selectedBrand, setSelectedBrand] = useState(activeProject.title || "");
  const [selectedMilestone, setSelectedMilestone] = useState(
    activeProject.milestone || ""
  );
  const [googleTasks, setGoogleTasks] = useState([]);
  const [loadingGoogleTasks, setLoadingGoogleTasks] = useState(false);
  const [googleTasksError, setGoogleTasksError] = useState(null);

  // Update active project when selection changes
  useEffect(() => {
    if (
      selectedBrand !== activeProject.title ||
      selectedMilestone !== activeProject.milestone
    ) {
      setActiveProject({
        title: selectedBrand,
        milestone: selectedMilestone,
      });
    }
  }, [selectedBrand, selectedMilestone, setActiveProject]);

  // Sync with active project changes from parent
  useEffect(() => {
    setSelectedBrand(activeProject.title || "");
    setSelectedMilestone(activeProject.milestone || "");
  }, [activeProject]);

  const userId = user?.userId || localStorage.getItem("userId");

  // Fetch Google Tasks
  useEffect(() => {
    const fetchGoogleTasks = async () => {
      if (!userId) return;

      setLoadingGoogleTasks(true);
      setGoogleTasksError(null);

      try {
        const response = await fetch("/api/google-tasks", {
          headers: {
            "user-id": userId,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          // Store the full error data including instructions
          setGoogleTasksError(errorData);
          return;
        }

        const data = await response.json();
        setGoogleTasks(data.tasks || []);
      } catch (error) {
        console.error("Error fetching Google Tasks:", error);
        setGoogleTasksError({ error: error.message });
      } finally {
        setLoadingGoogleTasks(false);
      }
    };

    fetchGoogleTasks();
  }, [userId]);

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

    // Use active project if no specific project selected
    const projectTitle = selectedBrand || activeProject.title;
    const projectMilestone = selectedMilestone || activeProject.milestone;

    if (!projectTitle) {
      alert("Please select a project first!");
      return;
    }

    addTodoTask(todoInput, projectTitle, projectMilestone);
    setTodoInput("");
  };

  return (
    <div className="w-full mt-5 bg-white dark:bg-gray-800 p-4 rounded-lg transition-colors duration-300">
      <h2 className="text-xl font-bold">Project & Task Planning</h2>

      {/* Active Project Display */}
      <div className="mb-4 p-3 bg-[#88b6ff]/10 dark:bg-blue-500/10 border border-[#014acd]/30 dark:border-blue-500/30 rounded-lg transition-colors duration-300">
        <h3 className="text-sm font-medium text-blue-300 mb-2">
          Active Project
        </h3>
        <p className="text-lg font-semibold">
          {activeProject.title || "No project selected"}
          {activeProject.milestone && (
            <span className="text-purple-400 ml-2">
              • {activeProject.milestone}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col mt-3 gap-2 bg-slate-200/20 p-2 rounded">
        <div className="flex gap-2">
          <select
            className="flex-1 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 transition-colors duration-300"
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
          <Button variant="short" onClick={addBrand}>
            + Project
          </Button>
        </div>

        <div className="flex gap-2">
          <select
            className="flex-1 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 disabled:opacity-50 transition-colors duration-300"
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
          <Button
            variant="short"
            onClick={addMilestone}
            disabled={!selectedBrand}
          >
            + Milestone
          </Button>
        </div>

        <div className="w-full flex flex-col gap-2">
          <input
            type="text"
            className="flex-1 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 transition-colors duration-300"
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            placeholder={`What task are you working on${
              activeProject.title ? ` for ${activeProject.title}` : ""
            }?`}
            onKeyPress={(e) => e.key === "Enter" && handleAddTodoTask()}
          />
          <Button variant="full" onClick={handleAddTodoTask}>
            Add Task
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Planned Tasks</h3>
        {todoTasks && todoTasks.length > 0 ? (
          <ul className="space-y-2">
            {todoTasks.map((task, index) => (
              <li
                key={index}
                className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700/50 rounded border border-gray-300 dark:border-gray-600/50 transition-colors duration-300"
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

      {/* Google Tasks Section */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z" />
            </svg>
            Google Tasks
          </h3>
          <button
            onClick={() => {
              const fetchTasks = async () => {
                setLoadingGoogleTasks(true);
                try {
                  const response = await fetch("/api/google-tasks", {
                    headers: { "user-id": userId },
                  });
                  if (response.ok) {
                    const data = await response.json();
                    setGoogleTasks(data.tasks || []);
                    setGoogleTasksError(null);
                  }
                } catch (error) {
                  console.error(error);
                } finally {
                  setLoadingGoogleTasks(false);
                }
              };
              fetchTasks();
            }}
            className="text-xs bg-blue-500/20 hover:bg-blue-500/30 px-3 py-1 rounded text-blue-300 transition-colors"
            disabled={loadingGoogleTasks}
          >
            {loadingGoogleTasks ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingGoogleTasks && (
          <div className="text-center py-4 text-gray-400">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="mt-2">Loading Google Tasks...</p>
          </div>
        )}

        {googleTasksError && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4 mb-3">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-yellow-300 font-medium">
                  {googleTasksError?.error || "Google Tasks Error"}
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  {googleTasksError?.message || googleTasksError?.error}
                </p>
                {googleTasksError?.instructions && (
                  <div className="mt-3 text-xs text-gray-400 space-y-1">
                    <p className="font-medium text-gray-300">To fix this:</p>
                    {googleTasksError.instructions.map((instruction, idx) => (
                      <p key={idx} className="ml-2">
                        {instruction}
                      </p>
                    ))}
                  </div>
                )}
                {!googleTasksError?.instructions && (
                  <p className="text-gray-400 text-xs mt-2">
                    Please go to <strong>/settings</strong> and click "Grant
                    Google Tasks Access"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!loadingGoogleTasks && !googleTasksError && googleTasks.length > 0 && (
          <ul className="space-y-2">
            {googleTasks.map((task) => (
              <li
                key={task.id}
                className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded border border-blue-500/30"
              >
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {task.title}
                    <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                      Google
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1 items-center">
                    <span className="text-xs text-gray-400">
                      {task.listName}
                    </span>
                    {task.due && (
                      <span className="text-xs text-orange-300">
                        Due: {new Date(task.due).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {task.notes && (
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {task.notes}
                    </div>
                  )}
                </div>
                <button
                  className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded text-white transition-colors whitespace-nowrap ml-2"
                  onClick={() => {
                    // Add Google task to local session tasks
                    addTodoTask(task.title, task.listName, task.notes || "");
                  }}
                >
                  Add to Plan
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loadingGoogleTasks &&
          !googleTasksError &&
          googleTasks.length === 0 && (
            <div className="text-center py-4 text-gray-400">
              <p>No Google Tasks found.</p>
              <p className="text-xs mt-1">
                Tasks from your Google account will appear here.
              </p>
            </div>
          )}
      </div>
    </div>
  );
};

export default TodoList;
