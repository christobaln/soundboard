const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  browseSoundboards: (query, seconds) =>
    ipcRenderer.invoke("library:browse", query, seconds),
  onLibraryClip: (callback) =>
    ipcRenderer.on("library:clip", (_event, data) => callback(data)),
  onLibraryStatus: (callback) =>
    ipcRenderer.on("library:status", (_event, message) => callback(message)),
  openSource: (url) => ipcRenderer.invoke("library:source", url),
  preferences: () => ipcRenderer.invoke("desktop:preferences"),
  setPreferences: (values) =>
    ipcRenderer.invoke("desktop:set-preferences", values),
  downloadCable: () => ipcRenderer.invoke("cable:download"),
  installCable: () => ipcRenderer.invoke("cable:install"),
  setShortcuts: (entries) => ipcRenderer.invoke("shortcuts:set", entries),
  onShortcut: (callback) => {
    ipcRenderer.on("shortcut:play", (_event, id) => callback(id));
  },
});
