// Exposes the minimal native surface the shared web code needs
// (see src/lib/platform.js). Runs sandboxed with context isolation.

const { contextBridge, ipcRenderer } = require("electron");

// The installed app's version, so the shared UI can tell the user when a
// newer build has been released (see src/components/UpdateBanner.jsx). It
// arrives as a launch argument from main.js: this preload is sandboxed, so
// it cannot read package.json off disk.
const VERSION_FLAG = "--pomodrive-version=";
const version =
  (process.argv.find((arg) => arg.startsWith(VERSION_FLAG)) || "").slice(
    VERSION_FLAG.length,
  ) || "";

contextBridge.exposeInMainWorld("pomodrive", {
  platform: "electron",
  version,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getLaunchUrl: () => ipcRenderer.invoke("get-launch-url"),
  onDeepLink: (handler) => {
    const listener = (_event, url) => handler(url);
    ipcRenderer.on("deep-link", listener);
    return () => ipcRenderer.removeListener("deep-link", listener);
  },
});
