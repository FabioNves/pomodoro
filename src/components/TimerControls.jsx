"use client";

// The signed-in timer panel. The countdown itself lives in
// src/components/timer/TimerProvider.jsx, mounted once in the root layout,
// so this is only a view: the dashboard and the timer page both render it
// and both show the same running session.

import React from "react";
import TimerPanel from "./timer/TimerPanel";
import { useTimerControls, useTimerDisplay } from "@/components/timer/TimerProvider";

const TimerControls = ({ extra = null }) => {
  const { run, seconds, total, settings, sounds } = useTimerDisplay();
  const controls = useTimerControls();
  const onFocus = run.phase === "focus";

  return (
    <TimerPanel
      settings={settings}
      sounds={sounds}
      phase={run.phase}
      seconds={seconds}
      total={total}
      isRunning={onFocus && run.running}
      isBreakRunning={!onFocus && run.running}
      focusEnded={run.focusEnded}
      breakEnded={false}
      focusTime={run.focusMinutes}
      breakTime={run.breakMinutes}
      focusLocked={run.started || run.focusEnded}
      breakLocked={run.breakStarted}
      onFocusTime={controls.setFocusMinutes}
      onBreakTime={controls.setBreakMinutes}
      onStart={controls.start}
      onPause={controls.pause}
      onReset={controls.reset}
      onStartBreak={controls.startBreak}
      onPauseBreak={controls.pauseBreak}
      onFinish={controls.finish}
      finishLabel="Finish session"
      extra={extra}
    />
  );
};

export default TimerControls;
