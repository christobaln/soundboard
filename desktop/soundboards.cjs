function registerSoundboards({ app, BrowserWindow, session, ipcMain, window }) {
  let browser, timer;
  const providerSession = session.fromPartition("soundboard-library");
  providerSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  const sendStatus = (message) => {
    if (!window.isDestroyed())
      window.webContents.send("library:status", message);
  };
  providerSession.on("will-download", (event, item, contents) => {
    if (!browser || contents !== browser.webContents) return;
    event.preventDefault();
    const filename = item.getFilename(),
      url = item.getURL(),
      source = browser.webContents.getURL();
    (async () => {
      const { downloadBoardClip, isLibraryURL } =
        await import("../shared/soundboards.mjs");
      if (!isLibraryURL(source)) throw new Error("Untrusted library source.");
      sendStatus(`Downloading ${filename}…`);
      const data = await downloadBoardClip(url, (url, options) =>
        providerSession.fetch(url, options),
      );
      if (window.isDestroyed()) return;
      window.webContents.send("library:clip", {
        ...data,
        name: filename,
        source: {
          provider: "Myinstants",
          url: source,
          downloadURL: url,
          author: "Community upload",
          license: "Rights vary — see the original sound page",
        },
      });
    })().catch((error) => sendStatus(`Download failed: ${error.message}`));
  });
  ipcMain.handle("library:browse", async (event, query = "", seconds = 15) => {
    if (event.sender !== window.webContents)
      throw new Error("Unauthorized window");
    if (![5, 10, 15, 30].includes(seconds))
      throw new Error("Invalid preview length");
    const { libraryURL, isLibraryURL } =
      await import("../shared/soundboards.mjs");
    const target = libraryURL(query);
    if (!browser || browser.isDestroyed()) {
      browser = new BrowserWindow({
        width: 1040,
        height: 800,
        parent: window,
        title: "Myinstants · download a clip to add it to Waveform",
        autoHideMenuBar: true,
        webPreferences: {
          session: providerSession,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      browser.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      browser.webContents.on("will-navigate", (event, url) => {
        if (!isLibraryURL(url)) event.preventDefault();
      });
      browser.webContents.on("will-redirect", (event, url) => {
        if (!isLibraryURL(url)) event.preventDefault();
      });
      browser.webContents.on("page-title-updated", (event) =>
        event.preventDefault(),
      );
      browser.webContents.on("did-fail-load", (_event, code, description) => {
        if (code !== -3)
          sendStatus(
            `Soundboard website could not load: ${description}. Your local library still works.`,
          );
      });
      browser.on("closed", () => {
        clearTimeout(timer);
        browser = null;
      });
    }
    browser.webContents.removeAllListeners("media-started-playing");
    browser.webContents.on("media-started-playing", () => {
      clearTimeout(timer);
      browser.webContents.setAudioMuted(false);
      timer = setTimeout(() => {
        if (browser && !browser.isDestroyed())
          browser.webContents.setAudioMuted(true);
      }, seconds * 1000);
    });
    browser.show();
    browser.focus();
    await browser.loadURL(target);
    return { provider: "Myinstants" };
  });
  app.on("before-quit", () => {
    clearTimeout(timer);
    if (browser && !browser.isDestroyed()) browser.destroy();
  });
}
module.exports = { registerSoundboards };
