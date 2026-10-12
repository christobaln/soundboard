const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  searchSounds: (query, offset) =>
    ipcRenderer.invoke("library:search", query, offset),
  downloadSound: (url) => ipcRenderer.invoke("library:download", url),
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
