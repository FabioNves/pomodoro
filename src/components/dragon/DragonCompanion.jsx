"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDesktopCompanion } from '@/lib/platform';
import { LocalDragonVoice } from '@/lib/localDragonVoice.mjs';
import { dragonCommand, planDragonReply } from '@/lib/dragonSettings.mjs';
import { DRAGON_PAGES, pageAllowed } from '@/lib/dragonActions.cjs';
import { useDragonSettings } from '@/hooks/useDragonSettings';
import { useTimerControls } from '@/components/timer/TimerProvider';
import { useAccess } from '@/lib/access/client';
import DragonEye from './DragonEye';

function Icon({ name }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'minimize' ? <path d="M5 12h14" /> : name === 'settings' ? <><path d="m9 3-.6 2.1-1.8 1-2.1-.5-2 3.4 1.5 1.6v2L2.5 14l2 3.4 2.1-.5 1.8 1L9 20h4l.6-2.1 1.8-1 2.1.5 2-3.4-1.5-1.4v-2L19.5 9l-2-3.4-2.1.5-1.8-1L13 3Z" /><circle cx="11" cy="11.5" r="3" /></> : <><path d="m11 5-6 4H2v6h3l6 4Z" />{name === 'muted' ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>}</>}
  </svg>;
}

export default function DragonCompanion() {
  const { settings, ready, update } = useDragonSettings();
  const [supported, setSupported] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter(), timer = useTimerControls(), access = useAccess();
  const session = useRef(null), generation = useRef(0), expandedRef = useRef(false);
  const idleTimer = useRef(null), sessionTimer = useRef(null), busy = useRef(false);
  const latest = useRef({ settings, router, timer, access });
  const previousVolume = useRef(70);
  useEffect(() => { latest.current = { settings, router, timer, access }; }, [settings, router, timer, access]);

  const collapse = useCallback(() => {
    expandedRef.current = false; setExpanded(false);
    ++generation.current;
    clearTimeout(idleTimer.current); clearTimeout(sessionTimer.current);
    session.current?.stop().catch(() => {}); session.current = null;
    const bridge = getDesktopCompanion();
    bridge?.microphone(false).catch(() => {});
    bridge?.silence().catch(() => {});
    bridge?.stopAI().catch(() => {});
    busy.current = false; setState('idle');
  }, []);
  const armTimeout = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(collapse, latest.current.settings.timeout * 1000);
  }, [collapse]);
  const speak = useCallback(async (text, token) => {
    if (generation.current !== token) return;
    setMessage(text); setState('speaking');
    const config = latest.current.settings;
    if (config.volume > 0 && text.trim()) {
      try { await getDesktopCompanion().speak({ text, voice: config.voice, volume: config.volume, rate: config.rate }); }
      catch { /* Text replies remain available if a Windows voice fails. */ }
    }
  }, []);

  const expand = useCallback(async (greeting = '') => {
    if (expandedRef.current || !latest.current.settings.enabled) return;
    const bridge = getDesktopCompanion();
    if (!bridge) return;
    expandedRef.current = true; setExpanded(true); setError(''); setMessage(''); setState('loading');
    const token = ++generation.current;
    busy.current = true;
    const current = () => expandedRef.current && token === generation.current;
    const fail = failure => { if (current()) { collapse(); setError(failure?.message || 'Voice unavailable. Try opening the eye again.'); } };
    const resume = async engine => {
      if (!current()) return;
      setState('connecting'); armTimeout();
      await engine.listen();
      if (current()) { busy.current = false; setState('listening'); armTimeout(); }
    };
    try {
      const info = await bridge.info();
      if (!current()) return;
      if (!info.modelReady) throw new Error('The offline speech model is unavailable.');
      const ai = await bridge.aiStatus();
      if (!current()) return;
      const engine = new LocalDragonVoice(bridge, async text => {
        if (!current() || busy.current) return;
        busy.current = true; clearTimeout(idleTimer.current);
        let command = dragonCommand(text);
        if (command?.action === 'sleep') { collapse(); return; }
        try {
          await engine.pause();
          if (!current()) return;
          if (!command && latest.current.settings.aiEnabled && ai.available) {
            setState('thinking');
            try {
              const answer = await bridge.ask(text.slice(0, 600));
              if (!current()) return;
              command = planDragonReply(answer, text);
            } catch {
              if (!current()) return;
              command = { action: 'none', reply: 'I could not finish that response. Please try again.' };
            }
          }
          if (!current()) return;
          if (command?.action === 'sleep') { collapse(); return; }
          if (command?.action === 'navigate') {
            const page = DRAGON_PAGES.find(page => page.id === command.page && page.path === command.path);
            if (!page || !pageAllowed(page, latest.current.access)) command = { action: 'none', reply: 'That page is not available for your account.' };
            else latest.current.router.push(page.path);
          }
          if (command?.action === 'start') latest.current.timer.start();
          if (command?.action === 'pause') latest.current.timer.pause();
          if (command?.action === 'break') latest.current.timer.startBreak();
          const reply = command?.reply || 'I did not catch that. My capabilities are listed in Settings.';
          setMessage(reply);
          if (command?.spoken !== false) await speak(reply, token);
          if (!current()) return;
          await new Promise(resolve => setTimeout(resolve, 200));
          await resume(engine);
        } catch (failure) { fail(failure); }
      }, armTimeout, fail);
      session.current = engine;
      sessionTimer.current = setTimeout(collapse, 10 * 60 * 1000);
      await engine.load();
      if (!current()) return;
      if (greeting) { await speak(greeting, token); await new Promise(resolve => setTimeout(resolve, 200)); }
      await resume(engine);
    } catch (failure) { fail(failure); }
  }, [armTimeout, collapse, speak]);

  useEffect(() => {
    const bridge = getDesktopCompanion();
    if (!bridge) return;
    let mounted = true;
    bridge.info().then(info => { if (mounted) setSupported(info.supported); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const bridge = getDesktopCompanion();
    if (!bridge) return;
    const unsubscribe = bridge.onEvent(event => event === 'toggle' && !expandedRef.current ? expand() : collapse());
    const key = event => { if (event.key === 'Escape') collapse(); };
    const visibility = () => { if (document.hidden) collapse(); };
    window.addEventListener('keydown', key); window.addEventListener('pagehide', collapse); window.addEventListener('dragon-stop', collapse);
    document.addEventListener('visibilitychange', visibility);
    return () => { unsubscribe(); window.removeEventListener('keydown', key); window.removeEventListener('pagehide', collapse); window.removeEventListener('dragon-stop', collapse); document.removeEventListener('visibilitychange', visibility); collapse(); };
  }, [collapse, expand]);
  useEffect(() => { if (!settings.enabled) collapse(); }, [settings.enabled, collapse]);
  useEffect(() => { if (expandedRef.current) collapse(); }, [settings.aiEnabled, collapse]);
  useEffect(() => {
    if (!ready || !supported || !settings.enabled || !settings.greetOnLaunch || sessionStorage.getItem('dragon-greeted')) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const info = await getDesktopCompanion().info().catch(() => null);
      if (cancelled || info?.smoke || document.hidden || expandedRef.current) return;
      sessionStorage.setItem('dragon-greeted', 'true');
      expand(`${settings.greeting} ${settings.followUp}`.trim());
    }, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, supported, settings.enabled, settings.greetOnLaunch, settings.greeting, settings.followUp, expand]);

  if (!supported || !ready || !settings.enabled) return null;
  const status = { loading: 'Waking up', connecting: 'Connecting microphone', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', idle: 'Microphone off' }[state];
  const toggle = () => expandedRef.current ? collapse() : expand();
  return <aside className={`dragon-companion ${expanded ? 'dragon-companion--expanded' : ''}`} aria-label="Dragon companion">
    <button className="dragon-launcher" onClick={toggle} aria-label={expanded ? 'Minimize dragon and turn microphone off' : 'Expand dragon and start listening'} aria-expanded={expanded} title={expanded ? 'Minimize dragon' : 'Open dragon'}>
      <DragonEye state={state} color={settings.color} motion={settings.motion} />
    </button>
    {expanded ? <div className="dragon-panel">
      <div className="dragon-toolbar"><h2>Dragon</h2><span className="dragon-status" role="status" aria-label={status} title={status}><span className={`dragon-dot ${state === 'listening' ? 'dragon-dot--on' : ''}`} />{status}</span>
        <div className="dragon-actions">
          <button aria-label={settings.volume > 0 ? 'Mute dragon voice' : 'Unmute dragon voice'} title={settings.volume > 0 ? 'Mute voice' : 'Unmute voice'} onClick={() => {
            if (settings.volume > 0) { previousVolume.current = settings.volume; update({ volume: 0 }); getDesktopCompanion().silence().catch(() => {}); }
            else update({ volume: previousVolume.current });
          }}><Icon name={settings.volume > 0 ? 'volume' : 'muted'} /></button>
          <Link href="/settings#dragon" onClick={collapse} aria-label="Dragon settings" title="Settings"><Icon name="settings" /></Link>
          <button onClick={collapse} aria-label="Minimize dragon" title="Minimize · Esc"><Icon name="minimize" /></button>
        </div>
      </div>
      {message ? <p className="dragon-reply" aria-live="polite">{message}</p> : null}
    </div> : null}
    {!expanded && error ? <p className="dragon-error" role="alert">{error}</p> : null}
  </aside>;
}
