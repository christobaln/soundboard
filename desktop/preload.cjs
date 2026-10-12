const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  downloadCable: () => ipcRenderer.invoke("cable:download"),
  installCable: () => ipcRenderer.invoke("cable:install"),
  setShortcuts: (entries) => ipcRenderer.invoke("shortcuts:set", entries),
  onShortcut: (callback) => {
    ipcRenderer.on("shortcut:play", (_event, id) => callback(id));
  },
});
