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
    await page
      .locator("#files")
      .setInputFiles(path.join(__dirname, "fixtures/chime.mp3"));
    await expect(page.locator(".card")).toHaveCount(4);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Play chime", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit chime", exact: true }).click();
    await page.locator("#clipLoop").check();
    await page.getByRole("button", { name: "Save sound" }).click();
    await page.getByRole("button", { name: "Play chime", exact: true }).click();
    await expect(page.locator("#nowTitle")).toHaveText("chime");
    await page
      .getByRole("button", { name: "Stop all sounds", exact: true })
      .first()
      .click();
    await expect(page.locator("#nowTitle")).toHaveText("Nothing playing");
    // Exercise the real isolated browser, download interception and renderer import.
    const mp3 = [
      ...fs.readFileSync(path.join(__dirname, "fixtures/chime.mp3")),
    ];
    await app.evaluate(async ({ session }, bytes) => {
      await session
        .fromPartition("soundboard-library")
        .protocol.handle("https", (request) => {
          if (new URL(request.url).pathname.startsWith("/media/sounds/"))
            return new Response(new Uint8Array(bytes), {
              headers: {
                "content-type": "audio/mpeg",
                "content-disposition":
                  'attachment; filename="Board reaction.mp3"',
              },
            });
          return new Response(
            '<a href="https://www.myinstants.com/media/sounds/reaction.mp3" download>Download MP3</a>',
            { headers: { "content-type": "text/html" } },
          );
        });
    }, mp3);
    const childReady = app.waitForEvent("window");
    await page.evaluate(() => window.desktop.browseSoundboards("reaction", 15));
    const child = await childReady;
    await child.getByRole("link", { name: "Download MP3" }).click();
    await expect(page.locator(".card")).toHaveCount(5);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Play Board reaction", exact: true }),
    ).toBeVisible();
    await child.close();
    console.log(
      "PASS: real MP3 import, persistence and in-app browser download/import.",
    );
    await page.getByRole("button", { name: "Edit Bass hit" }).click();
    await page.locator("#clipLoop").check();
    await page.getByRole("button", { name: "Save sound" }).click();
    await expect(page.locator("#editor")).not.toBeVisible();
    const invalidSearch = await page.evaluate(() =>
      window.desktop
        .browseSoundboards("a".repeat(121), 15)
        .catch((error) => error.message),
    );
    expect(invalidSearch).toContain(
      "Search must be no more than 120 characters.",
    );
    await page.evaluate(() =>
      window.desktop.setPreferences({
        minimizeToTray: true,
        startMinimized: false,
        launchAtLogin: false,
      }),
    );
    expect(
      (await page.evaluate(() => window.desktop.preferences())).minimizeToTray,
    ).toBe(true);
    if (process.platform === "linux" && process.env.DISPLAY) {
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].close(),
      );
      expect(
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isVisible(),
        ),
      ).toBe(false);
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
