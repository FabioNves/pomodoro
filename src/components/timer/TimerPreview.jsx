"use client";

// Live sample of the clock for the Settings page: a fake countdown that
// keeps ticking so the chosen format and style can be judged in motion.

import React, { useEffect, useState } from "react";
import TimerFace from "./TimerFace";

const TOTAL = 25 * 60;
const START = TOTAL - 61; // 23:59 → shows minutes and seconds changing

export default function TimerPreview({ format, style }) {
  const [seconds, setSeconds] = useState(START);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => (s <= START - 45 ? START : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-2 py-3"
      data-timer-preview
      aria-label="Clock preview"
    >
      <TimerFace
        seconds={seconds}
        total={TOTAL}
        mode="focus"
        running
        format={format}
        style={style}
        updateTitle={false}
      />
      <p className="text-[11px] text-fg-subtle">Preview</p>
    </div>
  );
}
