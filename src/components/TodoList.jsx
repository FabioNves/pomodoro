"use client";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { generateSessionId } from "@/utils/sessionUtils";

const TodoList = ({
  user,
  todoInput,
  setTodoInput,
  todoTasks,
  setTodoTasks,
  transferTaskToSession,
  activeProject,
  setActiveProject,
}) => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    activeProject?.projectId || ""
  );
  const [completedOpen, setCompletedOpen] = useState(false);

  const userId =
    user?.userId ||
    (typeof window !== "undefined" ? localStorage.getItem("userId") : null);

  const sessionIdRef = useRef(null);
  if (!sessionIdRef.current) {
    sessionIdRef.current = generateSessionId();
  }

  const identityHeaders = useMemo(() => {
    return userId
      ? { "user-id": userId }
      : { "session-id": sessionIdRef.current };
  }, [userId]);

  // Fetch projects from the new Projects model
  useEffect(() => {
    let cancelled = false;

    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/projects", { headers: identityHeaders });
        if (!res.ok) throw new Error("Failed to fetch projects");
        const data = await res.json();
        if (cancelled) return;

        setProjects(Array.isArray(data) ? data : []);

        // Initialize selection from activeProject (projectId preferred, fallback to title match)
        const activeId = activeProject?.projectId;
        if (activeId && data.some((p) => p._id === activeId)) {
          setSelectedProjectId(activeId);
          return;
        }

        const activeTitle = activeProject?.title;
        if (!selectedProjectId && activeTitle) {
          const byName = data.find((p) => p.name === activeTitle);
          if (byName?._id) {
            setSelectedProjectId(byName._id);
            return;
          }
        }

        if (!selectedProjectId && data[0]?._id) {
          setSelectedProjectId(data[0]._id);
        }
      } catch (e) {
        console.error("Error fetching projects:", e);
      }
    };

    fetchProjects();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Sync activeProject based on selected project
  useEffect(() => {
    const selected = projects.find((p) => p._id === selectedProjectId);
    if (
      selected &&
      (activeProject?.projectId !== selected._id ||
        activeProject?.title !== selected.name)
    ) {
      setActiveProject({ projectId: selected._id, title: selected.name });
    }
  }, [
    projects,
    selectedProjectId,
    activeProject?.projectId,
    activeProject?.title,
    setActiveProject,
  ]);

  // Load tasks for the selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setTodoTasks([]);
      return;
    }

    let cancelled = false;
    const fetchTasks = async () => {
      try {
        const res = await fetch(`/api/tasks?projectId=${selectedProjectId}`, {
          headers: identityHeaders,
        });
        if (!res.ok) throw new Error("Failed to fetch tasks");
        const data = await res.json();
        if (cancelled) return;

        setTodoTasks(
          (Array.isArray(data) ? data : []).map((t) => ({
            taskId: t._id,
            task: t.title,
            completed: Boolean(t.completed),
          }))
        );
      } catch (e) {
        console.error("Error fetching tasks:", e);
      }
    };

    fetchTasks();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, identityHeaders, setTodoTasks]);

  const handleAddTodoTask = async () => {
    if (todoInput.trim() === "") return;

    if (!selectedProjectId) {
      alert("Please select a project first!");
      return;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...identityHeaders,
        },
        body: JSON.stringify({
          title: todoInput.trim(),
          projectId: selectedProjectId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to add task");
      }

      const created = await res.json();
      setTodoTasks((prev) => [
        ...prev,
        { taskId: created._id, task: created.title, completed: false },
      ]);
      setTodoInput("");
    } catch (e) {
      console.error("Error adding task:", e);
      alert("Failed to add task. Please try again.");
    }
  };

  const activeEntries = (todoTasks || [])
    .map((t, i) => ({ task: t, index: i }))
    .filter(({ task }) => !task.completed);

  const completedEntries = (todoTasks || [])
    .map((t, i) => ({ task: t, index: i }))
    .filter(({ task }) => task.completed);

  return (
    <div className="w-full mt-5">
      <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200/70 dark:border-gray-700/70 bg-white/60 dark:bg-gray-900/30">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 dark:text-white truncate">
                Project & Task Planning
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 truncate">
                <span className="text-gray-500 dark:text-gray-400">
                  Active:
                </span>{" "}
                {activeProject.title || "No project selected"}
              </div>
            </div>
          </div>
        </div>

        <div className="px-2 py-2">
          <div className="px-2 pb-2">
            <select
              className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">Select Project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="px-2 pb-2 flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none placeholder-gray-400 dark:placeholder-gray-500"
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
              placeholder={`What task are you working on${
                activeProject.title ? ` for ${activeProject.title}` : ""
              }?`}
              onKeyDown={(e) => e.key === "Enter" && handleAddTodoTask()}
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm"
              onClick={handleAddTodoTask}
            >
              Add
            </button>
          </div>

          <div className="space-y-0.5">
            {activeEntries.length > 0 ? (
              activeEntries.map(({ task, index }) => (
                <div
                  key={task.taskId || index}
                  className="group flex items-start justify-between gap-2 py-1.5 rounded-md hover:bg-white/70 dark:hover:bg-gray-800/40 transition-colors px-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-5 break-words text-gray-900 dark:text-gray-100">
                      {task.task}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm transition-colors"
                    onClick={() => transferTaskToSession(index)}
                  >
                    Start
                  </button>
                </div>
              ))
            ) : (
              <div className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">
                No tasks found for this project yet.
              </div>
            )}
          </div>

          {/* Completed dropdown */}
          <div className="px-2 pb-2 pt-2">
            <button
              type="button"
              className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/70 dark:hover:bg-gray-800/40 text-sm text-gray-700 dark:text-gray-200"
              onClick={() => setCompletedOpen((v) => !v)}
            >
              <span>Completed ({completedEntries.length})</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`w-4 h-4 transition-transform ${
                  completedOpen ? "rotate-180" : "rotate-0"
                }`}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 9l6 6 6-6"
                />
              </svg>
            </button>

            {completedOpen ? (
              <div className="mt-1 space-y-0.5">
                {completedEntries.length ? (
                  completedEntries.map(({ task, index }) => (
                    <div
                      key={task.taskId || index}
                      className="flex items-start justify-between gap-2 py-1.5 rounded-md px-2 text-gray-600 dark:text-gray-400"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm leading-5 break-words line-through">
                          {task.task}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">
                    No completed tasks
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodoList;
