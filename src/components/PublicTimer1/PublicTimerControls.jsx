"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { formatTime } from "../../utils/timeUtils";
import Button from "../Button";

const PublicTimerControls = ({ showNotification }) => {
  const [focusTime, setFocusTime] = useState(25);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(focusTime * 60);
  const [breakTime, setBreakTime] = useState(5);
  const [isBreakRunning, setIsBreakRunning] = useState(false);
  const [bTime, setBTime] = useState(breakTime * 60);
  const [focusEnded, setFocusEnded] = useState(false);
  const [breakEnded, setBreakEnded] = useState(false);
  const [startTimestamp, setStartTimestamp] = useState(null);
  const [breakStartTimestamp, setBreakStartTimestamp] = useState(null);

  const alarmSoundRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      alarmSoundRef.current = new Audio(
        new URL("/futuristic_alarm.mp3", window.location.origin)
      );
    }
  }, []);

  // Focus timer effect
  useEffect(() => {
    let timer;
    if (isRunning && !focusEnded) {
      if (!startTimestamp) setStartTimestamp(Date.now());
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
        const remaining = focusTime * 60 - elapsed;
        if (remaining <= 0) {
          setTime(0);
          setFocusEnded(true);
          setIsRunning(false);
          clearInterval(timer);

          // Show notification for focus completion
          if (showNotification) {
            showNotification("🎉 Focus Session Complete!", {
              body: `Excellent! You completed ${focusTime} minutes of focused work. Sign in to track your progress!`,
              icon: "/favicon.ico",
            });
          }

          if (alarmSoundRef.current) alarmSoundRef.current.play();
        } else {
          setTime(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, focusEnded, focusTime, startTimestamp, showNotification]);

  // Break timer effect
  useEffect(() => {
    let breakTimer;
    if (isBreakRunning && !breakEnded) {
      if (!breakStartTimestamp) setBreakStartTimestamp(Date.now());
      breakTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - breakStartTimestamp) / 1000);
        const remaining = breakTime * 60 - elapsed;
        if (remaining <= 0) {
          setBTime(0);
          setBreakEnded(true);
          setIsBreakRunning(false);
          clearInterval(breakTimer);

          // Show notification for break completion
          if (showNotification) {
            showNotification("☕ Break Complete!", {
              body: `Your ${breakTime} minute break is over. Ready for another focused session?`,
              icon: "/favicon.ico",
            });
          }

          if (alarmSoundRef.current) alarmSoundRef.current.play();

          // Reset to initial state for next session
          handleReset();
        } else {
          setBTime(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(breakTimer);
  }, [
    isBreakRunning,
    breakEnded,
    breakTime,
    breakStartTimestamp,
    showNotification,
  ]);

  // Update time when focus time changes
  useEffect(() => {
    if (!isRunning && !focusEnded) {
      setTime(focusTime * 60);
    }
  }, [focusTime, isRunning, focusEnded]);

  // Update break time when break time changes
  useEffect(() => {
    if (!isBreakRunning && !breakEnded) {
      setBTime(breakTime * 60);
    }
  }, [breakTime, isBreakRunning, breakEnded]);

  const handleStart = () => {
    setIsRunning(true);
    setStartTimestamp(Date.now() - (focusTime * 60 - time) * 1000);
  };

  const handlePause = () => {
    setIsRunning(false);
    setStartTimestamp(null);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsBreakRunning(false);
    setFocusEnded(false);
    setBreakEnded(false);
    setTime(focusTime * 60);
    setBTime(breakTime * 60);
    setStartTimestamp(null);
    setBreakStartTimestamp(null);
  };

  const handleStartBreak = () => {
    setIsBreakRunning(true);
    setBreakStartTimestamp(Date.now() - (breakTime * 60 - bTime) * 1000);
  };

  const handlePauseBreak = () => {
    setIsBreakRunning(false);
    setBreakStartTimestamp(null);
  };

  return (
    <motion.div
      className="w-full flex flex-col timer-section"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Timer Display Section */}
      {(isRunning || focusEnded || isBreakRunning) && (
        <div className="w-full h-full flex justify-center items-center">
          {/* Focus Timer Display */}
          {isRunning && !focusEnded && (
            <motion.div
              className="text-5xl font-bold mt-5 bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {formatTime(time)}
            </motion.div>
          )}

          {/* Focus Complete Display */}
          {focusEnded && !isBreakRunning && (
            <motion.div
              className="text-2xl font-bold mt-5 text-success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              Focus Complete! 🎉
            </motion.div>
          )}

          {/* Break Timer Display */}
          {isBreakRunning && (
            <motion.div
              className="text-4xl font-bold mt-5 text-success"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {formatTime(bTime)}
            </motion.div>
          )}
        </div>
      )}

      {/* Time Selectors Section - Only show when not running AND focus hasn't ended yet */}
      {!isRunning && !isBreakRunning && !focusEnded && (
        <div className="w-full flex justify-between items-center mt-5 px-8">
          {/* Focus Time Selector - Left */}
          <motion.div
            className="selectTime"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <label className="text-fg-muted font-medium">
              Focus Time:{" "}
            </label>
            <select
              value={focusTime}
              onChange={(e) => setFocusTime(Number(e.target.value))}
              className="text-fg bg-surface border border-edge p-2 rounded-md ml-2 focus:border-focus focus:outline-none transition-colors duration-300"
            >
              {[0.5, 25, 30, 35, 40, 45, 50].map((t) => (
                <option
                  key={t}
                  value={t}
                  className="text-fg bg-surface"
                >
                  {t} min
                </option>
              ))}
            </select>
          </motion.div>

          {/* Break Time Selector - Right */}
          <motion.div
            className="selectTime"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <label className="text-fg-muted font-medium">
              Break Time:{" "}
            </label>
            <select
              value={breakTime}
              onChange={(e) => setBreakTime(Number(e.target.value))}
              className="text-fg bg-surface border border-edge p-2 rounded-md ml-2 focus:border-focus focus:outline-none transition-colors duration-300"
            >
              {[0, 5, 10, 15, 20].map((t) => (
                <option
                  key={t}
                  value={t}
                  className="text-fg bg-surface"
                >
                  {t} min
                </option>
              ))}
            </select>
          </motion.div>
        </div>
      )}

      {/* Session Summary - Show completed times when focus is done */}
      {focusEnded && !isBreakRunning && (
        <div className="w-full flex justify-between items-center mt-5 px-8">
          {/* Completed Focus Time - Left */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-fg-muted font-medium mb-1">
              Focus Completed:
            </div>
            <div className="text-2xl font-bold text-primary">
              {focusTime} min
            </div>
          </motion.div>

          {/* Selected Break Time - Right */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-fg-muted font-medium mb-1">
              Break Time:
            </div>
            <div className="text-2xl font-bold text-success">
              {breakTime} min
            </div>
          </motion.div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="w-full flex justify-center gap-4 bg-surface-2 p-4 rounded-md mt-4 transition-colors duration-300">
        {/* Focus Timer Controls */}
        {!focusEnded && (
          <>
            <Button
              onClick={isRunning ? handlePause : handleStart}
              className={`px-8 ${isRunning ? "!bg-warning hover:!bg-warning-hover !text-white" : "!bg-accent hover:!bg-accent-hover !text-accent-fg"}`}
            >
              {isRunning ? "Pause" : "Start Focus"}
            </Button>
          </>
        )}

        {/* Break Controls */}
        {focusEnded && (
          <motion.div
            className="flex gap-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.button
              className={`${isBreakRunning ? "bg-warning hover:bg-warning-hover" : "bg-success hover:bg-success-hover"} text-white px-6 py-2 rounded-lg font-medium transition-all duration-200`}
              onClick={isBreakRunning ? handlePauseBreak : handleStartBreak}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isBreakRunning ? "Pause Break" : "Start Break"}
            </motion.button>

            <motion.button
              className="bg-accent hover:bg-accent-hover text-accent-fg px-6 py-2 rounded-lg font-medium transition-all duration-200"
              onClick={handleReset}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              New Session
            </motion.button>
          </motion.div>
        )}

        {/* Reset Button (always available) */}
        <Button
          onClick={handleReset}
          className="px-8 !bg-danger hover:!bg-danger-hover !text-white"
        >
          Reset
        </Button>
      </div>

      {/* Guest Mode Notice */}
      <motion.div
        className="mt-4 p-3 bg-primary-soft border border-primary/30 rounded-lg text-center transition-colors duration-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <p className="text-primary text-sm">
          💡 <strong>Guest Mode:</strong> Timer works fully but sessions aren't
          saved.
          <br />
          Sign in above to track your productivity over time!
        </p>
      </motion.div>
    </motion.div>
  );
};

export default PublicTimerControls;
