// Exercises actual packaged-scheme WASM inference and the microphone gate.
// Only synthetic audio/devices are used; never records the user's microphone.
module.exports = async function voiceSmoke(contents, { ai = false } = {}) {
  return contents.executeJavaScript(`(async () => {
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const bridge = window.pomodrive.companion;
    const info = await bridge.info();
    if (${ai}) {
      const aiStatus = await bridge.aiStatus();
      assert(aiStatus.available, 'Local AI model/runtime not found by the app');
    }
    assert(info.modelReady, 'Missing offline model');
    await bridge.microphone(false);
    let denied = false;
    try { const stream = await navigator.mediaDevices.getUserMedia({audio:true}); stream.getTracks().forEach(t=>t.stop()); }
    catch { denied = true; }
    assert(denied, 'Inactive microphone access was not rejected');
    assert(await bridge.microphone(true), 'Could not activate microphone gate');
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    assert(stream.getAudioTracks().length === 1, 'Synthetic microphone unavailable');
    stream.getTracks().forEach(t => t.stop());
    assert(stream.getTracks().every(t => t.readyState === 'ended'), 'Microphone was not released');
    let videoDenied = false;
    try { const camera = await navigator.mediaDevices.getUserMedia({video:true}); camera.getTracks().forEach(t=>t.stop()); }
    catch { videoDenied = true; }
    assert(videoDenied, 'Camera access should never be granted');
    await bridge.microphone(false);
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src='app://pomodrive/voice/vosk.js';
      script.onload=resolve; script.onerror=reject; document.head.appendChild(script);
    });
    const model = await Vosk.createModel('app://pomodrive/voice/english.tar.gz', -1);
    const context = new AudioContext({sampleRate:16000});
    const recognizer = new model.KaldiRecognizer(16000);
    const text = [];
    recognizer.on('result', message => { if(message.result?.text) text.push(message.result.text); });
    const final = new Promise(resolve => recognizer.on('result', message => { if (message.result?.text) resolve(); }));
    const response = await fetch('app://pomodrive/voice/smoke.wav');
    assert(response.ok, 'Missing synthetic speech fixture');
    const audio = await context.decodeAudioData(await response.arrayBuffer());
    recognizer.acceptWaveform(audio);
    recognizer.retrieveFinalResult();
    await Promise.race([final, new Promise((_,reject)=>setTimeout(()=>reject(new Error('Offline inference timed out')),20000))]);
    recognizer.remove(); model.terminate(); await context.close();
    const recognized = text.join(' ');
    assert(recognized.includes('open settings'), 'Unexpected synthetic transcript: ' + recognized);
    // Exercise the real React companion with fake capture and muted output.
    const waitFor = async (check, label) => {
      const until = Date.now()+20000;
      while (!check()) { if (Date.now()>until) throw new Error(label); await new Promise(r=>setTimeout(r,100)); }
    };
    localStorage.setItem('pomodrive.dragon.v1', JSON.stringify({volume:0,greetOnLaunch:false}));
    window.dispatchEvent(new Event('pomodrive-dragon-settings'));
    await new Promise(r=>setTimeout(r,100));
    const register = Vosk.Model.prototype.registerRecognizer;
    let liveRecognizer;
    Vosk.Model.prototype.registerRecognizer = function(recognizer) { liveRecognizer=recognizer; return register.call(this,recognizer); };
    let captured;
    const getMicrophone = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => { captured=await getMicrophone(...args); return captured; };
    document.querySelector('.dragon-launcher').click();
    await waitFor(()=>document.querySelector('.dragon-status')?.textContent.includes('Listening'), 'Expanding did not start listening');
    assert(document.querySelector('.dragon-launcher').getAttribute('aria-expanded')==='true', 'Listening without expanded panel');
    if (${ai}) {
      // Match the product lifecycle: ask Qwen only after the panel is expanded
      // and startup/focus events have settled, rather than while minimized.
      const answer = await bridge.ask('I am having trouble focusing. Give me one small tip, without changing my timer.');
      assert(answer.action === 'none' && answer.reply.length > 0, 'Local AI advice was not conversational');
      await bridge.stopAI();
      assert(!(await bridge.aiStatus()).loaded, 'Local AI did not unload after stopping');
    }
    liveRecognizer.dispatchEvent(new CustomEvent('result',{detail:{result:{text:'open pricing'}}}));
    await waitFor(()=>location.pathname.startsWith('/pricing') && document.querySelector('.dragon-status')?.textContent.includes('Listening'), 'Voice navigation did not open pricing and keep listening');
    assert(!document.querySelector('.dragon-panel').textContent.match(/yes or no|confirm/i), 'Action asked for confirmation');
    assert([...document.querySelectorAll('.dragon-actions button,.dragon-actions a')].every(button=>button.getAttribute('aria-label') && !button.textContent.trim()), 'Toolbar needs accessible icon buttons');
    document.querySelector('.dragon-actions button[aria-label="Minimize dragon"]').click();
    await waitFor(()=>!document.querySelector('.dragon-panel'), 'Minimizing did not collapse the panel');
    assert(captured.getTracks().every(track=>track.readyState==='ended'), 'Minimized dragon left the microphone active');
    assert(!(await bridge.aiStatus()).loaded, 'Minimized dragon left the local model loaded');
    document.querySelector('.dragon-launcher').click();
    await waitFor(()=>document.querySelector('.dragon-status')?.textContent.includes('Listening'), 'Expanding again did not resume');
    window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}));
    await waitFor(()=>!document.querySelector('.dragon-panel'), 'Escape did not minimize dragon');
    document.querySelector('.dragon-launcher').click();
    await waitFor(()=>document.querySelector('.dragon-status')?.textContent.includes('Listening'), 'Dragon did not reopen');
    window.dispatchEvent(new Event('dragon-stop'));
    await waitFor(()=>!document.querySelector('.dragon-panel'), 'Stop did not minimize dragon');
    // Leave the compact panel open for visual verification using fake capture.
    document.querySelector('.dragon-launcher').click();
    await waitFor(()=>document.querySelector('.dragon-status')?.textContent.includes('Listening'), 'Dragon did not reopen for screenshot');
    return { microphoneGate:true, tracksReleased:true, cameraDenied:true, offlineInference:recognized, expandListens:true, minimizeReleasesMicrophone:true, voiceNavigation:true, iconButtons:true, noConfirmation:true, escapeCollapses:true };
  })()`);
};
