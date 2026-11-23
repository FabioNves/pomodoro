"use client";

// The signed-in timer panel. The countdown itself lives in
// src/components/timer/TimerProvider.jsx, mounted once in the root layout,
// so this is only a view: the dashboard, the timer page and the navbar timer
// all render it and all show the same running session.
//
// `session` adds the "working on" picker: true loads the projects itself
// (the navbar timer), an object passes lists the screen already has
// ({ projects, tasks, routineTasks }), false leaves it out (the timer page,
// which has its own task lists).

import React, { useCallback } from "react";
import TimerPanel from "./timer/TimerPanel";
import SessionPicker from "./timer/SessionPicker";
import { useTimerControls, useTimerDisplay } from "@/components/timer/TimerProvider";

const TimerControls = ({ extra = null, quick = false, session = false }) => {
  const { run, seconds, total, settings, sounds } = useTimerDisplay();
  const controls = useTimerControls();
  const onFocus = run.phase === "focus";
  const lists = session && typeof session === "object" ? session : {};

  const renderSession = useCallback(
    ({ align, grow }) => (
      <SessionPicker
        align={align}
        grow={grow}
        projects={lists.projects}
        tasks={lists.tasks}
        routineTasks={lists.routineTasks}
      />
    ),
    [lists.projects, lists.tasks, lists.routineTasks],
  );

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
      onRestart={quick ? controls.restart : undefined}
      onStartBreak={controls.startBreak}
      onPauseBreak={controls.pauseBreak}
      onFinish={controls.finish}
      finishLabel="Finish session"
      renderSession={session ? renderSession : null}
      extra={extra}
    />
  );
};

export default TimerControls;
