const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  session,
  dialog,
  shell,
} = require("electron");
const path = require("node:path");
const { validAccelerator } = require("./shortcuts.cjs");
const { registerCableSetup } = require("./cable.cjs");
let window;
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) =>
      callback(webContents === window?.webContents && permission === "media"),
  );
  window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1020,
    minHeight: 720,
    backgroundColor: "#101211",
    icon: path.join(__dirname, "../assets/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  registerCableSetup({ ipcMain, window, dialog, shell });
  window.loadFile(path.join(__dirname, "../dist/index.html"));
  ipcMain.handle("shortcuts:set", (event, entries) => {
    if (
      event.sender !== window.webContents ||
      !Array.isArray(entries) ||
      entries.length > 500
    )
      throw new Error("Invalid shortcuts");
    globalShortcut.unregisterAll();
    return entries.map(({ id, key }) => {
      if (typeof id !== "string" || !validAccelerator(key))
        return { id, ok: false };
      try {
        return {
          id,
          ok: globalShortcut.register(key, () =>
            window.webContents.send("shortcut:play", id),
          ),
        };
      } catch {
        return { id, ok: false };
      }
    });
  });
});
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
