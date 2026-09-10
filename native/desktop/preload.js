// Exposes the minimal native surface the shared web code needs
// (see src/lib/platform.js). Runs sandboxed with context isolation.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pomodrive", {
  platform: "electron",
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getLaunchUrl: () => ipcRenderer.invoke("get-launch-url"),
  onDeepLink: (handler) => {
    const listener = (_event, url) => handler(url);
    ipcRenderer.on("deep-link", listener);
    return () => ipcRenderer.removeListener("deep-link", listener);
  },
});
