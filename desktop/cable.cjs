const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");
const execute = promisify(execFile);
const DOWNLOAD_URL = "https://vb-audio.com/Cable/";
function trustedDriver(signature) {
  return (
    signature.Status === "Valid" &&
    /VB[- ]?AUDIO|Vincent Burel/i.test(signature.Subject || "")
  );
}
function registerCableSetup({
  ipcMain,
  window,
  dialog,
  shell,
  platform = process.platform,
}) {
  ipcMain.handle("cable:download", async (event) => {
    if (event.sender !== window.webContents)
      throw new Error("Unauthorized window");
    await shell.openExternal(DOWNLOAD_URL);
  });
  ipcMain.handle("cable:install", async (event) => {
    if (event.sender !== window.webContents || platform !== "win32")
      throw new Error("Driver setup requires Windows");
    const selected = await dialog.showOpenDialog(window, {
      title: "Choose the extracted official VB-CABLE setup",
      properties: ["openFile"],
      filters: [{ name: "VB-CABLE installer", extensions: ["exe"] }],
    });
    if (selected.canceled) return { status: "cancelled" };
    const file = selected.filePaths[0];
    if (!/^VBCABLE_Setup(?:_x64)?\.exe$/i.test(path.basename(file)))
      throw new Error(
        "Select VBCABLE_Setup_x64.exe from the official extracted download.",
      );
    const powershell = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const env = { ...process.env, WAVEFORM_DRIVER_PATH: file };
    const result = await execute(
      powershell,
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$s = Get-AuthenticodeSignature -LiteralPath $env:WAVEFORM_DRIVER_PATH; @{Status=$s.Status.ToString(); Subject=$s.SignerCertificate.Subject} | ConvertTo-Json -Compress",
      ],
      { env, windowsHide: true, timeout: 30000 },
    );
    const signature = JSON.parse(result.stdout);
    if (!trustedDriver(signature))
      throw new Error(
        "The installer does not have a valid trusted VB-Audio signature. Download a fresh copy from the official site.",
      );
    const confirmation = await dialog.showMessageBox(window, {
      type: "question",
      title: "Install VB-CABLE",
      message: "Launch the official VB-CABLE driver installer?",
      detail: `Verified publisher: ${signature.Subject}\nWindows will request administrator approval. Follow the driver installer and restart Windows if requested.`,
      buttons: ["Cancel", "Launch installer"],
      defaultId: 0,
      cancelId: 0,
    });
    if (confirmation.response !== 1) return { status: "cancelled" };
    await execute(
      powershell,
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$ErrorActionPreference='Stop'; Start-Process -FilePath $env:WAVEFORM_DRIVER_PATH -Verb RunAs",
      ],
      { env, windowsHide: true, timeout: 60000 },
    );
    return { status: "launched" };
  });
}
module.exports = { registerCableSetup, trustedDriver, DOWNLOAD_URL };
