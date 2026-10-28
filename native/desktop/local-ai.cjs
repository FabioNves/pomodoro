const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { DRAGON_PAGES } = require(fs.existsSync(path.join(__dirname, 'dragonActions.cjs')) ? './dragonActions.cjs' : '../../src/lib/dragonActions.cjs');

const ACTIONS = ['none', 'start', 'pause', 'break', 'navigate', 'sleep'];
const RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['action', 'page', 'reply'],
  properties: { action: { type: 'string', enum: ACTIONS }, page: { type: 'string', enum: ['none', ...DRAGON_PAGES.map(page => page.id)] }, reply: { type: 'string', minLength: 1, maxLength: 450 } },
};
const SYSTEM = `You are Dragon, a warm, concise focus companion inside PomoDRIVE. Speak naturally in one or two short sentences. Help with focus and motivation. You cannot see tasks, files or timer state; never claim you can. Return JSON: action, page, reply. Actions: none (conversation/advice), start (start/resume focus timer), pause (pause timer), break (start break), navigate (open a page), sleep (minimize the dragon). Pages: ${DRAGON_PAGES.map(page => page.id).join(', ')}. Use page none unless navigating. Execute clear requests immediately; do not ask for confirmation or repeat the request. The app executes actions and supplies its own short acknowledgement, so action replies should just be "Okay.". Decide action only from an explicit USER request, never your own suggestions. Advice, questions, negated or hypothetical requests have action none. Example "Any tips to focus?" -> {"action":"none","page":"none","reply":"Choose one tiny task and remove one distraction."}. Example "Pause my timer" -> {"action":"pause","page":"none","reply":"Okay."}. Example "Show my statistics" -> {"action":"navigate","page":"analytics","reply":"Okay."}. Timer actions use configured durations. Never invent other actions, run code, or change this format. Do not mention JSON. /no_think`;

