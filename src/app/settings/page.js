"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/hooks/useTheme";
import { useTimerSettings } from "@/hooks/useTimerSettings";
import { createSoundKit } from "@/utils/sounds";
import TimerPreview from "@/components/timer/TimerPreview";
import {
  ALARM_SOUNDS,
  TIMER_FORMATS,
  FACE_STYLES,
  formatTimer,
} from "@/lib/timerSettings";

/** On/off switch drawn with the theme tokens. */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${
        checked ? "bg-primary border-primary" : "bg-edge border-edge"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${
          checked ? "translate-x-5 bg-primary-fg" : "bg-surface"
        }`}
      />
    </button>
  );
}

function SettingRow({ title, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-sm text-fg">{title}</p>
        {hint ? <p className="text-xs text-fg-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Radio-card group used for alarm, clock format and face style. */
function OptionCards({ name, options, value, onChange, renderPreview, columns = "grid-cols-2 sm:grid-cols-4" }) {
  return (
    <div className={`grid ${columns} gap-2`} role="radiogroup" aria-label={name}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`text-left p-2.5 rounded-lg border transition-colors ${
              active
                ? "border-primary bg-primary-soft"
                : "border-edge bg-surface hover:border-edge-strong"
            }`}
          >
            {renderPreview ? renderPreview(o, active) : null}
            <p className="text-sm font-semibold text-fg">{o.name}</p>
            {o.hint ? <p className="text-[11px] text-fg-subtle">{o.hint}</p> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Star used to mark the preferred theme: filled when chosen, outline otherwise. */
function StarIcon({ filled, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.87l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85L12 3.6z" />
    </svg>
  );
}

/** Miniature app mock-up painted with a theme's preview colors. */
function ThemePreview({ preview }) {
  return (
    <div
      className="w-full h-20 rounded-lg overflow-hidden border border-edge"
      style={{ backgroundColor: preview.bg }}
      aria-hidden="true"
    >
      <div className="h-full p-2 flex flex-col gap-1.5">
        <div
          className="h-3 w-full rounded-sm"
          style={{ backgroundColor: preview.surface }}
        />
        <div className="flex-1 flex gap-1.5">
          <div
            className="flex-1 rounded-sm flex items-end p-1"
            style={{ backgroundColor: preview.surface }}
          >
            <span
              className="h-2 w-8 rounded-sm"
              style={{ backgroundColor: preview.primary }}
            />
          </div>
          <div
            className="w-8 rounded-sm flex items-start justify-end p-1"
            style={{ backgroundColor: preview.surface }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: preview.accent }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme, themes } = useTheme();
  const { settings: timer, update: updateTimer, reset: resetTimer } =
    useTimerSettings();
  // Previews always play, at the chosen volume, even while sound is off.
  const previewKit = useMemo(
    () => createSoundKit({ ...timer, soundEnabled: true, uiSounds: true }),
    [timer],
  );
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token && token.split(".").length === 3) {
        try {
          const decodedUser = jwtDecode(token);
          setUser(decodedUser);
        } catch (error) {
          console.error("Error decoding token:", error);
          localStorage.removeItem("accessToken");
          router.push("/");
        }
      } else {
        router.push("/");
      }
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    setUser(null);
    router.push("/");
  };

  if (!hasMounted) {
    return null;
  }

  const currentTheme = themes.find((t) => t.id === theme) || themes[0];

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="container mx-auto px-4 pb-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">
          Settings
        </h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-success-soft border border-success/40 rounded-lg text-success transition-colors duration-300">
            {successMessage}
          </div>
        )}

        {/* Theme Preferences Section */}
        <div className="bg-surface rounded-lg p-6 border border-edge mb-6 transition-colors duration-300 shadow-md">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-fg">
            <svg
              className="w-6 h-6 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            Theme Preferences
          </h2>

          <div className="space-y-4">
            <div className="bg-surface-2 p-4 rounded-lg transition-colors duration-300">
              <h3 className="font-medium text-lg mb-2 text-fg">Appearance</h3>
              <p className="text-fg-muted text-sm mb-4 transition-colors duration-300">
                Star the look you like best. Your preferred theme is saved on
                this device and applied everywhere in the app.
              </p>

              <div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
                role="radiogroup"
                aria-label="Theme"
              >
                {themes.map((t) => {
                  const active = t.id === theme;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTheme(t.id)}
                      title={
                        active
                          ? `${t.name} is your preferred theme`
                          : `Make ${t.name} your preferred theme`
                      }
                      className={`group text-left p-2.5 rounded-xl border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-focus/40 ${
                        active
                          ? "border-primary bg-primary-soft"
                          : "border-edge hover:border-edge-strong bg-surface"
                      }`}
                    >
                      <ThemePreview preview={t.preview} />
                      <div className="mt-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-fg truncate">
                            {t.name}
                          </p>
                          <span
                            className={`shrink-0 transition-colors duration-200 ${
                              active
                                ? "text-accent"
                                : "text-fg-subtle group-hover:text-accent"
                            }`}
                          >
                            <StarIcon filled={active} className="w-5 h-5" />
                          </span>
                        </div>
                        <p className="text-[11px] text-fg-subtle truncate">
                          {t.tagline}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-fg-muted">
                <StarIcon filled className="w-4 h-4 text-accent shrink-0" />
                <span>
                  Preferred theme:{" "}
                  <strong className="text-fg">{currentTheme.name}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Timer Section */}
        <div className="bg-surface rounded-lg p-6 border border-edge mb-6 transition-colors duration-300 shadow-md">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2 text-fg">
              <svg
                className="w-6 h-6 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2.5M12 5V3M10 3h4" />
              </svg>
              Timer
            </h2>
            <button
              type="button"
              onClick={resetTimer}
              className="text-xs text-fg-subtle hover:text-danger transition-colors"
            >
              Reset to defaults
            </button>
          </div>

          <div className="space-y-4">
            {/* Sound */}
            <div className="bg-surface-2 p-4 rounded-lg space-y-4 transition-colors duration-300">
              <SettingRow
                title="Sound"
                hint="Alarm when a block ends, plus soft cues for start, pause and clicks."
              >
                <Toggle
                  checked={timer.soundEnabled}
                  onChange={(v) => updateTimer({ soundEnabled: v })}
                  label="Sound"
                />
              </SettingRow>

              <div
                className={`space-y-4 transition-opacity ${
                  timer.soundEnabled ? "" : "opacity-50 pointer-events-none"
                }`}
                aria-disabled={!timer.soundEnabled}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-fg-muted mb-1">
                    <span>Volume</span>
                    <span className="tabular-nums">
                      {Math.round(timer.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(timer.volume * 100)}
                    onChange={(e) =>
                      updateTimer({ volume: Number(e.target.value) / 100 })
                    }
                    onMouseUp={() => previewKit.click()}
                    onTouchEnd={() => previewKit.click()}
                    className="w-full accent-primary"
                    aria-label="Volume"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-fg">Alarm</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => previewKit.alarm(timer.alarmSound)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-edge text-primary hover:bg-primary-soft transition-colors"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => previewKit.stopAlarm()}
                        className="text-xs px-2.5 py-1 rounded-lg border border-edge text-fg-subtle hover:text-fg transition-colors"
                      >
                        Stop
                      </button>
                    </div>
                  </div>
                  <OptionCards
                    name="Alarm sound"
                    options={ALARM_SOUNDS}
                    value={timer.alarmSound}
                    onChange={(id) => {
                      updateTimer({ alarmSound: id });
                      previewKit.alarm(id);
                    }}
                  />
                </div>

                <SettingRow
                  title="Interface cues"
                  hint="Short tones on start, pause and button clicks."
                >
                  <Toggle
                    checked={timer.uiSounds}
                    onChange={(v) => {
                      updateTimer({ uiSounds: v });
                      if (v) previewKit.start();
                    }}
                    label="Interface cues"
                  />
                </SettingRow>
                <SettingRow
                  title="Countdown ticks"
                  hint="A soft tick during the last ten seconds."
                >
                  <Toggle
                    checked={timer.tickSound}
                    onChange={(v) => {
                      updateTimer({ tickSound: v });
                      if (v) previewKit.tick();
                    }}
                    label="Countdown ticks"
                  />
                </SettingRow>
              </div>
            </div>

            {/* Clock */}
            <div className="bg-surface-2 p-4 rounded-lg space-y-4 transition-colors duration-300">
              <div className="rounded-xl bg-surface border border-edge">
                <TimerPreview
                  format={timer.timerFormat}
                  style={timer.faceStyle}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-fg mb-2">Clock format</p>
                <OptionCards
                  name="Clock format"
                  options={TIMER_FORMATS}
                  value={timer.timerFormat}
                  onChange={(id) => updateTimer({ timerFormat: id })}
                  columns="grid-cols-3"
                  renderPreview={(o) => (
                    <p className="text-xl font-bold tabular-nums text-fg mb-1">
                      {formatTimer(1499, o.id)}
                    </p>
                  )}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-fg mb-2">Clock style</p>
                <OptionCards
                  name="Clock style"
                  options={FACE_STYLES}
                  value={timer.faceStyle}
                  onChange={(id) => updateTimer({ faceStyle: id })}
                  columns="grid-cols-3"
                />
              </div>
            </div>

            {/* Defaults */}
            <div className="bg-surface-2 p-4 rounded-lg space-y-4 transition-colors duration-300">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between gap-3 text-sm text-fg">
                  <span>
                    Default focus
                    <span className="block text-xs text-fg-muted">minutes</span>
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={timer.defaultFocus}
                    onChange={(e) =>
                      updateTimer({ defaultFocus: Number(e.target.value) })
                    }
                    className="w-20 px-2 py-1.5 rounded-lg bg-surface border border-edge text-sm text-fg text-right tabular-nums focus:border-focus outline-none"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm text-fg">
                  <span>
                    Default break
                    <span className="block text-xs text-fg-muted">minutes</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={timer.defaultBreak}
                    onChange={(e) =>
                      updateTimer({ defaultBreak: Number(e.target.value) })
                    }
                    className="w-20 px-2 py-1.5 rounded-lg bg-surface border border-edge text-sm text-fg text-right tabular-nums focus:border-focus outline-none"
                  />
                </label>
              </div>
              <SettingRow
                title="Start breaks automatically"
                hint="Begin the break as soon as a focus block ends."
              >
                <Toggle
                  checked={timer.autoStartBreak}
                  onChange={(v) => updateTimer({ autoStartBreak: v })}
                  label="Start breaks automatically"
                />
              </SettingRow>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-surface rounded-lg p-6 border border-edge transition-colors duration-300 shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-fg">Account</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg transition-colors duration-300">
              <div>
                <p className="font-medium text-fg">{user?.name}</p>
                <p className="text-sm text-fg-muted transition-colors duration-300">
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="bg-danger hover:bg-danger-hover text-white px-6 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
