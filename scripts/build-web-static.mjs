#!/usr/bin/env node
// Builds the shared frontend as a static site for the mobile and desktop apps.
//
// The website build (`next build`) includes the API routes, which cannot be
// statically exported. This script therefore builds a temporary copy of the
// project without src/app/api (and without src/proxy.js) using
// NEXT_OUTPUT=export, and copies the result to:
//   dist/web            -> Capacitor webDir (npx cap sync)
//   native/desktop/www  -> packaged by electron-builder
//
// The API base URL is baked in from NEXT_PUBLIC_API_URL (env or .env files).

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const stage = path.join(root, ".native-build");
const distDir = path.join(root, "dist", "web");
const desktopWww = path.join(root, "native", "desktop", "www");
const DEFAULT_API_URL = "https://pomodrive.vercel.app";

function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  for (const file of [".env.local", ".env.production", ".env"]) {
    const envPath = path.join(root, file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (match && match[1] === key) {
        return match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
  return "";
}

const apiUrl = readEnvValue("NEXT_PUBLIC_API_URL") || DEFAULT_API_URL;
const webUrl = readEnvValue("NEXT_PUBLIC_WEB_URL") || apiUrl;
console.log(`[build-web-static] API server: ${apiUrl}`);
console.log(`[build-web-static] Sign-in site: ${webUrl}`);

// 1. Stage a copy of the project without the server-only parts.
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

const EXCLUDED = new Set([
  path.join(root, "src", "app", "api"),
  path.join(root, "src", "proxy.js"),
]);
const copyEntry = (name) => {
  const from = path.join(root, name);
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, path.join(stage, name), {
    recursive: true,
    filter: (src) => !EXCLUDED.has(src),
  });
};
for (const entry of [
  "src",
  "public",
  "package.json",
  "jsconfig.json",
  "postcss.config.mjs",
  "next.config.mjs",
  ".env",
  ".env.local",
  ".env.production",
]) {
  copyEntry(entry);
}
fs.symlinkSync(
  path.join(root, "node_modules"),
  path.join(stage, "node_modules"),
  "junction"
);

// 2. Build the static export.
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: stage,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_OUTPUT: "export",
    NEXT_TURBOPACK_ROOT: root,
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_WEB_URL: webUrl,
    NEXT_TELEMETRY_DISABLED: "1",
  },
});
if (result.status !== 0) {
  console.error("[build-web-static] next build failed");
  process.exit(result.status ?? 1);
}

// 3. Publish the output to both shells.
const out = path.join(stage, "out");
for (const target of [distDir, desktopWww]) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(out, target, { recursive: true });
}
fs.rmSync(stage, { recursive: true, force: true });
console.log(
  `[build-web-static] done -> ${path.relative(root, distDir)} and ${path.relative(root, desktopWww)}`
);
