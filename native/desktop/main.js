// PomoDRIVE desktop shell.
//
// Serves the static frontend (www/, produced by `npm run build:static` at the
// repo root) from the app:// scheme and handles pomodrive:// deep links.
// Every screen and feature lives in the shared web code; this file only
// provides the window, the local "server" and the native glue.

const {
  app,
  BrowserWindow,
  protocol,
  net,
  shell,
  ipcMain,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const APP_SCHEME = "app";
const APP_HOST = "pomodrive";
const DEEP_LINK_SCHEME = "pomodrive";
const WWW = path.join(__dirname, "www");
// Live reload: ELECTRON_DEV_URL=http://localhost:3500 npm start
const DEV_URL = process.env.ELECTRON_DEV_URL;
const SMOKE = process.argv.includes("--smoke");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

let mainWindow = null;
let launchUrl = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: true, // public/sw.js handles notification clicks
    },
  },
]);

// Resolve a request path to a file in www/, the way a static host serves a
// Next.js export: exact file, then page.html, then page/index.html, then the
// SPA fallback to index.html.
function resolveFile(pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (rel === "") rel = "index.html";
  const candidates = [
    rel,
    `${rel.replace(/\/$/, "")}.html`,
    path.join(rel, "index.html"),
    "index.html",
  ];
  for (const candidate of candidates) {
    const file = path.normalize(path.join(WWW, candidate));
    if (!file.startsWith(WWW)) continue; // no path traversal
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

async function serveApp(request) {
  const url = new URL(request.url);
  const file = resolveFile(url.pathname);
  if (!file) return new Response("Not found", { status: 404 });
  const fileResponse = await net.fetch(pathToFileURL(file).href);
  const type =
    MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
  return new Response(fileResponse.body, {
    status: 200,
    headers: { "content-type": type },
  });
}

/* ── deep links (pomodrive://auth?code=...) ─────────────────────────── */

function extractDeepLink(argv) {
  return argv.find((arg) => arg.startsWith(`${DEEP_LINK_SCHEME}://`)) || null;
}

function deliverDeepLink(url) {
  if (!url) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send("deep-link", url);
  } else {
    launchUrl = url;
  }
}

if (!SMOKE) {
  // In development Electron must be told how to relaunch this script.
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
  }
}

/* ── window ──────────────────────────────────────────────────────────── */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#15272d",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Links to other sites open in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const internal =
      url.startsWith(`${APP_SCHEME}://`) || (DEV_URL && url.startsWith(DEV_URL));
    if (!internal) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (DEV_URL) mainWindow.loadURL(DEV_URL);
  else mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/`);
}

/* ── smoke test: electron . --smoke [--smoke-out=file.png] ───────────── */
// Loads the app, prints renderer console output, saves a screenshot and exits
// non-zero if the page failed to load or logged errors.

function runSmokeTest() {
  const outArg = process.argv.find((arg) => arg.startsWith("--smoke-out="));
  const out = outArg
    ? outArg.slice("--smoke-out=".length)
    : path.join(app.getPath("temp"), "pomodrive-smoke.png");
  const errors = [];
  const contents = mainWindow.webContents;
  // A packaged Windows app has no console, so mirror everything to a log file.
  const logFile = `${out}.log`;
  fs.writeFileSync(logFile, "");
  const log = (line) => {
    console.log(line);
    fs.appendFileSync(logFile, `${line}\n`);
  };
  const finish = (code) => {
    log(`[smoke] exit ${code}`);
    app.exit(code);
  };
  log(`[smoke] www: ${WWW} (packaged: ${app.isPackaged})`);

  contents.on("console-message", ({ level, message }) => {
    if (level === "error") errors.push(String(message));
    log(`[renderer:${level}] ${message}`);
  });
  contents.on("did-fail-load", (_event, code, description, url) => {
    log(`[smoke] failed to load ${url}: ${code} ${description}`);
    finish(1);
  });
  contents.on("did-finish-load", async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const title = await contents.executeJavaScript("document.title");
      const text = await contents.executeJavaScript(
        "document.body.innerText.slice(0, 400)"
      );
      const image = await contents.capturePage();
      fs.writeFileSync(out, image.toPNG());
      log(`[smoke] title: ${title}`);
      log(`[smoke] text: ${String(text).replace(/\s+/g, " ")}`);
      log(`[smoke] screenshot: ${out}`);
    } catch (error) {
      log(`[smoke] failed: ${error?.stack || error}`);
      finish(1);
      return;
    }
    // Google's sign-in script complains about the app:// origin; expected.
    const fatal = errors.filter((m) => !/GSI_LOGGER|accounts\.google/.test(m));
    if (fatal.length) {
      log(`[smoke] ${fatal.length} renderer error(s):`);
      fatal.forEach((m) => log(`  ${m}`));
    }
    finish(fatal.length ? 1 : 0);
  });
  setTimeout(() => {
    log("[smoke] timed out waiting for the page to load");
    finish(1);
  }, 60000);
}

/* ── lifecycle ───────────────────────────────────────────────────────── */

ipcMain.handle("open-external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    return shell.openExternal(url);
  }
  return undefined;
});
ipcMain.handle("get-launch-url", () => {
  const url = launchUrl;
  launchUrl = null;
  return url;
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    deliverDeepLink(extractDeepLink(argv));
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    deliverDeepLink(url);
  });
  launchUrl = extractDeepLink(process.argv);

  app.whenReady().then(() => {
    app.setAppUserModelId("com.pomodrive.app"); // Windows notifications
    protocol.handle(APP_SCHEME, serveApp);
    createWindow();
    if (SMOKE) runSmokeTest();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
