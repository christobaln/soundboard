const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  session,
  dialog,
  shell,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const path = require("node:path");
const { validAccelerator } = require("./shortcuts.cjs");
const { registerCableSetup } = require("./cable.cjs");
const { readPreferences, writePreferences } = require("./preferences.cjs");
const { registerSoundboards } = require("./soundboards.cjs");
const { registerLibrary } = require("./library.cjs");
let window,
  tray,
  desktopSettings,
  quitting = false;
if (process.platform === "win32")
  app.setAppUserModelId("studio.waveform.soundboard");
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on("second-instance", () => {
  if (window) {
    window.show();
    window.restore();
    window.focus();
  }
});
app.on("before-quit", () => {
  quitting = true;
});
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.whenReady().then(() => {
  if (!primaryInstance) return;
  desktopSettings = readPreferences(app);
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
    show: !desktopSettings.startMinimized,
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
  tray = new Tray(
    nativeImage.createFromPath(path.join(__dirname, "../assets/icon.png")),
  );
  tray.setToolTip("Waveform · sounds and voice");
  const showWindow = () => {
    window.show();
    window.restore();
    window.focus();
  };
  tray.on("double-click", showWindow);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Waveform", click: showWindow },
      {
        label: "Stop all sounds",
        click: () => window.webContents.send("shortcut:play", "stop"),
      },
      {
        label: "Toggle microphone mute",
        click: () => window.webContents.send("shortcut:play", "mute"),
      },
      { type: "separator" },
      { label: "Quit Waveform", click: () => app.quit() },
    ]),
  );
  window.on("close", (event) => {
    if (!quitting && desktopSettings.minimizeToTray) {
      event.preventDefault();
      window.hide();
    }
  });
  const fromWindow = (event) => {
    if (event.sender !== window.webContents)
      throw new Error("Unauthorized window");
  };
  const getPreferences = () => ({
    ...desktopSettings,
    version: app.getVersion(),
    canAutoStart:
      app.isPackaged && ["win32", "darwin"].includes(process.platform),
    launchAtLogin:
      app.isPackaged && ["win32", "darwin"].includes(process.platform)
        ? app.getLoginItemSettings().openAtLogin
        : false,
  });
  ipcMain.handle("desktop:preferences", (event) => {
    fromWindow(event);
    return getPreferences();
  });
  ipcMain.handle("desktop:set-preferences", (event, values) => {
    fromWindow(event);
    if (!values || typeof values !== "object")
      throw new Error("Invalid desktop settings");
    desktopSettings = writePreferences(app, values);
    if (getPreferences().canAutoStart)
      app.setLoginItemSettings({
        openAtLogin: values.launchAtLogin === true,
        path: process.execPath,
      });
    return getPreferences();
  });
  ipcMain.handle("library:source", async (event, url) => {
    fromWindow(event);
    const { sourceURL } = await import("../shared/commons.mjs");
    const { isLibraryURL } = await import("../shared/soundboards.mjs");
    await shell.openExternal(isLibraryURL(url) ? url : sourceURL(url));
  });
  registerLibrary({ app, ipcMain, window });
  registerCableSetup({ ipcMain, window, dialog, shell });
  registerSoundboards({ app, BrowserWindow, session, ipcMain, window });
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
