"use client";
import { useState, useCallback, useEffect } from "react";
import TimerControls from "./TimerControls";
import SessionTasks from "./SessionTasks";
import TodoList from "./TodoList";
import SessionHistory from "./SessionHistory";
import LoginPage from "./LoginPage";
import { jwtDecode } from "jwt-decode";

const PomodoroTimer = () => {
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
    const fetchSessions = async () => {
      try {
        const userId = user?.userId || localStorage.getItem("userId");
        const response = await fetch("/api/sessions", {
          headers: { "user-id": userId },
        });
        if (!response.ok) throw new Error("Failed to fetch sessions");
        const data = await response.json();
        setSessions(data);
      } catch (err) {
        setError("Could not load sessions");
        setSessions([]);
      }
    };
    fetchSessions();
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
      const sessionData = {
        focusTime: focus,
        breakTime: brk,
        tasks: tasks.map((task) => ({
          task: task.task,
          brand: {
            title: task.brand?.title || "",
            milestone: task.brand?.milestone || "",
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
        setTasks([]);
      } catch (error) {
        console.error("Error saving session", error);
      }
    },
    [tasks, user]
  );

  if (!hasMounted) return null;

  if (!user) {
    return (
      <div className="w-full  h-[calc(100vh-6rem)] flex flex-col justify-center items-center p-5 px-40 bg-gray-900 text-white">
        <h1 className="text-3xl font-bold py-4">Pomodoro Timer</h1>
        <div className="w-full flex justify-around items-start gap-2 py-4 px-8 border-2 border-white rounded-md">
          <TimerControls handleSessionCompletion={handleSessionCompletion} />
        </div>
        <div className="w-full flex justify-center mt-4">
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  const filteredSessions = sessions.filter((session) =>
    selectedDay === "today"
      ? session.date.startsWith(new Date().toISOString().split("T")[0])
      : session.date.startsWith(
          new Date(new Date().setDate(new Date().getDate() - 1))
            .toISOString()
            .split("T")[0]
        )
  );

  return (
    <div className="w-screen h-[calc(100vh-6rem)] flex flex-col justify-center items-center p-5 px-40 bg-gray-900 text-white overflow-auto scrollbar-hide">
      <h1 className="text-3xl font-bold py-4">Pomodoro Timer</h1>
      <p>Welcome back {user.name}</p>
      <div className="w-full flex justify-around items-start gap-2 py-4 px-8 border-2 border-white rounded-md">
        <TimerControls handleSessionCompletion={handleSessionCompletion} />
        <div className="w-1/3">
          <SessionTasks tasks={tasks} toggleBackToDo={toggleBackToDo} />
        </div>
      </div>
      <div className="w-full flex gap-8 justify-center">
        <TodoList
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
        />
        <SessionHistory
          user={user}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          error={error}
          sessions={filteredSessions}
        />
      </div>
    </div>
  );
};

export default PomodoroTimer;
