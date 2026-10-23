// Builds every logo file from src/lib/brand (the drawing, the theme colours
// and the motions the app itself uses), so the files and the app always
// match. Run after changing the logo, a theme colour or a motion:
//
//   npm run build:logos
//
// Writes, for each theme in LOGO_PALETTES:
//   public/logo/pomodrive-new/<theme>/svg/   icon, icon_logo, icon_logo_centered
//                                            (+ -bg on the theme background), and
//                                            icon / icon_logo_centered with
//                                            -bounce and -windup, animated
//   public/logo/pomodrive-new/<theme>/png/   the still ones as PNG
//   public/logo/pomodrive-new/<theme>/webp/  the animated ones as animated WebP
// and, in the Dark colours, the app icons:
//   public/logo/pomodrive-new/app/           manifest icons and apple-touch-icon
//   src/app/favicon.ico                      16, 32 and 48 px
//   native/desktop/build/icon.png            the desktop app's icon
//
// Uses the sharp that Next.js installs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { LOGO_MOTIONS, LOGO_PALETTES, logoSvg } from "../src/lib/brand/logo.js";
import { LAYOUTS } from "../src/lib/brand/logoArt.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "logo", "pomodrive-new");

// File names keep the designer's names for the three layouts.
const FILES = { icon: "icon", horizontal: "icon_logo", stacked: "icon_logo_centered" };
const ANIMATED = ["icon", "stacked"];
// A file cannot draw outside its canvas, and the wordmark layouts have
// almost no room above the stem: their bounce rises less.
const HOP = { icon: 1, horizontal: 0.35, stacked: 0.35 };
const PNG_WIDTH = { icon: 512, horizontal: 912, stacked: 912 };
const WEBP_WIDTH = { icon: 256, stacked: 456 };
const FPS = 30;

const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};

const render = (svg, width) => {
  const native = Number(/width="([\d.]+)"/.exec(svg)[1]);
  return sharp(Buffer.from(svg), { density: (72 * width * 1.5) / native }).resize({ width }).png();
};

async function animatedWebp(options, width, file) {
  const { seconds } = LOGO_MOTIONS[options.motion];
  const count = Math.round(seconds * FPS);
  const frames = [];
  for (let i = 0; i < count; i += 1) {
    frames.push(await render(logoSvg({ ...options, at: i / count }), width).toBuffer());
  }
  // Whole-millisecond delays that still add up to the loop's length.
  const delay = frames.map((_f, i) => Math.round(((i + 1) * 1000) / FPS) - Math.round((i * 1000) / FPS));
  await sharp(frames, { join: { animated: true } })
    .webp({ loop: 0, delay, quality: 90, alphaQuality: 100, effort: 4 })
    .toFile(file);
  return frames;
}

/** True when no frame has a visible pixel on the top row (nothing clipped). */
async function clearOfTopEdge(frames) {
  for (const frame of frames) {
    const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let x = 0; x < info.width; x += 1) if (data[x * 4 + 3] > 8) return false;
  }
  return true;
}

/** An .ico holding PNG images (supported everywhere .ico is). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const clipped = [];
let count = 0;

for (const theme of Object.keys(LOGO_PALETTES)) {
  for (const layout of Object.keys(LAYOUTS)) {
    for (const background of [false, true]) {
      const name = `${FILES[layout]}${background ? "-bg" : ""}`;
      const svg = logoSvg({ layout, theme, background });
      write(path.join(OUT, theme, "svg", `${name}.svg`), svg);
      await render(svg, PNG_WIDTH[layout]).toFile(path.join(OUT, theme, "png", `${name}.png`));
      count += 2;
      if (!ANIMATED.includes(layout)) continue;
      for (const motion of Object.keys(LOGO_MOTIONS)) {
        const options = { layout, theme, background, motion, hop: HOP[layout] };
        const animated = `${FILES[layout]}-${motion}${background ? "-bg" : ""}`;
        write(path.join(OUT, theme, "svg", `${animated}.svg`), logoSvg(options));
        fs.mkdirSync(path.join(OUT, theme, "webp"), { recursive: true });
        const frames = await animatedWebp(options, WEBP_WIDTH[layout], path.join(OUT, theme, "webp", `${animated}.webp`));
        if (!background && !(await clearOfTopEdge(frames))) clipped.push(`${theme}/${animated}`);
        count += 2;
      }
    }
  }
  console.log(`${theme}: done`);
}

// App icons, in the default (Dark) colours.
const tile = (size, pad, radius = 0) => logoSvg({ layout: "icon", theme: "dark", background: true, frame: { size, pad, radius } });
const app = path.join(OUT, "app");
fs.mkdirSync(app, { recursive: true });
await render(tile(192, 0.16), 192).toFile(path.join(app, "icon-192.png"));
await render(tile(512, 0.16), 512).toFile(path.join(app, "icon-512.png"));
// Maskable: launchers crop to a circle 80% wide, so the art stays inside it.
await render(tile(512, 0.24), 512).toFile(path.join(app, "maskable-512.png"));
// iOS rounds the corners itself.
await render(tile(180, 0.16), 180).toFile(path.join(app, "apple-touch-icon.png"));
write(path.join(app, "icon.svg"), tile(512, 0.12, 0.22));
const favicon = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await render(tile(size, 0.06, 0.22), size).toBuffer() })),
);
write(path.join(ROOT, "src", "app", "favicon.ico"), ico(favicon));
await render(tile(512, 0.12, 0.22), 512).toFile(path.join(ROOT, "native", "desktop", "build", "icon.png"));
count += 8;

console.log(`${count} files written`);
if (clipped.length) {
  console.error(`Clipped at the top edge: ${clipped.join(", ")}. Lower HOP for that layout.`);
  process.exit(1);
}
