const { spawn } = require('node:child_process');
const path = require('node:path');

// Windows' installed System.Speech voices synthesize locally. No browser
// speech service or cloud fallback is used.
function createVoiceService() {
  let speaking;
  const stop = () => { speaking?.kill(); speaking = null; };
  function run(mode, input) {
    return new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-File',
        path.join(__dirname.replace(/app\.asar$/, 'app.asar.unpacked'), 'voice.ps1'), '-Mode', mode,
      ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      if (mode === 'speak') speaking = child;
      let output = '';
      child.stdout.on('data', chunk => { output += chunk.toString(); });
      // Do not log speech text or captured audio.
      child.stderr.resume();
      child.stdin.on('error', () => {});
      const timeout = setTimeout(() => child.kill(), 45000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('close', code => {
        clearTimeout(timeout);
        if (speaking === child) speaking = null;
        if (code === 0) resolve(output.trim());
        else reject(new Error('Local Windows voice playback stopped or failed.'));
      });
      child.stdin.end(input ? JSON.stringify(input) : '');
    });
  }
  return {
    stop,
    async voices() { return JSON.parse(await run('voices')); },
    async speak(input) {
      if (!input || typeof input.text !== 'string' || input.text.length > 600)
        throw new Error('Invalid greeting.');
      stop();
      return run('speak', {
        text: input.text, voice: typeof input.voice === 'string' ? input.voice.slice(0, 150) : '',
        rate: Math.max(-5, Math.min(5, Math.round(Number(input.rate) || 0))),
        volume: Math.max(0, Math.min(100, Math.round(Number(input.volume) || 0))),
      });
    },
  };
}
module.exports = { createVoiceService };
