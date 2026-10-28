import { DRAGON_PAGES, requestWords, explicitActionRequest, navigationCommand } from './dragonActions.cjs';

export const DRAGON_KEY = 'pomodrive.dragon.v1';
export const DRAGON_EVENT = 'pomodrive-dragon-settings';
export const DEFAULT_DRAGON = Object.freeze({
  enabled: true, aiEnabled: true, greetOnLaunch: true, greeting: 'Welcome back.',
  followUp: 'Do you need anything?',
  voice: '', volume: 70, rate: 0, timeout: 60, color: '#45e6cb', motion: true,
});
export function normalizeDragon(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const text = (key, max) => typeof input[key] === 'string' ? input[key].slice(0, max) : DEFAULT_DRAGON[key];
  const number = (key, min, max) => Number.isFinite(Number(input[key])) ? Math.max(min, Math.min(max, Number(input[key]))) : DEFAULT_DRAGON[key];
  const bool = key => typeof input[key] === 'boolean' ? input[key] : DEFAULT_DRAGON[key];
  return {
    enabled: bool('enabled'), aiEnabled: bool('aiEnabled'), greetOnLaunch: bool('greetOnLaunch'), motion: bool('motion'),
    greeting: text('greeting', 200), followUp: text('followUp', 350), voice: text('voice', 150),
    volume: number('volume', 0, 100), rate: number('rate', -5, 5), timeout: number('timeout', 15, 180),
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : DEFAULT_DRAGON.color,
  };
}
export function loadDragon() {
  try { return normalizeDragon(JSON.parse(localStorage.getItem(DRAGON_KEY)) || {}); }
  catch { return { ...DEFAULT_DRAGON }; }
}
export function saveDragon(patch) {
  const settings = normalizeDragon({ ...loadDragon(), ...patch });
  localStorage.setItem(DRAGON_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(DRAGON_EVENT, { detail: settings }));
  return settings;
}

// Deliberately explicit. Speech never becomes shell commands or arbitrary URLs.
export function dragonCommand(text) {
  const value = requestWords(text);
  if (['stop listening', 'go to sleep', 'goodbye', 'sleep', 'stop talking', 'minimize', 'minimize dragon', 'collapse', 'collapse dragon'].includes(value)) return { action: 'sleep' };
  if (['start timer', 'start the timer', 'start my timer', 'start focus', 'start a focus session', 'resume timer', 'resume the timer', 'resume my timer'].includes(value)) return { action: 'start', reply: 'Focus timer started.', spoken: false };
  if (['pause timer', 'pause the timer', 'pause my timer', 'pause focus'].includes(value)) return { action: 'pause', reply: 'Timer paused.', spoken: false };
  if (['start break', 'start a break', 'take a break'].includes(value)) return { action: 'break', reply: 'Break started.', spoken: false };
  const navigation = navigationCommand(text);
  if (navigation) return navigation;
  if (['help', 'what can you do', 'i need help'].includes(value)) return { action: 'help', reply: 'I can control your timer, open app pages, and chat. My capabilities are listed in Settings.' };
  if (['hello', 'hi', 'hey'].includes(value)) return { action: 'help', reply: 'Hello. How can I help? Say help to hear my commands.' };
  return null;
}

export function planDragonReply(answer, request) {
  if (answer.action !== 'none' && explicitActionRequest(request)) {
    if (answer.action === 'navigate') {
      const page = DRAGON_PAGES.find(page => page.id === answer.page);
      if (page) return { action: 'navigate', page: page.id, path: page.path, reply: `Opened ${page.label}.`, spoken: false };
    }
    if (['start', 'pause', 'break', 'sleep'].includes(answer.action)) return {
      action: answer.action, reply: { start: 'Focus timer started.', pause: 'Timer paused.', break: 'Break started.', sleep: '' }[answer.action], spoken: false,
    };
  }
  return { action: 'none', reply: answer.action === 'none' ? answer.reply : 'I can help with focus, timers, and finding your way around the app.' };
}
