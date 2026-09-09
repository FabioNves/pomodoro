// Timer sound design. Small synthesised cues via the Web Audio API (no
// assets, no dependency) plus the original alarm mp3 as one of the alarm
// options. Everything honours the user's timer settings (enabled, volume).

let ctx = null;
let alarmEl = null;

function getContext() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Call from a user gesture (a click) so later cues are allowed to play. */
export function unlockAudio() {
  const c = getContext();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

// One oscillator note with an exponential decay envelope.
function note({
  freq,
  type = "sine",
  start = 0,
  duration = 0.12,
  gain = 0.2,
  detune = 0,
  attack = 0.005,
}) {
  const c = getContext();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (detune) osc.detune.setValueAtTime(detune, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// Filtered noise burst — the "tick".
function tickNoise({ start = 0, duration = 0.03, gain = 0.08 }) {
  const c = getContext();
  if (!c) return;
  const t0 = c.currentTime + start;
  const frames = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2200;
  filter.Q.value = 6;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
}

const cues = {
  click: (v) => note({ freq: 1800, duration: 0.05, gain: 0.12 * v }),
  tick: (v) => tickNoise({ gain: 0.1 * v }),
  start: (v) => {
    note({ freq: 523.25, duration: 0.14, gain: 0.18 * v });
    note({ freq: 783.99, start: 0.1, duration: 0.22, gain: 0.18 * v });
  },
  pause: (v) => {
    note({ freq: 659.25, duration: 0.12, gain: 0.16 * v });
    note({ freq: 440, start: 0.1, duration: 0.2, gain: 0.16 * v });
  },
  breakStart: (v) => {
    note({ freq: 440, type: "triangle", duration: 0.16, gain: 0.16 * v });
    note({ freq: 554.37, type: "triangle", start: 0.12, duration: 0.16, gain: 0.16 * v });
    note({ freq: 659.25, type: "triangle", start: 0.24, duration: 0.3, gain: 0.16 * v });
  },
  chime: (v) => {
    const notes = [659.25, 880, 1318.5];
    for (let r = 0; r < 2; r++) {
      notes.forEach((f, i) => {
        const s = r * 1.1 + i * 0.22;
        note({ freq: f, duration: 1.1, gain: 0.22 * v, start: s });
        note({ freq: f, type: "triangle", duration: 0.9, gain: 0.08 * v, start: s, detune: 6 });
      });
    }
  },
  digital: (v) => {
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 4; i++) {
        note({
          freq: 880,
          type: "square",
          start: r * 1.2 + i * 0.2,
          duration: 0.11,
          gain: 0.12 * v,
          attack: 0.002,
        });
      }
    }
  },
};

function playMp3(volume) {
  if (typeof window === "undefined") return;
  try {
    if (!alarmEl) alarmEl = new Audio("/futuristic_alarm.mp3");
    alarmEl.pause();
    alarmEl.currentTime = 0;
    alarmEl.volume = volume;
    alarmEl.play().catch(() => {});
  } catch {}
}

export function stopAlarm() {
  if (alarmEl && !alarmEl.paused) {
    alarmEl.pause();
    alarmEl.currentTime = 0;
  }
}

/**
 * Build the sound functions for a given settings object. The functions are
 * safe to call anywhere; they no-op when sound is off.
 */
export function createSoundKit(settings) {
  const on = !!settings?.soundEnabled;
  const v = Math.max(0, Math.min(1, Number(settings?.volume ?? 0.6)));
  const ui = on && !!settings?.uiSounds && v > 0;
  const play = (fn) => {
    try {
      unlockAudio();
      fn(v);
    } catch {}
  };
  return {
    unlock: unlockAudio,
    click: () => (ui ? play(cues.click) : null),
    start: () => (ui ? play(cues.start) : null),
    pause: () => (ui ? play(cues.pause) : null),
    breakStart: () => (ui ? play(cues.breakStart) : null),
    tick: () => (on && settings?.tickSound && v > 0 ? play(cues.tick) : null),
    /** Alarm for the end of a focus/break block. `kind` overrides the setting (previews). */
    alarm: (kind = settings?.alarmSound) => {
      if (!on || v <= 0) return;
      if (kind === "none") return;
      if (kind === "futuristic") return playMp3(v);
      if (cues[kind]) play(cues[kind]);
    },
    stopAlarm,
  };
}
