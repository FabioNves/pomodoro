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
  session,
  globalShortcut,
  powerMonitor,
  Tray,
  Menu,
  dialog,
} = require("electron");
const { createVoiceService } = require('./voice.cjs');
const { createLocalAI } = require('./local-ai.cjs');
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
const VOICE_SMOKE = SMOKE && process.argv.includes('--voice-smoke');
if (VOICE_SMOKE) app.commandLine.appendSwitch('use-fake-device-for-media-stream');
// Isolate smoke runs from the installed app's lock, sign-in and preferences.
if (SMOKE) app.setPath('userData', path.join(app.getPath('temp'), `pomodrive-smoke-${process.pid}`));
// The website, named as the referrer of embedded YouTube players (see
// allowYouTubeEmbeds()).
const WEB_ORIGIN = process.env.POMODRIVE_WEB_URL || "https://pomodrive.vercel.app";

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
let tray = null;
let quitting = false;
let microphoneAllowed = false;
const voice = createVoiceService();
const localAI = createLocalAI({
  runtimeDirectory: app.isPackaged ? path.join(process.resourcesPath, 'ai-runtime') : path.join(__dirname, 'ai-runtime'),
  runtimeDirectories: [path.join(process.resourcesPath, 'ai-runtime'), path.join(path.dirname(app.getPath('exe')), 'resources', 'ai-runtime')],
  modelDirectories: [path.resolve(app.getPath('appData'), '..', 'Local', 'PomoDRIVE', 'models')],
  modelConfigPath: path.join(app.getPath('userData'), 'local-ai.json'),
});
const voiceAssets = app.isPackaged ? path.join(process.resourcesPath, 'voice-assets') : path.join(__dirname, 'voice-assets');
const trustedUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.origin === new URL(DEV_URL || `${APP_SCHEME}://${APP_HOST}`).origin &&
      parsed.host === new URL(DEV_URL || `${APP_SCHEME}://${APP_HOST}`).host;
  } catch { return false; }
};
function trustedSender(event) {
  if (event.sender !== mainWindow?.webContents || event.senderFrame !== event.sender.mainFrame || !trustedUrl(event.senderFrame.url))
    throw new Error('Untrusted companion request.');
}
function stopCompanion() {
  microphoneAllowed = false;
  tray?.setToolTip('PomoDRIVE — microphone off');
  voice.stop();
  localAI.stop();
  mainWindow?.webContents.send('companion-stop');
}

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
  if (url.host !== APP_HOST) return new Response('Not found', { status: 404 });
  if (url.pathname.startsWith('/voice/')) {
    const file = url.pathname === '/voice/vosk.js'
      ? require.resolve('vosk-browser')
      : url.pathname === '/voice/capture.js' ? path.join(__dirname, 'voice-capture.js')
      : url.pathname === '/voice/english.tar.gz' ? path.join(voiceAssets, 'english.tar.gz')
      : VOICE_SMOKE && url.pathname === '/voice/smoke.wav' ? path.join(voiceAssets, 'smoke.wav') : null;
    if (!file || !fs.existsSync(file)) return new Response('Offline voice model is not installed. Run npm run desktop:voice:setup.', { status: 404 });
    const response = await net.fetch(pathToFileURL(file).href);
    return new Response(response.body, { headers: {
      'content-type': url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.wav') ? 'audio/wav' : 'application/gzip',
      'access-control-allow-origin': '*',
    } });
  }
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

/* ── embedded players ────────────────────────────────────────────────── */

// YouTube will not play in a frame unless the request names an http(s)
// page it is embedded in ("Error 153"), and the app:// origin does not
// count. Saved posts embed YouTube videos, so name the website instead.
function allowYouTubeEmbeds() {
  const filter = {
    urls: ["https://www.youtube-nocookie.com/*", "https://www.youtube.com/*"],
  };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const headers = details.requestHeaders;
    if (!/^https?:/.test(headers.Referer || "")) headers.Referer = `${WEB_ORIGIN}/`;
    callback({ requestHeaders: headers });
  });
}

/* ── deep links (pomodrive://auth?code=...) ─────────────────────────── */

function extractDeepLink(argv) {
  return argv.find((arg) => arg.startsWith(`${DEEP_LINK_SCHEME}://`)) || null;
}

