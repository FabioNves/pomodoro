// Run once before desktop:build. The speech model ships with the desktop
// installer; recognition never downloads code or models at runtime.
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';

const folder = path.resolve('native/desktop/voice-assets');
const file = path.join(folder, 'english.tar.gz');
const expectedHash = 'f0b24bb92a48ca575b6a96500d6b543f0f079c573dfe85bbe16001fc0404e1d8';
fs.mkdirSync(folder, { recursive: true });
if (!fs.existsSync(file)) {
  const url = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
  console.log('Downloading the offline English recognition model (one-time build setup)…');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Speech model download failed: ${response.status}`);
  const temporary = `${file}.download`;
  try {
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporary));
    const actual = createHash('sha256').update(fs.readFileSync(temporary)).digest('hex');
    if (actual !== expectedHash) throw new Error('Speech model checksum mismatch. Refusing to install it.');
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
}
const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (hash !== expectedHash) throw new Error('Installed speech model checksum mismatch.');
console.log(`Offline model ready: ${file}\nSHA256: ${hash}`);
