"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { jwtDecode } from "jwt-decode";
import { generateSessionId } from "@/utils/sessionUtils";

function getIdentityHeaders() {
  if (typeof window === "undefined") return {};
  const userId = localStorage.getItem("userId");
  if (userId) return { "user-id": userId };
  return { "session-id": generateSessionId() };
}

async function apiJson(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...getIdentityHeaders(),
    "Content-Type": "application/json",
  };

  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return res.json();
}

function IconDots({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function IconDotsVertical({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

const PROJECT_COLORS = [
  {
    key: "blue",
    label: "Blue",
    swatchClass: "bg-blue-500",
    headerClass: "bg-blue-500/30 dark:bg-blue-400/25",
    borderClass: "border-blue-500/20 dark:border-blue-400/30",
  },
  {
    key: "green",
    label: "Green",
    swatchClass: "bg-green-500",
    headerClass: "bg-green-500/30 dark:bg-green-400/25",
    borderClass: "border-green-500/20 dark:border-green-400/30",
  },
  {
    key: "red",
    label: "Red",
    swatchClass: "bg-red-500",
    headerClass: "bg-red-500/30 dark:bg-red-400/25",
    borderClass: "border-red-500/20 dark:border-red-400/30",
  },
  {
    key: "orange",
    label: "Orange",
    swatchClass: "bg-orange-500",
    headerClass: "bg-orange-500/30 dark:bg-orange-400/25",
    borderClass: "border-orange-500/20 dark:border-orange-400/30",
  },
  {
    key: "purple",
    label: "Purple",
    swatchClass: "bg-purple-500",
    headerClass: "bg-purple-500/30 dark:bg-purple-400/25",
    borderClass: "border-purple-500/20 dark:border-purple-400/30",
  },
  {
    key: "gray",
    label: "Gray",
    swatchClass: "bg-gray-500",
    headerClass: "bg-gray-500/30 dark:bg-gray-400/25",
    borderClass: "border-gray-500/20 dark:border-gray-400/30",
  },
];

function getProjectColorMeta(headerColor) {
  return PROJECT_COLORS.find((c) => c.key === headerColor) || PROJECT_COLORS[0];
}

function ProjectOptionsMenu({ project, onDelete, onSetColor }) {
  return (
    <motion.div
      className="w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Header color
      </div>
      <div className="px-3 pb-2 grid grid-cols-6 gap-2">
        {PROJECT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`w-5 h-5 rounded-full ${c.swatchClass} border border-white/40 dark:border-black/20 hover:scale-105 transition-transform`}
            aria-label={`Set color to ${c.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onSetColor(project, c.key);
            }}
          />
        ))}
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700" />
      <button
        type="button"
        className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(project);
        }}
      >
        Delete project
      </button>
    </motion.div>
  );
}

function IconChevron({ open, className = "" }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.15 }}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </motion.svg>
  );
}

function ToggleCircle({ checked, onToggle }) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
        checked
          ? "bg-[#014acd] border-[#014acd]"
          : "bg-transparent border-gray-300 dark:border-gray-600"
      }`}
      whileTap={{ scale: 0.95 }}
      aria-pressed={checked}
      aria-label={checked ? "Mark as not completed" : "Mark as completed"}
    >
      {checked ? (
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3"
          className="w-3.5 h-3.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </motion.svg>
      ) : null}
    </motion.button>
  );
}

function compareTasksByOrder(a, b) {
  const ao = Number.isFinite(a?.order) ? a.order : 0;
  const bo = Number.isFinite(b?.order) ? b.order : 0;
  if (ao !== bo) return ao - bo;
  const ad = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bd = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return ad - bd;
}

function TaskRow({
  task,
  subtasks,
  onToggle,
  onCreateSubtask,
  onDeleteTask,
  onMoveTask,
  projectId,
  depth = 0,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const canDrag = depth === 0 && !task.completed && !task.parentTask;

  useEffect(() => {
    if (menuOpen) {
      const closeMenu = () => setMenuOpen(false);
      document.addEventListener("click", closeMenu);
      return () => document.removeEventListener("click", closeMenu);
    }
  }, [menuOpen]);

  return (
    <div>
      <div
        className={`group flex items-start gap-2 py-1.5 rounded-md hover:bg-white/70 dark:hover:bg-gray-800/40 transition-colors px-2 ${
          depth > 0 ? "ml-5" : ""
        } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
        draggable={canDrag}
        onDragStart={(e) => {
          if (!canDrag) return;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(task._id));
        }}
        onDragOver={(e) => {
          if (depth !== 0 || task.completed || task.parentTask) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          if (depth !== 0 || task.completed || task.parentTask) return;
          e.preventDefault();
          e.stopPropagation();
          const draggedId = e.dataTransfer.getData("text/plain");
          if (!draggedId) return;
          if (String(draggedId) === String(task._id)) return;
          onMoveTask?.({
            taskId: draggedId,
            toProjectId: projectId,
            beforeTaskId: task._id,
          });
        }}
      >
        <div className="pt-0.5">
          <ToggleCircle
            checked={task.completed}
            onToggle={() => onToggle(task)}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className={`text-sm leading-5 break-words ${
              task.completed
                ? "text-gray-500 dark:text-gray-400 line-through"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {task.title}
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-label="Task menu"
          >
            <IconDots className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {menuOpen ? (
              <motion.div
                className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-20"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowSubtaskInput(true);
                  }}
                >
                  Create subtask
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700" />
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteTask?.(task);
                  }}
                >
                  Delete task
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showSubtaskInput ? (
          <motion.div
            className="ml-8 mt-1 flex gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <input
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              placeholder="New subtask"
              className="flex-1 px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const title = subtaskTitle.trim();
                  if (!title) return;
                  onCreateSubtask(task, title);
                  setSubtaskTitle("");
                  setShowSubtaskInput(false);
                }
                if (e.key === "Escape") {
                  setShowSubtaskInput(false);
                }
              }}
              autoFocus
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm"
              onClick={() => {
                const title = subtaskTitle.trim();
                if (!title) return;
                onCreateSubtask(task, title);
                setSubtaskTitle("");
                setShowSubtaskInput(false);
              }}
            >
              Add
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {subtasks?.length ? (
        <div className="mt-0.5">
          {subtasks.map((st) => (
            <TaskRow
              key={st._id}
              task={st}
              subtasks={[]}
              onToggle={onToggle}
              onCreateSubtask={onCreateSubtask}
              onDeleteTask={onDeleteTask}
              onMoveTask={onMoveTask}
              projectId={projectId}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProjectColumn({
  project,
  tasks,
  onAddTask,
  onToggleTask,
  onCreateSubtask,
  onDeleteTask,
  onDeleteProject,
  onSetProjectColor,
  onMoveTask,
}) {
  const [newTitle, setNewTitle] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);

  useEffect(() => {
    if (projectMenuOpen) {
      const closeMenu = () => setProjectMenuOpen(false);
      document.addEventListener("click", closeMenu);
      return () => document.removeEventListener("click", closeMenu);
    }
  }, [projectMenuOpen]);

  const { activeTopLevel, completedTopLevel, subtasksByParent } =
    useMemo(() => {
      const topLevel = [...tasks]
        .filter((t) => !t.parentTask)
        .sort(compareTasksByOrder);
      const childrenByParent = new Map();
      for (const t of tasks) {
        if (!t.parentTask) continue;
        const parentId = String(t.parentTask);
        const list = childrenByParent.get(parentId) || [];
        list.push(t);
        childrenByParent.set(parentId, list);
      }

      for (const [k, list] of childrenByParent.entries()) {
        childrenByParent.set(k, [...list].sort(compareTasksByOrder));
      }

      const activeTop = topLevel
        .filter((t) => !t.completed)
        .sort(compareTasksByOrder);
      const completedTop = topLevel
        .filter((t) => t.completed)
        .sort(compareTasksByOrder);

      return {
        activeTopLevel: activeTop,
        completedTopLevel: completedTop,
        subtasksByParent: childrenByParent,
      };
    }, [tasks]);

  const colorMeta = getProjectColorMeta(project.headerColor);

  return (
    <div className="w-[340px] shrink-0">
      <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-visible">
        <div
          className={`flex items-center justify-between px-4 py-3 border-b border-gray-200/70 dark:border-gray-700/70 ${colorMeta.headerClass}`}
        >
          <div className="font-semibold text-gray-900 dark:text-white truncate">
            {project.name}
          </div>
          <div className="relative">
            <button
              type="button"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1"
              aria-label="Project menu"
              onClick={(e) => {
                e.stopPropagation();
                setProjectMenuOpen((v) => !v);
              }}
            >
              <IconDotsVertical className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {projectMenuOpen ? (
                <motion.div className="absolute right-0 mt-1 z-30">
                  <ProjectOptionsMenu
                    project={project}
                    onDelete={(p) => {
                      setProjectMenuOpen(false);
                      onDeleteProject(p);
                    }}
                    onSetColor={(p, color) => {
                      setProjectMenuOpen(false);
                      onSetProjectColor(p, color);
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div className="px-2 py-2">
          <div className="px-2 pb-2">
            {!showInput ? (
              <button
                type="button"
                className="w-full text-left text-sm text-[#2563eb] hover:text-[#1d4ed8] font-medium"
                onClick={() => setShowInput(true)}
              >
                + Add a task
              </button>
            ) : null}
          </div>

          <AnimatePresence>
            {showInput ? (
              <motion.div
                className="px-2 pb-2 flex gap-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Task title"
                  className="flex-1 px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const title = newTitle.trim();
                      if (!title) return;
                      onAddTask(project, title);
                      setNewTitle("");
                      setShowInput(false);
                    }
                    if (e.key === "Escape") setShowInput(false);
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm"
                  onClick={() => {
                    const title = newTitle.trim();
                    if (!title) return;
                    onAddTask(project, title);
                    setNewTitle("");
                    setShowInput(false);
                  }}
                >
                  Add
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div
            className="space-y-0.5"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const draggedId = e.dataTransfer.getData("text/plain");
              if (!draggedId) return;
              onMoveTask?.({
                taskId: draggedId,
                toProjectId: project._id,
                beforeTaskId: null,
              });
            }}
          >
            {activeTopLevel.length ? (
              activeTopLevel.map((t) => (
                <TaskRow
                  key={t._id}
                  task={t}
                  subtasks={subtasksByParent.get(String(t._id)) || []}
                  onToggle={onToggleTask}
                  onCreateSubtask={(parent, title) =>
                    onCreateSubtask(project, parent, title)
                  }
                  onDeleteTask={onDeleteTask}
                  onMoveTask={onMoveTask}
                  projectId={project._id}
                />
              ))
            ) : (
              <div className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">
                No tasks yet
              </div>
            )}
          </div>

          <div className="px-2 pb-3">
            <button
              type="button"
              className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/70 dark:hover:bg-gray-800/40 text-sm text-gray-700 dark:text-gray-200"
              onClick={() => setCompletedOpen((v) => !v)}
            >
              <span>Completed ({completedTopLevel.length})</span>
              <IconChevron open={completedOpen} className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {completedOpen ? (
                <motion.div
                  className="mt-1"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {completedTopLevel.length ? (
                    <div className="space-y-0.5">
                      {completedTopLevel.map((t) => (
                        <TaskRow
                          key={t._id}
                          task={t}
                          subtasks={subtasksByParent.get(String(t._id)) || []}
                          onToggle={onToggleTask}
                          onCreateSubtask={(parent, title) =>
                            onCreateSubtask(project, parent, title)
                          }
                          onDeleteTask={onDeleteTask}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">
                      No completed tasks
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [projectsOpen, setProjectsOpen] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState("");

  const tasksByProject = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      const pid = String(t.project);
      const list = map.get(pid) || [];
      list.push(t);
      map.set(pid, list);
    }
    return map;
  }, [tasks]);

  // Load user from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("accessToken");
    if (token && token.split(".").length === 3) {
      try {
        const decodedUser = jwtDecode(token);
        setUser(decodedUser);
      } catch (error) {
        console.error("Error decoding token:", error);
        localStorage.removeItem("accessToken");
      }
    }
  }, []);

  const mountedRef = useRef(true);
  const tasksRef = useRef(tasks);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([
        apiJson("/api/projects"),
        apiJson("/api/tasks"),
      ]);
      if (mountedRef.current) {
        setProjects(p);
        setTasks(t);
      }
    } catch (e) {
      if (mountedRef.current) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const createProject = useCallback(async (name) => {
    try {
      const created = await apiJson("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (mountedRef.current) {
        setProjects((prev) => [...prev, created]);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const addTask = useCallback(async (project, title) => {
    try {
      const created = await apiJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ projectId: project._id, title }),
      });
      if (mountedRef.current) {
        setTasks((prev) => [...prev, created]);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const createSubtask = useCallback(async (project, parentTask, title) => {
    try {
      const created = await apiJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: project._id,
          title,
          parentTaskId: parentTask._id,
        }),
      });
      if (mountedRef.current) {
        setTasks((prev) => [...prev, created]);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleTask = useCallback(async (task) => {
    try {
      const updated = await apiJson("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify({ id: task._id, completed: !task.completed }),
      });
      if (mountedRef.current) {
        setTasks((prev) =>
          prev.map((t) => (t._id === updated._id ? updated : t))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteProject = useCallback(async (project) => {
    const ok = window.confirm(`Delete project "${project.name}"?`);
    if (!ok) return;

    try {
      await apiJson("/api/projects", {
        method: "DELETE",
        body: JSON.stringify({ id: project._id }),
      });

      if (mountedRef.current) {
        setProjects((prev) => prev.filter((p) => p._id !== project._id));
        setTasks((prev) =>
          prev.filter((t) => String(t.project) !== String(project._id))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteTask = useCallback(
    async (task) => {
      const label = task?.title ? `"${task.title}"` : "this task";
      const ok = window.confirm(`Delete ${label}? This also deletes subtasks.`);
      if (!ok) return;

      try {
        await apiJson("/api/tasks", {
          method: "DELETE",
          body: JSON.stringify({ id: task._id }),
        });

        if (mountedRef.current) {
          const rootId = String(task._id);
          setTasks((prev) => {
            const byParent = new Map();
            for (const t of prev) {
              const pid = t.parentTask ? String(t.parentTask) : null;
              if (!pid) continue;
              const list = byParent.get(pid) || [];
              list.push(t);
              byParent.set(pid, list);
            }

            const toDelete = new Set([rootId]);
            const queue = [rootId];
            while (queue.length) {
              const cur = queue.shift();
              const kids = byParent.get(cur) || [];
              for (const k of kids) {
                const kidId = String(k._id);
                if (toDelete.has(kidId)) continue;
                toDelete.add(kidId);
                queue.push(kidId);
              }
              if (toDelete.size > 10000) break;
            }

            return prev.filter((t) => !toDelete.has(String(t._id)));
          });
        }
      } catch (e) {
        console.error(e);
        refresh();
      }
    },
    [refresh]
  );

  const setProjectColor = useCallback(async (project, headerColor) => {
    if (mountedRef.current) {
      setProjects((prev) =>
        prev.map((p) =>
          String(p._id) === String(project._id) ? { ...p, headerColor } : p
        )
      );
    }

    try {
      const updated = await apiJson("/api/projects", {
        method: "PATCH",
        body: JSON.stringify({ id: project._id, headerColor }),
      });

      if (mountedRef.current) {
        setProjects((prev) =>
          prev.map((p) => (String(p._id) === String(updated._id) ? updated : p))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const [sidebarMenuProjectId, setSidebarMenuProjectId] = useState(null);

  useEffect(() => {
    if (!sidebarMenuProjectId) return;
    const closeMenu = () => setSidebarMenuProjectId(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [sidebarMenuProjectId]);

  const moveTask = useCallback(
    async ({ taskId, toProjectId, beforeTaskId }) => {
      const current = tasksRef.current;
      const dragged = current.find((t) => String(t._id) === String(taskId));
      if (!dragged) return;
      if (dragged.parentTask) return;
      if (dragged.completed) return;

      const fromProjectId = String(dragged.project);
      const targetProjectId = String(toProjectId);

      const isActiveTopInProject = (pid) => (t) =>
        !t.completed && !t.parentTask && String(t.project) === String(pid);

      const sortList = (list) => [...list].sort(compareTasksByOrder);

      const baseFrom = sortList(
        current
          .filter(isActiveTopInProject(fromProjectId))
          .filter((t) => String(t._id) !== String(taskId))
      );

      const baseTo =
        fromProjectId === targetProjectId
          ? baseFrom
          : sortList(
              current
                .filter(isActiveTopInProject(targetProjectId))
                .filter((t) => String(t._id) !== String(taskId))
            );

      let insertIndex = baseTo.length;
      if (beforeTaskId) {
        const idx = baseTo.findIndex(
          (t) => String(t._id) === String(beforeTaskId)
        );
        if (idx >= 0) insertIndex = idx;
      }

      const moved = {
        ...dragged,
        project: targetProjectId,
      };

      const nextTo = [...baseTo];
      nextTo.splice(insertIndex, 0, moved);

      const updates = [];
      const nextById = new Map();

      const applyOrders = (list, pid) => {
        list.forEach((t, idx) => {
          const id = String(t._id);
          const isMoved = id === String(taskId);
          const update = {
            id,
            order: idx,
            ...(isMoved || String(t.project) !== String(pid)
              ? { projectId: String(pid) }
              : {}),
          };
          updates.push(update);
          nextById.set(id, update);
        });
      };

      if (fromProjectId === targetProjectId) {
        applyOrders(nextTo, targetProjectId);
      } else {
        applyOrders(baseFrom, fromProjectId);
        applyOrders(nextTo, targetProjectId);
      }

      const nextTasks = current.map((t) => {
        const u = nextById.get(String(t._id));
        if (!u) return t;
        const updated = { ...t, order: u.order };
        if (u.projectId) updated.project = u.projectId;
        return updated;
      });

      if (mountedRef.current) setTasks(nextTasks);

      try {
        await apiJson("/api/tasks/reorder", {
          method: "PATCH",
          body: JSON.stringify({ updates }),
        });
      } catch (e) {
        console.error(e);
        refresh();
      }
    },
    [refresh]
  );

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="w-full h-[calc(100vh-6rem)] flex">
        {/* Sidebar */}
        <div className="w-[280px] h-full px-4 pb-6 overflow-y-auto">
          <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-3">
            <button
              type="button"
              className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/70 dark:hover:bg-gray-800/40"
              onClick={() =>
                setProjectsOpen((v) => (creatingProject ? true : !v))
              }
            >
              <span className="font-semibold">Projects</span>
              <IconChevron open={projectsOpen} className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {projectsOpen ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="mt-2 space-y-1">
                    {projects.map((p) => (
                      <div
                        key={p._id}
                        className="group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-800/40"
                      >
                        <div className="flex-1 min-w-0 truncate">{p.name}</div>
                        <div className="relative">
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1"
                            aria-label="Project menu"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSidebarMenuProjectId((cur) =>
                                cur === p._id ? null : p._id
                              );
                            }}
                          >
                            <IconDotsVertical className="w-4 h-4" />
                          </button>

                          <AnimatePresence>
                            {sidebarMenuProjectId === p._id ? (
                              <motion.div
                                className="absolute right-0 mt-1 z-30"
                                onClick={(e) => e.stopPropagation()}
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                              >
                                <ProjectOptionsMenu
                                  project={p}
                                  onDelete={(proj) => {
                                    setSidebarMenuProjectId(null);
                                    deleteProject(proj);
                                  }}
                                  onSetColor={(proj, color) => {
                                    setSidebarMenuProjectId(null);
                                    setProjectColor(proj, color);
                                  }}
                                />
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      </div>
                    ))}
                    {!projects.length ? (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No projects yet
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    {!creatingProject ? (
                      <button
                        type="button"
                        className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-white dark:hover:bg-gray-800/50"
                        onClick={() => setCreatingProject(true)}
                      >
                        + Create new project
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <input
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder="Project name"
                          className="flex-1 px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const name = projectName.trim();
                              if (!name) return;
                              createProject(name).catch((err) =>
                                console.error(err)
                              );
                              setProjectName("");
                              setCreatingProject(false);
                            }
                            if (e.key === "Escape") setCreatingProject(false);
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="w-full px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm"
                          onClick={() => {
                            const name = projectName.trim();
                            if (!name) return;
                            createProject(name).catch((err) =>
                              console.error(err)
                            );
                            setProjectName("");
                            setCreatingProject(false);
                          }}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 h-full pr-4 pb-6 overflow-hidden">
          <div className="h-full bg-white/40 dark:bg-gray-950/10 border border-gray-200/50 dark:border-gray-800/40 rounded-2xl overflow-hidden">
            <div className="h-full overflow-x-auto overflow-y-hidden">
              <div className="h-full flex items-start gap-4 p-4 min-w-max">
                {projects.map((p) => (
                  <ProjectColumn
                    key={p._id}
                    project={p}
                    tasks={tasksByProject.get(String(p._id)) || []}
                    onAddTask={addTask}
                    onToggleTask={toggleTask}
                    onCreateSubtask={createSubtask}
                    onDeleteTask={deleteTask}
                    onDeleteProject={deleteProject}
                    onSetProjectColor={setProjectColor}
                    onMoveTask={moveTask}
                  />
                ))}

                {!projects.length ? (
                  <div className="text-gray-600 dark:text-gray-300 px-4 py-4">
                    Create a project to start adding tasks.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