function deliverDeepLink(url) {
  if (!url) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
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
      // The sandboxed preload cannot read package.json, so the version is
      // handed to it as a launch argument.
      additionalArguments: [`--pomodrive-version=${app.getVersion()}`],
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
  mainWindow.on('close', event => {
    stopCompanion();
    if (tray && !quitting) { event.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('blur', stopCompanion);
  mainWindow.on('minimize', stopCompanion);
  mainWindow.webContents.on('render-process-gone', stopCompanion);
  mainWindow.webContents.on('did-start-navigation', (_event, _url, inPlace, isMainFrame) => {
    if (isMainFrame && !inPlace) stopCompanion();
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
    quitting = true;
    stopCompanion();
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
      if (VOICE_SMOKE) {
        mainWindow.show(); mainWindow.focus();
        const result = await require('./voice-smoke.cjs')(contents, { ai: process.argv.includes('--ai-smoke') });
        log(`[smoke:voice] ${JSON.stringify(result)}`);
      }
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

ipcMain.handle('companion-info', event => {
  trustedSender(event);
  return { supported: process.platform === 'win32', smoke: SMOKE, modelReady: fs.existsSync(path.join(voiceAssets, 'english.tar.gz')),
    shortcut: globalShortcut.isRegistered('Control+Alt+Space') ? 'Ctrl+Alt+Space' : null,
    startup: app.getLoginItemSettings().openAtLogin };
});
ipcMain.handle('companion-microphone', (event, enabled) => {
  if (quitting) return false;
  trustedSender(event);
  microphoneAllowed = enabled === true && mainWindow.isFocused() && mainWindow.isVisible();
  tray?.setToolTip(`PomoDRIVE — microphone ${microphoneAllowed ? 'on' : 'off'}`);
  return microphoneAllowed;
});
ipcMain.handle('companion-voices', async event => {
  trustedSender(event);
  return process.platform === 'win32' ? voice.voices() : [];
});
ipcMain.handle('companion-ai-status', event => { trustedSender(event); return localAI.status(); });
ipcMain.handle('companion-ai-select-model', async event => {
  trustedSender(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Locate your downloaded Qwen3 1.7B model',
    defaultPath: localAI.status().modelPath,
    properties: ['openFile'], filters: [{ name: 'GGUF model', extensions: ['gguf'] }],
  });
  if (result.canceled || !result.filePaths[0]) return localAI.status();
  return localAI.selectModel(result.filePaths[0]);
});
ipcMain.handle('companion-ai-ask', (event, text) => { trustedSender(event); return localAI.ask(text); });
ipcMain.handle('companion-ai-stop', event => { if (quitting) return; trustedSender(event); localAI.stop(); });
ipcMain.handle('companion-speak', (event, input) => {
  trustedSender(event);
  if (process.platform !== 'win32') throw new Error('Windows local voices are required.');
  return voice.speak(input);
});
ipcMain.handle('companion-silence', event => { if (quitting) return; trustedSender(event); voice.stop(); });
ipcMain.handle('companion-startup', (event, enabled) => {
  trustedSender(event);
  if (process.platform === 'win32' && app.isPackaged) app.setLoginItemSettings({ openAtLogin: enabled === true });
  return app.getLoginItemSettings().openAtLogin;
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = extractDeepLink(argv);
    if (link) deliverDeepLink(link);
    else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    deliverDeepLink(url);
  });
  launchUrl = extractDeepLink(process.argv);

  app.whenReady().then(() => {
    app.setAppUserModelId("com.pomodrive.app"); // Windows notifications
    protocol.handle(APP_SCHEME, serveApp);
    allowYouTubeEmbeds();
    createWindow();
    // No video permissions, remote frames, or microphone use while inactive.
    const mediaAllowed = (contents, details) => contents === mainWindow?.webContents && microphoneAllowed &&
      mainWindow.isFocused() && trustedUrl(details?.requestingUrl || details?.securityOrigin || contents.getURL()) &&
      details?.isMainFrame !== false && !(details?.mediaTypes || []).some(type => type !== 'audio') &&
      (!details?.mediaType || details.mediaType === 'audio');
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
      callback(permission === 'media' ? mediaAllowed(contents, details) : permission === 'notifications' && contents === mainWindow?.webContents && trustedUrl(contents.getURL()));
    });
    session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) =>
      permission === 'media' ? mediaAllowed(contents, details) : permission === 'notifications' && contents === mainWindow?.webContents && trustedUrl(contents.getURL()));
    if (!SMOKE && process.platform === 'win32') {
      tray = new Tray(path.join(__dirname, 'build', 'icon.png'));
      tray.setToolTip('PomoDRIVE — microphone off until you activate the dragon');
      const show = () => { mainWindow.show(); mainWindow.restore(); mainWindow.focus(); };
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open PomoDRIVE', click: show },
        { label: 'Stop listening', click: stopCompanion },
        { label: 'Quit', click: () => { quitting = true; app.quit(); } },
      ]));
      tray.on('double-click', show);
      globalShortcut.register('Control+Alt+Space', () => {
        show();
        mainWindow.webContents.send('companion-toggle');
      });
    }
    powerMonitor.on('lock-screen', stopCompanion);
    powerMonitor.on('suspend', stopCompanion);
    if (SMOKE) runSmokeTest();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
app.on('before-quit', () => { quitting = true; stopCompanion(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
