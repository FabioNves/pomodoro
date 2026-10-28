const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseAIReply, createLocalAI } = require('../native/desktop/local-ai.cjs');
test('model output cannot select arbitrary executable commands or URLs', () => {
  for (const content of [
    '{"action":"powershell","reply":"Running a script"}',
    '{"action":"https://example.test","reply":"Opening"}',
    '{"action":"navigate","page":"https://example.test","reply":"Opening"}',
    '{"action":"start","reply":null}', 'not json',
  ]) assert.throws(() => parseAIReply(content));
  assert.deepEqual(parseAIReply('{"action":"none","reply":"Hello."}'), { action: 'none', reply: 'Hello.' });
  assert.equal(parseAIReply('{"action":"navigate","page":"analytics","reply":"Okay."}').page, 'analytics');
});
test('missing model does not download anything or start a process', async () => {
  const ai = createLocalAI({ runtimeDirectory: 'missing-runtime', modelPath: 'missing-model.gguf' });
  assert.equal(ai.status().available, false);
  await assert.rejects(ai.ask('Hello'), /not installed/);
  assert.equal(ai.status().loaded, false);
  ai.stop();
});

function fixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodrive-ai-'));
  try { run(directory); }
  finally {
    assert(path.resolve(directory).startsWith(path.join(path.resolve(os.tmpdir()), 'pomodrive-ai-')));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
function modelFile(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'Qwen3-1.7B-Q4_K_M.gguf');
  fs.writeFileSync(file, 'GGUFtest');
  return file;
}
function runtime(directory) {
  const target = path.join(directory, 'runtime');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'llama-server.exe'), 'test');
  return target;
}
test('Windows model discovery works when LOCALAPPDATA is missing or stale', () => fixture(directory => {
  const model = modelFile(path.join(directory, 'AppData', 'Local', 'PomoDRIVE', 'models'));
  const runtimeDirectory = runtime(directory);
  for (const environment of [{}, { LOCALAPPDATA: path.join(directory, 'stale-profile') }]) {
    const ai = createLocalAI({ runtimeDirectory, discoveryOptions: { environment, home: directory } });
    assert.equal(ai.status().available, true);
    assert.equal(ai.status().modelPath, model);
  }
}));
test('a selected existing model survives an app restart without copying or downloading', () => fixture(directory => {
  const model = modelFile(path.join(directory, 'downloads'));
  const options = { runtimeDirectory: runtime(directory), modelConfigPath: path.join(directory, 'config', 'local-ai.json'), discoveryOptions: { environment: {}, home: directory } };
  const first = createLocalAI(options);
  assert.equal(first.status().reason, 'model_missing');
  assert.equal(first.selectModel(model).available, true);
  const restarted = createLocalAI(options);
  assert.equal(restarted.status().available, true);
  assert.equal(restarted.status().modelPath, model);
  assert.equal(fs.statSync(model).size, 8);
}));
test('packaged runtime fallback and newly installed files are detected on recheck', () => fixture(directory => {
  const location = path.join(directory, 'runtime');
  const model = path.join(directory, 'models', 'Qwen3-1.7B-Q4_K_M.gguf');
  const ai = createLocalAI({ runtimeDirectory: path.join(directory, 'wrong-runtime'), runtimeDirectories: [location], modelPath: model });
  assert.equal(ai.status().runtimeReady, false);
  runtime(directory);
  modelFile(path.dirname(model));
  assert.equal(ai.status().available, true);
}));
test('model selection rejects non-GGUF data', () => fixture(directory => {
  const model = modelFile(directory);
  fs.writeFileSync(model, 'invalid');
  const ai = createLocalAI({ runtimeDirectory: runtime(directory) });
  assert.throws(() => ai.selectModel(model), /valid GGUF/);
}));
