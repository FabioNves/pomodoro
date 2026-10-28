// Vosk runs in a local WASM worker. Only the model is cached in IndexedDB;
// microphone samples and transcripts are never written to storage.
let scriptPromise;
function loadVosk() {
  if (window.Vosk) return Promise.resolve(window.Vosk);
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'app://pomodrive/voice/vosk.js';
    script.onload = () => resolve(window.Vosk);
    script.onerror = () => { scriptPromise = null; script.remove(); reject(new Error('The local recognition engine could not load.')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export class LocalDragonVoice {
  constructor(bridge, result, activity, failure) {
    Object.assign(this, { bridge, result, activity, failure });
    this.closed = false;
    this.capture = 0;
  }
  async load() {
    const Vosk = await loadVosk();
    if (this.closed) return;
    this.model = new Vosk.Model('app://pomodrive/voice/english.tar.gz', -1);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Loading the offline speech model timed out.')), 60000);
      this.cancelLoad = () => { clearTimeout(timer); resolve(); };
      this.model.on('load', message => {
        clearTimeout(timer);
        if (message.result) resolve(); else reject(new Error('Offline model unavailable. Run npm run desktop:voice:setup, then rebuild the desktop app.'));
      });
      this.model.on('error', () => { clearTimeout(timer); reject(new Error('The offline speech engine failed.')); });
    });
  }
  pause() {
    ++this.capture;
    if (this.processor) { if (this.processor.port) this.processor.port.onmessage = null; this.processor.disconnect(); this.processor = null; }
    this.source?.disconnect(); this.source = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.context?.close().catch(() => {}); this.context = null;
    this.recognizer?.remove(); this.recognizer = null;
    return this.bridge.microphone(false);
  }
  async listen() {
    if (this.closed) return;
    const capture = ++this.capture;
    const allowed = await this.bridge.microphone(true);
    if (this.closed || capture !== this.capture) return;
    if (!allowed) throw new Error('Focus PomoDRIVE before activating the microphone.');
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: {
      channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
    } });
    if (this.closed || capture !== this.capture) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream;
    stream.getAudioTracks().forEach(track => { track.onended = () => { if (!this.closed) this.failure(new Error('Microphone disconnected.')); }; });
    this.context = new AudioContext({ sampleRate: 16000 });
    await this.context.resume();
    if (this.closed || capture !== this.capture) return;
    await this.context.audioWorklet.addModule('app://pomodrive/voice/capture.js');
    if (this.closed || capture !== this.capture) return;
    const recognizer = new this.model.KaldiRecognizer(this.context.sampleRate);
    this.recognizer = recognizer;
    recognizer.on('result', message => {
      if (!this.closed && this.recognizer === recognizer && message.result?.text) this.result(message.result.text);
    });
    recognizer.on('partialresult', message => {
      if (!this.closed && this.recognizer === recognizer && message.result?.partial) this.activity();
    });
    this.model.on('error', () => { if (!this.closed) this.failure(new Error('Local speech recognition failed.')); });
    const sampleRate = this.context.sampleRate;
    this.processor = new AudioWorkletNode(this.context, 'dragon-capture');
    this.processor.port.onmessage = event => {
      if (this.closed || capture !== this.capture) return;
      try { recognizer.acceptWaveformFloat(event.data, sampleRate); }
      catch { this.failure(new Error('Could not process microphone audio.')); }
    };
    this.source = this.context.createMediaStreamSource(stream);
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }
  stop() {
    this.closed = true;
    this.cancelLoad?.();
    const paused = this.pause();
    this.model?.terminate(); this.model = null;
    return paused;
  }
}
