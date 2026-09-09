"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import TimerPanel from "../timer/TimerPanel";
import { useTimerSettings } from "@/hooks/useTimerSettings";
import { createSoundKit } from "@/utils/sounds";

// Guest timer on the landing page: same face and controls, nothing is saved.
const PublicTimerControls = ({ showNotification }) => {
  const { settings, ready } = useTimerSettings();
  const sounds = useMemo(() => createSoundKit(settings), [settings]);
  const soundsRef = useRef(sounds);
  useEffect(() => {
    soundsRef.current = sounds;
  }, [sounds]);

  const [startFocus, setStartFocus] = useState(false);
  const [focusTime, setFocusTime] = useState(settings.defaultFocus);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(settings.defaultFocus * 60);
  const [breakTime, setBreakTime] = useState(settings.defaultBreak);
  const [bTime, setBTime] = useState(settings.defaultBreak * 60);
  const [startBreak, setStartBreak] = useState(false);
  const [isBreakRunning, setIsBreakRunning] = useState(false);
  const [focusEnded, setFocusEnded] = useState(false);
  const [breakEnded, setBreakEnded] = useState(false);
  const [startTimestamp, setStartTimestamp] = useState(null);
  const [breakStartTimestamp, setBreakStartTimestamp] = useState(null);
  const appliedDefaultsRef = useRef(false);

  useEffect(() => {
    if (!ready || appliedDefaultsRef.current) return;
    appliedDefaultsRef.current = true;
    if (!startFocus && !focusEnded) {
      setFocusTime(settings.defaultFocus);
      setBreakTime(settings.defaultBreak);
    }
  }, [ready, settings.defaultFocus, settings.defaultBreak, startFocus, focusEnded]);

  // Focus countdown
  useEffect(() => {
    let timer;
    if (isRunning && !focusEnded) {
      if (!startTimestamp) setStartTimestamp(Date.now());
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
        const remaining = focusTime * 60 - elapsed;
        if (remaining <= 0) {
          setTime(0);
          setIsRunning(false);
          setFocusEnded(true);
          clearInterval(timer);
          soundsRef.current.alarm();
          if (showNotification) {
            showNotification("🎉 Focus Session Complete!", {
              body: `Excellent! You completed ${focusTime} minutes of focused work. Sign in to track your progress!`,
              icon: "/favicon.ico",
            });
          }
        } else {
          setTime(remaining);
          if (remaining <= 10) soundsRef.current.tick();
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, focusEnded, focusTime, startTimestamp, showNotification]);

  // Break countdown
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
          if (showNotification) {
            showNotification("☕ Break Complete!", {
              body: `Your ${breakTime} minute break is over. Ready for another focused session?`,
              icon: "/favicon.ico",
            });
          }
          soundsRef.current.stopAlarm();
          soundsRef.current.alarm();
          handleReset(false);
        } else {
          setBTime(remaining);
          if (remaining <= 10) soundsRef.current.tick();
        }
      }, 1000);
    }
    return () => clearInterval(breakTimer);
  }, [isBreakRunning, breakEnded, breakTime, breakStartTimestamp, showNotification]);

  // Auto-start the break when the setting is on
  useEffect(() => {
    if (!focusEnded || startBreak || !settings.autoStartBreak || breakTime <= 0)
      return;
    setStartBreak(true);
    setIsBreakRunning(true);
    setBreakStartTimestamp(Date.now());
    soundsRef.current.breakStart();
  }, [focusEnded, startBreak, settings.autoStartBreak, breakTime]);

  useEffect(() => {
    if (!startFocus && !focusEnded) setTime(focusTime * 60);
  }, [focusTime, startFocus, focusEnded]);

  useEffect(() => {
    if (!startBreak && !breakEnded) setBTime(breakTime * 60);
  }, [breakTime, startBreak, breakEnded]);

  const handleStart = () => {
    sounds.start();
    setStartFocus(true);
    setIsRunning(true);
    setStartTimestamp(Date.now() - (focusTime * 60 - time) * 1000);
  };

  const handlePause = () => {
    sounds.pause();
    setIsRunning(false);
    setStartTimestamp(null);
  };

  const handleReset = (withSound = true) => {
    if (withSound) sounds.click();
    sounds.stopAlarm();
    setIsRunning(false);
    setIsBreakRunning(false);
    setStartFocus(false);
    setStartBreak(false);
    setFocusEnded(false);
    setBreakEnded(false);
    setStartTimestamp(null);
    setBreakStartTimestamp(null);
    setTime(focusTime * 60);
    setBTime(breakTime * 60);
  };

  const handleStartBreak = () => {
    sounds.breakStart();
    sounds.stopAlarm();
    setStartBreak(true);
    setIsBreakRunning(true);
    setBreakStartTimestamp(Date.now() - (breakTime * 60 - bTime) * 1000);
  };

  const handlePauseBreak = () => {
    sounds.pause();
    setIsBreakRunning(false);
    setBreakStartTimestamp(null);
  };

  return (
    <TimerPanel
      settings={settings}
      sounds={sounds}
      phase={focusEnded ? "break" : "focus"}
      seconds={focusEnded ? bTime : time}
      total={focusEnded ? breakTime * 60 : focusTime * 60}
      isRunning={isRunning}
      isBreakRunning={isBreakRunning}
      focusEnded={focusEnded}
      breakEnded={breakEnded}
      focusTime={focusTime}
      breakTime={breakTime}
      focusLocked={startFocus || focusEnded}
      breakLocked={startBreak || breakEnded}
      onFocusTime={setFocusTime}
      onBreakTime={setBreakTime}
      onStart={handleStart}
      onPause={handlePause}
      onReset={() => handleReset(true)}
      onStartBreak={handleStartBreak}
      onPauseBreak={handlePauseBreak}
      onFinish={() => handleReset(true)}
      finishLabel="New session"
      extra={
        <motion.div
          className="mt-1 px-3 py-2 bg-primary-soft border border-primary/30 rounded-lg text-center transition-colors duration-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <p className="text-primary text-xs">
            💡 <strong>Guest mode:</strong> the timer works fully but sessions
            aren&apos;t saved. Sign in above to track your productivity.
          </p>
        </motion.div>
      }
    />
  );
};

export default PublicTimerControls;
