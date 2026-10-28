// Optional local AI setup. The model lives outside the installer, so rebuilding
// or upgrading the app does not duplicate a gigabyte of model weights.
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This setup currently supports Windows x64.');
const runtime = path.resolve('native/desktop/ai-runtime');
const modelDirectory = process.env.POMODRIVE_MODEL_DIR || path.join(process.env.LOCALAPPDATA, 'PomoDRIVE', 'models');
const model = path.join(modelDirectory, 'Qwen3-1.7B-Q4_K_M.gguf');
const modelHash = 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897';
const runtimeHash = '37b3efcf962847ca869745fd4ccf7f5e7e8dacfeff9fa3523b4ca8cdc66d632b';
async function checksum(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function download(url, file, expected) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && await checksum(file) === expected) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  let received = 0, lastReport = 0;
  const total = Number(response.headers.get('content-length'));
  const hash = createHash('sha256');
  const progress = new Transform({ transform(chunk, _encoding, callback) {
    hash.update(chunk); received += chunk.length;
    if (Date.now() - lastReport > 10000) {
      console.log(`${path.basename(file)}: ${Math.round(received / 1e6)} MB${total ? ` / ${Math.round(total / 1e6)} MB` : ''}`);
      lastReport = Date.now();
    }
    callback(null, chunk);
  } });
  const temporary = `${file}.download`;
  try {
    await pipeline(Readable.fromWeb(response.body), progress, fs.createWriteStream(temporary));
    if (hash.digest('hex') !== expected) throw new Error('Download checksum mismatch.');
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
}
fs.mkdirSync(runtime, { recursive: true });
if (!fs.existsSync(path.join(runtime, 'llama-server.exe'))) {
  const zip = path.join(runtime, 'runtime.zip');
  await download('https://github.com/ggml-org/llama.cpp/releases/download/b11669/llama-b11669-bin-win-cpu-x64.zip', zip, runtimeHash);
  const entries = execFileSync('tar.exe', ['-tf', zip], { encoding: 'utf8' }).trim().split(/\r?\n/);
  for (const entry of entries) {
    const target = path.resolve(runtime, entry);
    if (!target.startsWith(runtime + path.sep)) throw new Error('Unsafe runtime archive path.');
  }
  execFileSync('tar.exe', ['-xf', zip, '-C', runtime]);
  fs.rmSync(zip);
}
await download('https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf', model, modelHash);
console.log(`Local Qwen3 1.7B ready.\nModel: ${model}\nRuntime: ${runtime}`);
