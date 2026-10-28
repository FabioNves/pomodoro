"use client";
import { useEffect, useState } from 'react';
import { DEFAULT_DRAGON, DRAGON_EVENT, DRAGON_KEY, loadDragon, saveDragon } from '@/lib/dragonSettings.mjs';
export function useDragonSettings() {
  const [settings, setSettings] = useState(DEFAULT_DRAGON);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => setSettings(loadDragon());
    refresh(); setReady(true);
    const storage = event => { if (event.key === DRAGON_KEY || event.key === null) refresh(); };
    window.addEventListener(DRAGON_EVENT, refresh);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(DRAGON_EVENT, refresh); window.removeEventListener('storage', storage); };
  }, []);
  return { settings, ready, update: saveDragon };
}
