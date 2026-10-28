"use client";
import React, { useEffect, useState } from 'react';
import { getDesktopCompanion } from '@/lib/platform';
import { useDragonSettings } from '@/hooks/useDragonSettings';
import DragonEye from './DragonEye';
import { availableDragonPages } from '@/lib/dragonActions.cjs';
import { useAccess } from '@/lib/access/client';

export default function DragonSettings() {
  const { settings, update } = useDragonSettings();
  const access = useAccess();
  const [info, setInfo] = useState(null);
  const [voices, setVoices] = useState([]);
  const [message, setMessage] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [ai, setAi] = useState(null);
  useEffect(() => {
    const bridge = getDesktopCompanion();
    if (!bridge) return;
    let mounted = true;
    bridge.info().then(value => { if (mounted) setInfo(value); }).catch(() => {});
    bridge.aiStatus().then(value => { if (mounted) setAi(value); }).catch(() => {});
    bridge.voices().then(value => { if (mounted) setVoices(Array.isArray(value) ? value : []); })
      .catch(() => { if (mounted) setMessage('Windows voices could not be loaded. Check your installed speech voices.'); });
    return () => { mounted = false; };
  }, []);
  if (!info?.supported) return null;
  const preview = async () => {
    window.dispatchEvent(new Event('dragon-stop'));
    setPreviewing(true); setMessage('');
    try { await getDesktopCompanion().speak({ ...settings, text: `${settings.greeting} ${settings.followUp}`.trim() }); }
    catch { setMessage('Voice preview stopped or unavailable. Try the default Windows voice.'); }
    finally { setPreviewing(false); }
  };
  return (
    <section id="dragon" className="bg-surface rounded-lg p-6 border border-edge shadow-md scroll-mt-24">
      <div className="flex items-center gap-5 mb-4">
        <div style={{ width: 110 }}><DragonEye color={settings.color} motion={settings.motion} /></div>
        <div><h2 className="text-2xl font-semibold text-fg">Dragon companion</h2><p className="text-sm text-fg-muted">A local voice for your focus sessions.</p></div>
      </div>
      <div className="dragon-settings">
        <label className="dragon-check"><input type="checkbox" checked={settings.enabled} onChange={e => update({ enabled: e.target.checked })} />Show floating dragon eye</label>
        <label className="dragon-check"><input type="checkbox" checked={settings.aiEnabled} onChange={e => update({ aiEnabled: e.target.checked })} />Natural conversation with local Qwen3 1.7B</label>
        <small>{ai?.available ? 'Qwen3 1.7B is ready on this PC. It loads when you ask a question and unloads when you minimize the dragon.' : ai?.reason === 'runtime_missing' ? 'The local AI runtime was not found. Reinstall the latest desktop build.' : 'The Qwen model was not found. Locate the model you already downloaded below.'} Conversation context is kept only in memory and cleared when the dragon is minimized.</small>
        <div className="flex gap-3">
          <button onClick={async () => {
            try { setAi(await getDesktopCompanion().selectAIModel()); setMessage(''); }
            catch (error) { setMessage(error.message.replace(/^Error invoking remote method.*?Error: /, '')); }
          }}>Locate existing model</button>
          <button onClick={async () => {
            try { setAi(await getDesktopCompanion().aiStatus()); }
            catch { setMessage('Could not check local AI. Restart PomoDRIVE and try again.'); }
          }}>Check again</button>
        </div>
        {ai ? <details><summary className="text-sm cursor-pointer">Local AI diagnostics</summary><small style={{ display: 'block', overflowWrap: 'anywhere' }}>Model: {ai.modelReady ? 'found' : 'missing'} — {ai.modelPath}<br />Runtime: {ai.runtimeReady ? 'found' : 'missing'} — {ai.executable}</small></details> : null}
        <label className="dragon-check"><input type="checkbox" checked={settings.greetOnLaunch} onChange={e => update({ greetOnLaunch: e.target.checked })} />Open the dragon, greet me, and listen when the app starts</label>
        <label>Greeting<input maxLength={200} value={settings.greeting} onChange={e => update({ greeting: e.target.value })} /></label>
        <label>What the dragon says after greeting<textarea rows={3} maxLength={350} value={settings.followUp} onChange={e => update({ followUp: e.target.value })} /></label>
        <label>Local Windows voice<select value={settings.voice} onChange={e => update({ voice: e.target.value })}><option value="">Default installed voice</option>{voices.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>Voice volume · {settings.volume}%<input type="range" min="0" max="100" value={settings.volume} onChange={e => update({ volume: Number(e.target.value) })} /></label>
          <label>Speaking speed · {settings.rate}<input type="range" min="-5" max="5" value={settings.rate} onChange={e => update({ rate: Number(e.target.value) })} /></label>
        </div>
        <div className="flex gap-3"><button disabled={previewing || settings.volume === 0} onClick={preview}>Preview greeting</button>{previewing ? <button onClick={() => getDesktopCompanion().silence()}>Stop preview</button> : null}</div>
        <label>Minimize automatically after no speech<select value={settings.timeout} onChange={e => update({ timeout: Number(e.target.value) })}><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option></select></label>
        <label>Eye glow<input type="color" value={settings.color} onChange={e => update({ color: e.target.value })} /></label>
        <label className="dragon-check"><input type="checkbox" checked={settings.motion} onChange={e => update({ motion: e.target.checked })} />Animate floating, blinking and glow</label>
        <label className="dragon-check"><input type="checkbox" checked={Boolean(info.startup)} onChange={async e => {
          try { const startup = await getDesktopCompanion().startup(e.target.checked); setInfo(previous => ({ ...previous, startup })); if (!startup && e.target.checked) setMessage('Start with Windows is available in the installed desktop build.'); }
          catch { setMessage('Could not change Windows startup settings.'); }
        }} />Start PomoDRIVE with Windows</label>
        <section id="dragon-capabilities" className="rounded-lg border border-edge p-4 space-y-3">
          <h3 className="font-semibold text-fg">What Dragon can do</h3>
          <ul className="text-sm text-fg-muted list-disc pl-5 space-y-2">
            <li><strong>Control your timer:</strong> “start my timer”, “pause the timer”, “resume timer”, or “take a break”. Uses your configured focus and break lengths.</li>
            <li><strong>Open a page:</strong> say “open Analytics”, “show me my calendar”, or “take me to the notebook”. Supported pages: {availableDragonPages(access).map(page => page.label).join(', ')}.</li>
            <li><strong>Chat locally:</strong> with Qwen enabled, talk about focus, motivation, or planning. It cannot read or edit your tasks, files, or live timer state, and has no live news or web access.</li>
            <li><strong>Minimize and stop listening:</strong> click the minus icon or eye, press Escape{info.shortcut ? ` or ${info.shortcut}` : ''}, or say “go to sleep”.</li>
            <li><strong>Mute replies:</strong> use the speaker icon. The expanded dragon still listens and shows its replies.</li>
          </ul>
          <small>Expanding the dragon starts listening automatically; minimizing it releases the microphone and unloads Qwen. Capture pauses while it thinks or speaks, then resumes automatically. Clear timer and navigation requests happen immediately, without confirmation or a repeated spoken acknowledgement. Your account permissions still apply.</small>
          <small style={{ display: 'block' }}>Switching away from the app, minimizing its window, locking Windows, inactivity, or a ten-minute session limit also minimizes the dragon. If the launch greeting is enabled, it opens and listens after greeting you. Recognition currently uses English.</small>
        </section>
        <small>{info.modelReady ? 'Offline English recognition model installed.' : 'Offline model missing: run npm run desktop:voice:setup and rebuild the desktop app.'} Audio and transcripts are not saved or uploaded. Closing the Windows app keeps it in the tray; choose Quit to exit.</small>
        {message ? <p role="status" className="text-sm text-fg-muted">{message}</p> : null}
      </div>
    </section>
  );
}
