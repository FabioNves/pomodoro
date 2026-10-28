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
  companion: {
    info: () => ipcRenderer.invoke('companion-info'),
    aiStatus: () => ipcRenderer.invoke('companion-ai-status'),
    selectAIModel: () => ipcRenderer.invoke('companion-ai-select-model'),
    ask: text => ipcRenderer.invoke('companion-ai-ask', text),
    stopAI: () => ipcRenderer.invoke('companion-ai-stop'),
    microphone: enabled => ipcRenderer.invoke('companion-microphone', enabled),
    voices: () => ipcRenderer.invoke('companion-voices'),
    speak: input => ipcRenderer.invoke('companion-speak', input),
    silence: () => ipcRenderer.invoke('companion-silence'),
    startup: enabled => ipcRenderer.invoke('companion-startup', enabled),
    onEvent: handler => {
      const toggle = () => handler('toggle');
      const stop = () => handler('stop');
      ipcRenderer.on('companion-toggle', toggle);
      ipcRenderer.on('companion-stop', stop);
      return () => {
        ipcRenderer.removeListener('companion-toggle', toggle);
        ipcRenderer.removeListener('companion-stop', stop);
      };
    },
  },
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getLaunchUrl: () => ipcRenderer.invoke("get-launch-url"),
  onDeepLink: (handler) => {
    const listener = (_event, url) => handler(url);
    ipcRenderer.on("deep-link", listener);
    return () => ipcRenderer.removeListener("deep-link", listener);
  },
});
