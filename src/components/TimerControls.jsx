"use client";

// The signed-in timer panel. The countdown itself lives in
// src/components/timer/TimerProvider.jsx, mounted once in the root layout,
// so this is only a view: the dashboard and the timer page both render it
// and both show the same running session.

import React from "react";
import TimerPanel from "./timer/TimerPanel";
import { useTimerControls, useTimerDisplay } from "@/components/timer/TimerProvider";

const TimerControls = ({ extra = null, quick = false }) => {
  const { run, seconds, total, settings, sounds, active } = useTimerDisplay();
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
      showReset={!quick}
      extra={quick ? (
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={controls.restart} disabled={!active} className="px-4 py-2 rounded-full border border-edge text-sm text-fg hover:bg-surface-hover disabled:opacity-40" aria-label="Restart timer">Restart</button>
          <button type="button" onClick={controls.reset} disabled={!active} className="px-4 py-2 rounded-full border border-edge text-sm text-danger hover:bg-danger-soft disabled:opacity-40" aria-label="Stop timer">Stop</button>
        </div>
      ) : extra}
    />
  );
};

export default TimerControls;
