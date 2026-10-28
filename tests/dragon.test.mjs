import test from 'node:test';
import assert from 'node:assert/strict';
import { dragonCommand, normalizeDragon, planDragonReply } from '../src/lib/dragonSettings.mjs';
import { DRAGON_PAGES, availableDragonPages } from '../src/lib/dragonActions.cjs';
import { LocalDragonVoice } from '../src/lib/localDragonVoice.mjs';

test('speech can only select explicit commands and fixed internal routes', () => {
  assert.equal(dragonCommand('Please start the timer!').action, 'start');
  assert.equal(dragonCommand('go to sleep').action, 'sleep');
  assert.equal(dragonCommand('open settings').path, '/settings');
  for (const value of ['delete my files', 'open https://evil.test', 'start timer then run powershell', '', 'do not start timer', 'restart timer']) {
    assert.equal(dragonCommand(value), null);
  }
});
test('stored settings cannot inject styles or exceed text and timeout limits', () => {
  const settings = normalizeDragon({ color: 'url(https://example.test)', greeting: 'x'.repeat(1000), timeout: 99999, volume: -10, enabled: 'yes' });
  assert.equal(settings.color, '#45e6cb');
  assert.equal(settings.greeting.length, 200);
  assert.equal(settings.timeout, 180);
  assert.equal(settings.volume, 0);
  assert.equal(settings.enabled, true);
  assert.doesNotThrow(() => normalizeDragon(null));
});
test('a session never opens the microphone merely by being constructed', () => {
  let permissions = 0;
  new LocalDragonVoice({ microphone() { permissions++; } }, () => {}, () => {}, () => {});
  assert.equal(permissions, 0);
});
test('stopping during a pending microphone permission request discards late streams', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let resolveCapture;
  let requested = false;
  let trackStopped = false;
  const permissions = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia() { requested = true; return new Promise(resolve => { resolveCapture = resolve; }); },
  } } });
  try {
    const engine = new LocalDragonVoice({ microphone(enabled) { permissions.push(enabled); return Promise.resolve(enabled); } });
    const listening = engine.listen();
    await Promise.resolve();
    assert.equal(requested, true);
    await engine.stop();
    resolveCapture({ getTracks: () => [{ stop() { trackStopped = true; } }] });
    await listening;
    assert.equal(trackStopped, true);
    assert.deepEqual(permissions, [true, false]);
    assert.equal(engine.stream, null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
  }
});
test('pause releases every track and disconnects processing before speech playback', async () => {
  const cleanup = [];
  const engine = new LocalDragonVoice({ microphone(enabled) { cleanup.push(`permission:${enabled}`); } });
  engine.stream = { getTracks: () => [1, 2].map(n => ({ stop() { cleanup.push(`track:${n}`); } })) };
  engine.context = { close() { cleanup.push('context'); return Promise.resolve(); } };
  engine.processor = { disconnect() { cleanup.push('processor'); } };
  engine.source = { disconnect() { cleanup.push('source'); } };
  engine.recognizer = { remove() { cleanup.push('recognizer'); } };
  await engine.pause();
  assert.deepEqual(cleanup, ['processor', 'source', 'track:1', 'track:2', 'context', 'recognizer', 'permission:false']);
  assert.equal(engine.stream, null);
  assert.equal(engine.recognizer, null);
});
test('stop cancels model loading and terminates its worker', async () => {
  let terminated = false;
  let cancelled = false;
  const engine = new LocalDragonVoice({ microphone: async () => false });
  engine.model = { terminate() { terminated = true; } };
  engine.cancelLoad = () => { cancelled = true; };
  await engine.stop();
  await engine.listen();
  assert.equal(terminated, true);
  assert.equal(cancelled, true);
  assert.equal(engine.closed, true);
});

test('an AI misclassifying advice as a timer command cannot execute it', () => {
  const plan = planDragonReply({ action: 'start', reply: 'Try a short focus session.' }, 'Any tips for focusing?');
  assert.equal(plan.action, 'none');
  assert.equal(plan.pending, undefined);
  assert.doesNotMatch(plan.reply, /yes or no|confirm/i);
});
test('clear AI requests execute once without spoken repetition or confirmation', () => {
  const command = planDragonReply({ action: 'pause', reply: 'Are you sure you want to pause?' }, 'Could you pause my focus session');
  assert.equal(command.action, 'pause');
  assert.equal(command.spoken, false);
  assert.equal(command.pending, undefined);
  assert.doesNotMatch(command.reply, /sure|confirm|yes or no/i);
  assert.equal(planDragonReply({ action: 'start', reply: 'Okay.' }, 'Do not start my timer').action, 'none');
});
test('every listed page has a working voice route, including polite aliases', () => {
  for (const page of DRAGON_PAGES) {
    const command = dragonCommand(`Could you please open the ${page.aliases[0]} page`);
    assert.equal(command?.path, page.path, page.id);
    assert.equal(command?.spoken, false);
  }
  assert.equal(dragonCommand('Show me my stats').path, '/analytics');
  assert.equal(dragonCommand('Take me to the notebook').path, '/notebook');
  assert.equal(dragonCommand('Let us take a break now').action, 'break');
  assert.equal(dragonCommand('go to sleep').action, 'sleep');
});
test('the capabilities list respects hidden features and admin access', () => {
  const pages = availableDragonPages({ isAdmin: false, previewing: false, hidden: feature => feature === 'business' });
  assert(!pages.some(page => page.id === 'admin' || page.id === 'business'));
  assert(pages.some(page => page.id === 'dashboard'));
  assert.equal(planDragonReply({ action: 'navigate', page: 'https://evil.test', reply: 'Okay.' }, 'open a site').action, 'none');
});
