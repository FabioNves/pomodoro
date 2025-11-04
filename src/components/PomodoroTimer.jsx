"use client";

import React, { useState, useEffect, useCallback } from "react";
import TimerControls from "./TimerControls";
import SessionTasks from "./SessionTasks";
import CompletedSessions from "./CompletedSessions";
import TodoList from "./TodoList";
import GoogleSignIn from "./GoogleSignIn";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const PomodoroTimer = ({ showNotification }) => {
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [todoInput, setTodoInput] = useState("");
  const [todoTasks, setTodoTasks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedDay, setSelectedDay] = useState("today");
  const [brands, setBrands] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState([]);

  // Add active project state that persists across sessions
  const [activeProject, setActiveProject] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("activeProject");
      return saved ? JSON.parse(saved) : { title: "", milestone: "" };
    }
    return { title: "", milestone: "" };
  });

  // Save active project to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeProject", JSON.stringify(activeProject));
    }
  }, [activeProject]);

  useEffect(() => {
    setHasMounted(true);

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token && token.split(".").length === 3) {
        try {
          const decodedUser = jwtDecode(token);
          setUser(decodedUser);
        } catch (error) {
          console.error("Error decoding token:", error);
          localStorage.removeItem("accessToken");
        }
      } else {
        localStorage.removeItem("accessToken");
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const userId = user?.userId || localStorage.getItem("userId");

      try {
        // Fetch sessions
        const sessionsResponse = await fetch("/api/sessions", {
          headers: { "user-id": userId },
        });
        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          setSessions(sessionsData);
        }

        // Fetch brands
        const brandsResponse = await fetch("/api/brands", {
          headers: { "user-id": userId },
        });
        if (brandsResponse.ok) {
          const brandsData = await brandsResponse.json();
          setBrands(brandsData);
        }

        // Fetch milestones
        const milestonesResponse = await fetch("/api/milestones", {
          headers: { "user-id": userId },
        });
        if (milestonesResponse.ok) {
          const milestonesData = await milestonesResponse.json();
          setMilestones(milestonesData);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Could not load data");
      }
    };

    fetchData();
  }, [user]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const transferTaskToSession = (index) => {
    const taskToTransfer = todoTasks[index];
    setTasks([...tasks, taskToTransfer]);
    setTodoTasks(todoTasks.filter((_, i) => i !== index));
  };

  const toggleBackToDo = (index) => {
    const taskToMoveBack = tasks[index];
    setTodoTasks([...todoTasks, taskToMoveBack]);
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const addTodoTask = (task, brand, milestone) => {
    setTodoTasks([
      ...todoTasks,
      {
        task,
        brand: { title: brand, milestone },
        completed: false,
      },
    ]);
  };

  const handleSessionCompletion = useCallback(
    async (focus, brk) => {
      const userId = user?.userId || localStorage.getItem("userId");

      // If no active project is set, prompt user to select one
      if (!activeProject.title) {
        const availableBrands = brands.map((b) => b.name).join(", ");
        alert(
          `Please select a project first from: ${
            availableBrands || "Create a project first"
          }`
        );
        return;
      }

      const sessionData = {
        focusTime: focus,
        breakTime: brk,
        currentProject: activeProject, // Save the active project
        tasks: tasks.map((task) => ({
          task: task.task || "", // Optional task description
          brand: {
            title: activeProject.title, // Use active project
            milestone: activeProject.milestone || "",
          },
        })),
      };

      try {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "user-id": userId,
          },
          body: JSON.stringify(sessionData),
        });

        if (!response.ok) {
          throw new Error("Failed to save session");
        }

        console.log("Session saved successfully");

        // Clear only the tasks, keep the active project
        setTasks([]);

        if (showNotification) {
          showNotification("🎯 Session Completed!", {
            body: `Great work! You completed a ${focus}-minute focus session on ${
              activeProject.title
            }${
              activeProject.milestone ? ` - ${activeProject.milestone}` : ""
            }.`,
            icon: "/favicon.ico",
          });
        }

        // Refresh sessions after completion
        const refreshResponse = await fetch("/api/sessions", {
          headers: { "user-id": userId },
        });
        if (refreshResponse.ok) {
          const updatedSessions = await refreshResponse.json();
          setSessions(updatedSessions);
        }
      } catch (error) {
        console.error("Error saving session", error);
      }
    },
    [tasks, user, showNotification, activeProject, brands]
  );

  if (!hasMounted) return null;

  return (
    <div className="min-h-screen  text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-8">
          {/* Header */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-md md:text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Boost your productivity with focused work sessions
            </h1>
          </motion.div>

          {/* Authentication Section */}
          {!user && (
            <motion.div
              className="w-full max-w-md"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <GoogleSignIn onLoginSuccess={handleLoginSuccess} />
            </motion.div>
          )}

          {/* Main Content */}
          {user && (
            <motion.div
              className="w-full space-y-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {/* Timer Section */}
              <div className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm border border-gray-700/50">
                <TimerControls
                  handleSessionCompletion={handleSessionCompletion}
                  showNotification={showNotification}
                  activeProject={activeProject}
                />
              </div>
              {/* Active Project Banner */}
              {/* <motion.div
                className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-4 border border-blue-500/30"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Current Project</h3>
                    <p className="text-gray-300">
                      {activeProject.title ? (
                        <>
                          <span className="text-blue-400">
                            {activeProject.title}
                          </span>
                          {activeProject.milestone && (
                            <span className="text-purple-400 ml-2">
                              • {activeProject.milestone}
                            </span>
                          )}
                        </>
                      ) : (
                        "No project selected"
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // Show project selector modal or redirect to project selection
                      const projectSelector =
                        document.getElementById("project-selector");
                      if (projectSelector) {
                        projectSelector.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    {activeProject.title ? "Change Project" : "Select Project"}
                  </button>
                </div>
              </motion.div> */}

              {/* Todo List and Session Tasks Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm border border-gray-700/50">
                  <TodoList
                    id="project-selector"
                    user={user}
                    todoInput={todoInput}
                    setTodoInput={setTodoInput}
                    todoTasks={todoTasks}
                    addTodoTask={addTodoTask}
                    setTodoTasks={setTodoTasks}
                    transferTaskToSession={transferTaskToSession}
                    brands={brands}
                    setBrands={setBrands}
                    milestones={milestones}
                    setMilestones={setMilestones}
                    activeProject={activeProject}
                    setActiveProject={setActiveProject}
                  />
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm border border-gray-700/50">
                  <SessionTasks
                    tasks={tasks}
                    toggleBackToDo={toggleBackToDo}
                    activeProject={activeProject}
                  />
                </div>
              </div>

              {/* Completed Sessions */}
              <div className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm border border-gray-700/50">
                <CompletedSessions sessions={sessions} />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PomodoroTimer;
