"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { formatTime } from "../utils/timeUtils";

const TimerControls = ({ handleSessionCompletion }) => {
  const [startFocus, setStartFocus] = useState(false);
  const [focusTime, setFocusTime] = useState(25);
  const [focusEnded, setFocusEnded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(focusTime * 60);
  const [startBreak, setStartBreak] = useState(false);
  const [breakTime, setBreakTime] = useState(0);
  const [breakEnded, setBreakEnded] = useState(false);
  const [isBreakRunning, setIsBreakRunning] = useState(false);
  const [bTime, setBTime] = useState(breakTime * 60);
  const [startTimestamp, setStartTimestamp] = useState(null);

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
          clearInterval(timer);
          if (alarmSoundRef.current) alarmSoundRef.current.play();
        } else {
          setTime(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [isRunning, focusEnded, focusTime, startTimestamp]);

  useEffect(() => {
    let breakTimer;
    if (isBreakRunning) {
      breakTimer = setInterval(() => {
        setBTime((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(breakTimer);
            setStartBreak(false);

            setBreakEnded((prevBreakEnded) => {
              if (!prevBreakEnded) {
                setIsRunning(false);
                setIsBreakRunning(false);
                setFocusTime(25);
                setTime(focusTime * 60);
                setFocusEnded(false);
                setStartBreak(false);
                handleSessionCompletion(focusTime, breakTime);
                if (alarmSoundRef.current && !alarmSoundRef.current.paused) {
                  alarmSoundRef.current.pause();
                  alarmSoundRef.current.currentTime = 0;
                }
                if (alarmSoundRef.current) alarmSoundRef.current.play();
                return true;
              }
              return prevBreakEnded;
            });
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    return () => clearInterval(breakTimer);
  }, [isBreakRunning, handleSessionCompletion]);

  useEffect(() => {
    setTime(focusTime * 60);
  }, [focusTime]);

  useEffect(() => {
    setBTime(breakTime * 60);
  }, [breakTime]);

  const handleStart = () => {
    setStartFocus(true);
    setIsRunning(true);
    setStartTimestamp(Date.now());
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(focusTime * 60);
    setFocusEnded(false);
    setStartBreak(false);
    setStartTimestamp(null);
  };

  return (
    <div className="w-2/3 flex flex-col">
      <div className="w-full h-full flex justify-around items-center">
        {startFocus && !focusEnded ? (
          <motion.div className="text-5xl font-bold mt-5">
            {formatTime(time)}
          </motion.div>
        ) : (
          <div className="mt-5 selectTime">
            <label>Focus Time: </label>
            <select
              value={focusTime}
              onChange={(e) => setFocusTime(Number(e.target.value))}
              className="text-white bg-slate-50/40 p-2 rounded-md"
            >
              {[20, 25, 30].map((t) => (
                <option key={t} value={t} className="text-black">
                  {t} min
                </option>
              ))}
            </select>
          </div>
        )}
        {startBreak && !breakEnded ? (
          <motion.div className="text-5xl font-bold mt-5">
            {formatTime(bTime)}
          </motion.div>
        ) : (
          <div className="mt-3 selectTime">
            <label>Break Time: </label>
            <select
              value={breakTime}
              onChange={(e) => setBreakTime(Number(e.target.value))}
              className="text-white bg-slate-50/40 p-2 rounded-md"
            >
              {[0, 5, 10, 15].map((t) => (
                <option key={t} value={t} className="text-black">
                  {t} min
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="w-full flex justify-around bg-slate-100/15 p-4 rounded-md mt-4">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          onClick={isRunning ? handleReset : handleStart}
        >
          {isRunning ? "Pause" : "Start"}
        </button>

        {focusEnded && (
          <div>
            <button
              className="bg-orange-700 text-white px-4 py-2 rounded"
              onClick={() => {
                setStartBreak(true);
                setIsBreakRunning(!isBreakRunning);
              }}
            >
              {isBreakRunning ? "Pause Break" : "Start Break"}
            </button>
            <button
              className="bg-green-500 text-white px-4 py-2 rounded"
              onClick={() => {
                setIsRunning(false);
                setFocusTime(25);
                setTime(focusTime * 60);
                setStartFocus(false);
                setFocusEnded(false);
                handleSessionCompletion(focusTime, breakTime);
              }}
            >
              Finish Session
            </button>
          </div>
        )}
        <button
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default TimerControls;
