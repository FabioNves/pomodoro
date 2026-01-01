"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { formatTime } from "../utils/timeUtils";

const TimerControls = ({ handleSessionCompletion, showNotification }) => {
  const [startFocus, setStartFocus] = useState(false);
  const [focusTime, setFocusTime] = useState(25);
  const [focusEnded, setFocusEnded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(focusTime * 60);
  const [startBreak, setStartBreak] = useState(false);
  const [breakTime, setBreakTime] = useState(5);
  const [breakEnded, setBreakEnded] = useState(false);
  const [isBreakRunning, setIsBreakRunning] = useState(false);
  const [bTime, setBTime] = useState(breakTime * 60);
  const [startTimestamp, setStartTimestamp] = useState(null);
  const [breakStartTimestamp, setBreakStartTimestamp] = useState(null);
  const [showBreakOptions, setShowBreakOptions] = useState(false); // Track break selection mode

  const alarmSoundRef = useRef(null);

  useEffect(() => {
    // Initialize the alarm sound on the client side
    if (typeof window !== "undefined") {
      alarmSoundRef.current = new Audio(
        new URL("/futuristic_alarm.mp3", window.location.origin)
      );
    }
  }, []);

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
          setShowBreakOptions(true); // Show break options when focus ends
          clearInterval(timer);

          // Enhanced notification with action buttons
          if (showNotification) {
            showNotification("🎉 Focus Session Complete!", {
              body: `Great job! You completed ${focusTime} minutes of focused work. What would you like to do next?`,
              icon: "/favicon.ico",
              actions: [
                {
                  action: "start-break",
                  title: `Start ${breakTime || 5} min Break`,
                  icon: "/break-icon.png",
                },
                {
                  action: "finish-session",
                  title: "Finish Session",
                  icon: "/finish-icon.png",
                },
              ],
              onStartBreak: handleStartBreakFromNotification,
              onFinishSession: handleFinishSessionFromNotification,
              onClick: () => {
                window.focus();
                // Optional: scroll to timer section
                document
                  .querySelector(".timer-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              },
            });
          }

          if (alarmSoundRef.current) alarmSoundRef.current.play();
        } else {
          setTime(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [
    isRunning,
    focusEnded,
    focusTime,
    startTimestamp,
    showNotification,
    breakTime,
  ]);

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
          // Complete reset after break ends
          resetToInitialState();
          handleSessionCompletion(focusTime, breakTime);
          if (alarmSoundRef.current && !alarmSoundRef.current.paused) {
            alarmSoundRef.current.pause();
            alarmSoundRef.current.currentTime = 0;
          }
          if (alarmSoundRef.current) alarmSoundRef.current.play();
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
    handleSessionCompletion,
    focusTime,
  ]);

  useEffect(() => {
    // Only update time when not in an active session AND focus hasn't ended
    if (!startFocus && !focusEnded) {
      setTime(focusTime * 60);
    }
  }, [focusTime, startFocus, focusEnded]);

  useEffect(() => {
    // Only update bTime when not in an active break session AND break hasn't started
    if (!startBreak && !breakEnded) {
      setBTime(breakTime * 60);
    }
  }, [breakTime, startBreak, breakEnded]);

  // Helper function to reset all states to initial
  const resetToInitialState = () => {
    setStartFocus(false);
    setFocusEnded(false);
    setIsRunning(false);
    setStartBreak(false);
    setBreakEnded(false);
    setIsBreakRunning(false);
    setStartTimestamp(null);
    setBreakStartTimestamp(null);
    setFocusTime(25);
    // Note: breakTime is NOT reset so it persists across sessions
    // This allows users to keep their preferred break duration
    // Time will be updated by the useEffect when focusTime changes and startFocus is false
  };

  const handleStart = () => {
    setStartFocus(true);
    setIsRunning(true);
    setStartTimestamp(Date.now() - (focusTime * 60 - time) * 1000); // Resume from paused time
  };

  const handlePause = () => {
    setIsRunning(false);
    setStartTimestamp(null);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(focusTime * 60);
    setFocusEnded(false);
    setStartBreak(false);
    setStartTimestamp(null);
    setBreakStartTimestamp(null);
    setIsBreakRunning(false);
    setBreakEnded(false);
    setStartFocus(false); // Reset this so the dropdown appears again
  };

  const handleFinishSession = () => {
    const currentFocusTime = focusTime;
    const currentBreakTime = breakTime;

    // Reset all states first
    resetToInitialState();

    // Call the session completion handler
    handleSessionCompletion(currentFocusTime, currentBreakTime);
  };

  // Add state to track if we're in break selection mode
  const handleStartBreakFromNotification = () => {
    setShowBreakOptions(false);
    setStartBreak(true);
    setIsBreakRunning(true);
    setBreakStartTimestamp(Date.now());
  };

  const handleFinishSessionFromNotification = () => {
    const currentFocusTime = focusTime;
    const currentBreakTime = breakTime;

    resetToInitialState();
    handleSessionCompletion(currentFocusTime, currentBreakTime);
  };

  // Determine if we should show dropdowns or static text
  const showFocusDropdown = !startFocus && !focusEnded; // Only show dropdown when session hasn't started and hasn't ended
  const showBreakDropdown = !startBreak && !breakEnded && focusEnded; // Only show when break hasn't started but focus has ended

  return (
    <motion.div
      className="w-full flex flex-col timer-section" // Add class for scrolling
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-full h-full flex justify-around items-center">
        {/* Focus Time Display */}
        {startFocus && !focusEnded ? (
          // Show countdown timer during focus
          <motion.div
            className="text-5xl font-bold mt-5 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {formatTime(time)}
          </motion.div>
        ) : showFocusDropdown ? (
          // Show dropdown only when session hasn't started
          <motion.div
            className="mt-5 selectTime"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <label className="text-gray-300 font-medium">Focus Time: </label>
            <select
              value={focusTime}
              onChange={(e) => setFocusTime(Number(e.target.value))}
              className="text-white bg-gray-700/50 border border-gray-600/50 p-2 rounded-sm ml-2 focus:border-blue-500 focus:outline-none"
            >
              {[20, 25, 30, 35, 40, 45, 50].map((t) => (
                <option key={t} value={t} className="text-white bg-gray-800">
                  {t} min
                </option>
              ))}
            </select>
          </motion.div>
        ) : (
          // Show static text when focus has ended but session not finished
          <motion.div
            className="mt-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-gray-300 font-medium text-center">
              <span className="text-lg">Focus Time: </span>
              <span className="text-xl font-bold text-blue-400">
                {focusTime} min
              </span>
              <div className="text-sm text-gray-400 mt-1">
                Session completed! 🎉
              </div>
            </div>
          </motion.div>
        )}

        {/* Break Time Display */}
        {startBreak && !breakEnded ? (
          // Show countdown timer during break
          <motion.div
            className="text-5xl font-bold mt-5 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {formatTime(bTime)}
          </motion.div>
        ) : showBreakDropdown ? (
          // Show dropdown only when focus ended but break hasn't started
          <motion.div
            className="mt-3 selectTime"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <label className="text-gray-300 font-medium">Break Time: </label>
            <select
              value={breakTime}
              onChange={(e) => setBreakTime(Number(e.target.value))}
              className="text-white bg-gray-700/50 border border-gray-600/50 p-2 rounded-md ml-2 focus:border-purple-500 focus:outline-none"
            >
              {[0, 5, 10, 15, 20].map((t) => (
                <option key={t} value={t} className="text-white bg-gray-800">
                  {t} min
                </option>
              ))}
            </select>
          </motion.div>
        ) : focusEnded && !showBreakDropdown ? (
          // Show static text when break is running or session is being finished
          <motion.div
            className="mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-gray-300 font-medium text-center">
              <span className="text-lg">Break Time: </span>
              <span className="text-xl font-bold text-green-400">
                {breakTime} min
              </span>
              {startBreak && (
                <div className="text-sm text-gray-400 mt-1">
                  Break in progress... ☕
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          // Default break time display when not in focus ended state
          <motion.div
            className="mt-3 selectTime"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <label className="text-gray-300 font-medium">Break Time: </label>
            <select
              value={breakTime}
              onChange={(e) => setBreakTime(Number(e.target.value))}
              className="text-white bg-gray-700/50 border border-gray-600/50 p-2 rounded-md ml-2 focus:border-purple-500 focus:outline-none"
            >
              {[0, 5, 10, 15, 20].map((t) => (
                <option key={t} value={t} className="text-white bg-gray-800">
                  {t} min
                </option>
              ))}
            </select>
          </motion.div>
        )}
      </div>

      <div className="w-full flex justify-center gap-4 bg-gray-800/30 p-4 rounded-md mt-4">
        {/* Only show Start/Pause button when focus hasn't ended */}
        {!focusEnded && (
          <motion.button
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-2 rounded-lg font-medium transition-all duration-200"
            onClick={isRunning ? handlePause : handleStart}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isRunning ? "Pause" : "Start"}
          </motion.button>
        )}

        {focusEnded && (
          <motion.div
            className="flex gap-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.button
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
              onClick={() => {
                setStartBreak(true);
                setIsBreakRunning(!isBreakRunning);
                if (!isBreakRunning) {
                  setBreakStartTimestamp(
                    Date.now() - (breakTime * 60 - bTime) * 1000
                  );
                } else {
                  setBreakStartTimestamp(null);
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isBreakRunning ? "Pause Break" : "Start Break"}
            </motion.button>

            <motion.button
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
              onClick={handleFinishSession}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Finish Session
            </motion.button>
          </motion.div>
        )}

        <motion.button
          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-2 rounded-lg font-medium transition-all duration-200"
          onClick={handleReset}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Reset
        </motion.button>
      </div>
    </motion.div>
  );
};

export default TimerControls;
