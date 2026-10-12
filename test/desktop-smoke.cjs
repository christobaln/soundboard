const { _electron, expect } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "waveform-smoke-"));
  let app;
  try {
    const args = [`--user-data-dir=${profile}`, "."];
    if (process.env.ELECTRON_TEST_NO_SANDBOX === "1")
      args.unshift("--no-sandbox", "--disable-gpu");
    app = await _electron.launch({ executablePath: require("electron"), args });
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await expect(page.locator(".card")).toHaveCount(3);
    expect(await page.evaluate(() => window.desktop.platform)).toBe(
      process.platform,
    );
    await expect
      .poll(() =>
        app.evaluate(({ globalShortcut }) =>
          globalShortcut.isRegistered("CommandOrControl+Shift+2"),
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Edit Bass hit" }).click();
    await page.locator("#clipLoop").check();
    await page.getByRole("button", { name: "Save sound" }).click();
    await expect(page.locator("#editor")).not.toBeVisible();
    if (process.platform === "linux" && process.env.DISPLAY) {
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].hide(),
      );
      execFileSync("python", [path.join(__dirname, "x11-hotkey.py"), "2"]);
      await expect(page.locator("#nowTitle")).toHaveText("Bass hit");
      execFileSync("python", [path.join(__dirname, "x11-hotkey.py"), "S"]);
      await expect(page.locator("#nowTitle")).toHaveText("Nothing playing");
      console.log(
        "PASS: native shortcut plays and stops audio with the desktop window hidden (X11).",
      );
    } else {
      const id = await page
        .locator("[data-play]")
        .first()
        .getAttribute("data-play");
      await app.evaluate(
        ({ BrowserWindow }, id) =>
          BrowserWindow.getAllWindows()[0].webContents.send(
            "shortcut:play",
            id,
          ),
        id,
      );
      await expect(page.locator("#nowTitle")).not.toHaveText("Nothing playing");
      console.log(
        "PASS: desktop IPC triggers playback; native background-key injection was not run on this OS.",
      );
    }
    const invalid = await page.evaluate(() =>
      window.desktop.setShortcuts([{ id: "bad", key: "S" }]),
    );
    expect(invalid).toEqual([{ id: "bad", ok: false }]);
    expect(errors).toEqual([]);
    console.log(
      "PASS: desktop rendering, native shortcut registration, IPC validation and playback.",
    );
  } finally {
    if (app) await app.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
