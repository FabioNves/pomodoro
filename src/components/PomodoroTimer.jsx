"use client";
import { useState, useCallback } from "react";
import TimerControls from "./TimerControls";
import SessionTasks from "./SessionTasks";
import TodoList from "./TodoList";
import SessionHistory from "./SessionHistory";
import useUser from "../hooks/useUser";

const PomodoroTimer = () => {
  const {
    user,
    sessions,
    brands,
    setBrands,
    milestones,
    setMilestones,
    error,
  } = useUser();
  const [todoInput, setTodoInput] = useState("");
  const [todoTasks, setTodoTasks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedDay, setSelectedDay] = useState("today");

  console.log("User from useUser hook:", user); // Debug log

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
    <div className="w-screen h-[calc(100vh-2rem)] flex flex-col justify-center items-center p-5 px-40 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold py-4">Pomodoro Timer</h1>
      {user && <p>Welcome back {user.name}</p>}
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
          sessions={filteredSessions} // Pass filtered sessions
        />
      </div>
    </div>
  );
};

export default PomodoroTimer;
