"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import TimerPanel from "./timer/TimerPanel";
import { useTimerSettings } from "@/hooks/useTimerSettings";
import { createSoundKit } from "@/utils/sounds";

// Signed-in timer: focus → (break) → session saved through handleSessionCompletion.
const TimerControls = ({ handleSessionCompletion, showNotification, extra = null }) => {
  const { settings, ready } = useTimerSettings();
  const sounds = useMemo(() => createSoundKit(settings), [settings]);
  const soundsRef = useRef(sounds);
  useEffect(() => {
    soundsRef.current = sounds;
  }, [sounds]);

  const [startFocus, setStartFocus] = useState(false);
  const [focusTime, setFocusTime] = useState(settings.defaultFocus);
  const [focusEnded, setFocusEnded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(settings.defaultFocus * 60);
  const [startBreak, setStartBreak] = useState(false);
  const [breakTime, setBreakTime] = useState(settings.defaultBreak);
  const [breakEnded, setBreakEnded] = useState(false);
  const [isBreakRunning, setIsBreakRunning] = useState(false);
  const [bTime, setBTime] = useState(settings.defaultBreak * 60);
  const [startTimestamp, setStartTimestamp] = useState(null);
  const [breakStartTimestamp, setBreakStartTimestamp] = useState(null);
  const appliedDefaultsRef = useRef(false);

  // Apply the saved defaults once they are read from storage (before a session starts).
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
          setFocusEnded(true);
          clearInterval(timer);

          // Play the alarm first so a notification problem can't prevent it
          soundsRef.current.alarm();

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
                document
                  .querySelector(".timer-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              },
            });
          }
        } else {
          setTime(remaining);
          if (remaining <= 10) soundsRef.current.tick();
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, focusEnded, focusTime, startTimestamp, showNotification, breakTime]);

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
          // Complete reset after break ends, then save the session
          resetToInitialState();
          handleSessionCompletion(focusTime, breakTime);
          soundsRef.current.stopAlarm();
          soundsRef.current.alarm();
        } else {
          setBTime(remaining);
          if (remaining <= 10) soundsRef.current.tick();
        }
      }, 1000);
    }
    return () => clearInterval(breakTimer);
  }, [isBreakRunning, breakEnded, breakTime, breakStartTimestamp, handleSessionCompletion, focusTime]);

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

  const resetToInitialState = () => {
    setStartFocus(false);
    setFocusEnded(false);
    setIsRunning(false);
    setStartBreak(false);
    setBreakEnded(false);
    setIsBreakRunning(false);
    setStartTimestamp(null);
    setBreakStartTimestamp(null);
    setFocusTime(settings.defaultFocus);
    // breakTime is kept so the preferred break length persists across sessions
  };

  const handleStart = () => {
    sounds.start();
    setStartFocus(true);
    setIsRunning(true);
    setStartTimestamp(Date.now() - (focusTime * 60 - time) * 1000); // resume from paused time
  };

  const handlePause = () => {
    sounds.pause();
    setIsRunning(false);
    setStartTimestamp(null);
  };

  const handleReset = () => {
    sounds.click();
    sounds.stopAlarm();
    setIsRunning(false);
    setTime(focusTime * 60);
    setFocusEnded(false);
    setStartBreak(false);
    setStartTimestamp(null);
    setBreakStartTimestamp(null);
    setIsBreakRunning(false);
    setBreakEnded(false);
    setStartFocus(false);
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

  const handleFinishSession = () => {
    sounds.click();
    sounds.stopAlarm();
    const currentFocusTime = focusTime;
    const currentBreakTime = breakTime;
    resetToInitialState();
    handleSessionCompletion(currentFocusTime, currentBreakTime);
  };

  const handleStartBreakFromNotification = () => {
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
      onReset={handleReset}
      onStartBreak={handleStartBreak}
      onPauseBreak={handlePauseBreak}
      onFinish={handleFinishSession}
      finishLabel="Finish session"
      extra={extra}
    />
  );
};

export default TimerControls;
