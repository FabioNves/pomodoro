// Shared by the desktop AI, voice routing and the capabilities list. No model
// output can supply a URL: navigation always resolves through this catalogue.
const DRAGON_PAGES = [
  { id: 'home', label: 'Home', path: '/', aliases: ['home', 'home page', 'welcome'] },
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', aliases: ['dashboard', 'overview'] },
  { id: 'timer', label: 'Timer', path: '/timer', aliases: ['timer', 'focus timer', 'pomodrive', 'pomo drive'], feature: 'timer' },
  { id: 'planner', label: 'Planner', path: '/planner', aliases: ['planner', 'plan'], feature: 'planner' },
  { id: 'tasks', label: 'Tasks & projects', path: '/planner?tab=tasks', aliases: ['tasks', 'projects', 'task board', 'project board'], feature: 'planner' },
  { id: 'calendar', label: 'Calendar', path: '/planner?tab=calendar', aliases: ['calendar'], feature: 'planner' },
  { id: 'schedule', label: 'Schedule', path: '/planner?tab=schedule', aliases: ['schedule', 'week plan', 'weekly schedule'], feature: 'planner' },
  { id: 'habits', label: 'Habits', path: '/planner?tab=routines&view=habits', aliases: ['habits', 'habit tracker'], feature: 'habits' },
  { id: 'cycles', label: 'Cycles', path: '/planner?tab=routines&view=cycles', aliases: ['cycles', 'routines', 'recurring tasks'], feature: 'routines' },
  { id: 'notebook', label: 'Notebook', path: '/notebook', aliases: ['notebook', 'notes'], feature: 'notebook' },
  { id: 'brain', label: 'Brain', path: '/notebook?view=brain', aliases: ['brain', 'brain graph'], feature: 'notebook' },
  { id: 'quotes', label: 'Quotes', path: '/notebook?view=quotes', aliases: ['quotes', 'saved quotes'], feature: 'notebook' },
  { id: 'posts', label: 'Saved posts', path: '/notebook?view=posts', aliases: ['posts', 'saved posts'], feature: 'notebook' },
  { id: 'business', label: 'Business', path: '/business', aliases: ['business'], feature: 'business' },
  { id: 'analytics', label: 'Analytics', path: '/analytics', aliases: ['analytics', 'statistics', 'stats'], feature: 'analytics' },
  { id: 'news', label: 'News', path: '/news', aliases: ['news', 'briefing', 'news briefing'], feature: 'news_briefing' },
  { id: 'pricing', label: 'Plans & pricing', path: '/pricing', aliases: ['pricing', 'plans', 'plans and pricing', 'subscription'] },
  { id: 'settings', label: 'Settings', path: '/settings', aliases: ['settings', 'preferences'] },
  { id: 'admin', label: 'Admin', path: '/admin', aliases: ['admin', 'administration'], admin: true },
];
function normalizeSpeech(text) {
  return String(text).toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}
function requestWords(text) {
  let value = normalizeSpeech(text).replace(/^(?:hey )?dragon /, '').replace(/ (?:please|now)$/, '');
  // Remove polite request prefixes, without treating advice/questions as orders.
  for (let i = 0; i < 3; i++) value = value.replace(/^(?:please|can you|could you|would you|will you|can we|could we|id like to|i would like to|i want to|lets|let us) /, '');
  return value;
}
function explicitActionRequest(text) {
  const value = requestWords(text);
  if (/\b(?:dont|not|never|without)\b/.test(value)) return false;
  return /^(?:open|show|go|take me|navigate|switch|bring|head|visit|start|resume|pause|take a break|stop listening|sleep|goodbye|minimize|collapse)\b/.test(value);
}
function navigationCommand(text) {
  const value = requestWords(text);
  const match = value.match(/^(?:open|show(?: me)?|go(?: back)? to|take me to|navigate to|switch to|bring up|bring me to|head to|visit) (.+)$/);
  if (!match) return null;
  const target = match[1].replace(/^(?:the |my )+/, '').replace(/ (?:page|screen|section)$/, '');
  const page = DRAGON_PAGES.find(page => page.aliases.includes(target));
  return page ? { action: 'navigate', page: page.id, path: page.path, reply: `Opened ${page.label}.`, spoken: false } : null;
}
function pageAllowed(page, access) {
  return !(page.admin && (!access.isAdmin || access.previewing)) && !(page.feature && access.hidden(page.feature));
}
function availableDragonPages(access) { return DRAGON_PAGES.filter(page => pageAllowed(page, access)); }
module.exports = { DRAGON_PAGES, normalizeSpeech, requestWords, explicitActionRequest, navigationCommand, pageAllowed, availableDragonPages };