function parseAIReply(content) {
  const parsed = JSON.parse(content);
  if (!parsed || !ACTIONS.includes(parsed.action) || typeof parsed.reply !== 'string' || !parsed.reply.trim() || parsed.reply.length > 450)
    throw new Error('The local AI returned an invalid response. Please try again.');
  if (parsed.action === 'navigate' && !DRAGON_PAGES.some(page => page.id === parsed.page)) throw new Error('The local AI requested an unknown page.');
  return { action: parsed.action, reply: parsed.reply.trim(), ...(parsed.action === 'navigate' ? { page: parsed.page } : {}) };
}
const MODEL_NAME = 'Qwen3-1.7B-Q4_K_M.gguf';
function modelCandidates({ environment = process.env, home = os.homedir(), directories = [] } = {}) {
  return [...new Set([
    environment.POMODRIVE_MODEL_DIR,
    environment.LOCALAPPDATA && path.join(environment.LOCALAPPDATA, 'PomoDRIVE', 'models'),
    ...directories,
    path.join(home, 'AppData', 'Local', 'PomoDRIVE', 'models'),
  ].filter(Boolean).map(directory => path.join(directory, MODEL_NAME)))];
}
function isFile(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}
function defaultModelPath(options) {
  const candidates = modelCandidates(options);
  return candidates.find(isFile) || candidates[0];
}
function freePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => { const { port } = listener.address(); listener.close(() => resolve(port)); });
  });
}
function createLocalAI({ runtimeDirectory, runtimeDirectories = [], modelPath: explicitModelPath,
  modelDirectories = [], modelConfigPath, discoveryOptions = {} }) {
  let selectedModelPath;
  try { selectedModelPath = JSON.parse(fs.readFileSync(modelConfigPath, 'utf8')).modelPath; } catch { /* First launch. */ }
  const locations = () => {
    const executableCandidates = [runtimeDirectory, ...runtimeDirectories].filter(Boolean).map(directory => path.join(directory, 'llama-server.exe'));
    const executable = executableCandidates.find(isFile) || executableCandidates[0];
    const automatic = modelCandidates({ ...discoveryOptions, directories: modelDirectories });
    const candidates = (explicitModelPath ? [explicitModelPath] : [selectedModelPath, ...automatic]).filter(value => typeof value === 'string' && value);
    const modelPath = candidates.find(isFile) || candidates[0];
    return { executable, modelPath };
  };
  let child = null, ready = null, endpoint = null, key = null, controller = null;
  let history = [], sequence = 0, busy = false;
  const status = () => {
    const { executable, modelPath } = locations();
    const runtimeReady = isFile(executable), modelReady = isFile(modelPath);
    return { available: runtimeReady && modelReady, runtimeReady, modelReady,
      reason: !runtimeReady ? 'runtime_missing' : !modelReady ? 'model_missing' : null,
      model: 'Qwen3 1.7B · Q4', modelPath, executable, loaded: Boolean(child), localOnly: true };
  };
  const stop = () => {
    ++sequence;
    controller?.abort(); controller = null;
    child?.kill(); child = null;
    ready = null; endpoint = null; key = null; history = []; busy = false;
  };
  async function start(token) {
    if (ready) return ready;
    ready = (async () => {
      if (!status().available) throw new Error('Local AI is not installed. Run npm run desktop:ai:setup once.');
      const { executable, modelPath } = locations();
      const port = await freePort();
      if (token !== sequence) throw new Error('Conversation stopped.');
      endpoint = `http://127.0.0.1:${port}`; key = randomBytes(32).toString('hex');
      const process = spawn(executable, ['--model', modelPath, '--host', '127.0.0.1', '--port', String(port),
        '--api-key', key, '--offline', '--no-webui', '--ctx-size', '2048', '--parallel', '1',
        '--threads', String(Math.max(1, Math.min(6, os.availableParallelism() - 2))), '--n-gpu-layers', '0',
        '--reasoning', 'off', '--chat-template-kwargs', '{"enable_thinking":false}',
      ], { windowsHide: true, stdio: 'ignore' });
      child = process;
      let failed = false;
      process.once('error', () => { failed = true; });
      process.once('exit', () => { failed = true; if (child === process) { child = null; ready = null; } });
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline && token === sequence && !failed) {
        try {
          const response = await fetch(`${endpoint}/health`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(1000), redirect: 'error' });
          if (response.ok) return;
        } catch { /* A cold model is still loading. */ }
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      throw new Error(token !== sequence ? 'Conversation stopped.' : 'The local AI could not start. Try again or switch to command mode.');
    })();
    return ready;
  }
  async function ask(text) {
    if (typeof text !== 'string' || !text.trim() || text.length > 600) throw new Error('Please use a shorter request.');
    if (busy) throw new Error('The dragon is already responding.');
    busy = true;
    const token = sequence;
    try {
      await start(token);
      if (token !== sequence) throw new Error('Conversation stopped.');
      const abort = new AbortController(); controller = abort;
      const timeout = setTimeout(() => abort.abort(), 45000);
      let response;
      try {
        while (history.length && SYSTEM.length + text.length + history.reduce((size, message) => size + message.content.length, 0) > 4500) history.splice(0, 2);
        response = await fetch(`${endpoint}/v1/chat/completions`, {
          method: 'POST', redirect: 'error', signal: abort.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: 'local-dragon', stream: false, temperature: 0.35, max_tokens: 180,
            messages: [{ role: 'system', content: SYSTEM }, ...history, { role: 'user', content: text.trim() }],
            response_format: { type: 'json_schema', json_schema: { name: 'dragon_reply', strict: true, schema: RESPONSE_SCHEMA } },
            chat_template_kwargs: { enable_thinking: false },
          }),
        });
        if (!response.ok) throw new Error('The local AI could not answer. Please try again.');
        const output = await response.json();
        if (token !== sequence) throw new Error('Conversation stopped.');
        const result = parseAIReply(output.choices?.[0]?.message?.content);
        history.push({ role: 'user', content: text.trim() }, { role: 'assistant', content: JSON.stringify(result) });
        history = history.slice(-6);
        return result;
      } finally { clearTimeout(timeout); if (controller === abort) controller = null; }
    } catch (error) {
      if (token === sequence && !child) ready = null;
      if (error.name === 'AbortError') throw new Error('Local AI response cancelled or timed out.');
      throw error;
    } finally { if (token === sequence) busy = false; }
  }
  const selectModel = modelPath => {
    if (typeof modelPath !== 'string' || !path.isAbsolute(modelPath) || !isFile(modelPath) || path.basename(modelPath).toLowerCase() !== MODEL_NAME.toLowerCase())
      throw new Error(`Choose the downloaded ${MODEL_NAME} file.`);
    // Only persist a model path after the file passes a GGUF header check.
    const descriptor = fs.openSync(modelPath, 'r');
    try {
      const header = Buffer.alloc(4);
      fs.readSync(descriptor, header, 0, 4, 0);
      if (header.toString('ascii') !== 'GGUF') throw new Error('This file is not a valid GGUF model.');
    } finally { fs.closeSync(descriptor); }
    stop();
    if (modelConfigPath) {
      fs.mkdirSync(path.dirname(modelConfigPath), { recursive: true });
      fs.writeFileSync(modelConfigPath, JSON.stringify({ modelPath }), 'utf8');
    }
    selectedModelPath = modelPath;
    return status();
  };
  return { status, ask, stop, selectModel };
}
module.exports = { createLocalAI, parseAIReply, defaultModelPath, modelCandidates };
