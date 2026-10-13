const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.desktop = {
      platform: "win32",
      onShortcut: () => {},
      setShortcuts: async (entries) =>
        entries.map((entry) => ({ ...entry, ok: true })),
      browseSoundboards: async (query, seconds) => {
        window.lastBrowse = { query, seconds };
      },
      onLibraryClip: (callback) => {
        window.deliverClip = callback;
      },
      onLibraryStatus: (callback) => {
        window.libraryStatus = callback;
      },
    };
  });
  await page.goto("/");
  await expect(page.locator(".card")).toHaveCount(3);
});
test("short reaction searches open soundboard source with a configurable length cap", async ({
  page,
}) => {
  await page.locator("#catalogButton").click();
  await page.locator("#libraryClipSeconds").selectOption("5");
  await page.getByRole("button", { name: "vine boom", exact: true }).click();
  expect(await page.evaluate(() => window.lastBrowse)).toEqual({
    query: "vine boom",
    seconds: 5,
  });
  await expect(page.locator("#catalogStatus")).toContainText("Download MP3");
});
test("a selected library MP3 is decoded, saved with credits and persists", async ({
  page,
}) => {
  const bytes = [
    ...fs.readFileSync(path.join(__dirname, "fixtures/chime.mp3")),
  ];
  await page.evaluate(
    (bytes) =>
      window.deliverClip({
        bytes: new Uint8Array(bytes),
        name: "Reaction.mp3",
        mime: "audio/mpeg",
        source: {
          provider: "Myinstants",
          url: "https://www.myinstants.com/en/instant/reaction-123/",
          downloadURL: "https://www.myinstants.com/media/sounds/reaction.mp3",
          author: "Community upload",
          license: "Rights vary — see source",
        },
      }),
    bytes,
  );
  await expect(page.locator(".card")).toHaveCount(4);
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Reaction", exact: true })
    .click();
  await expect(page.locator("#clipAttribution")).toContainText("Myinstants");
  await expect(page.locator("#clipAttribution")).toContainText("Rights vary");
});
test("long decoded library clips are capped at fifteen seconds", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { prepareClip, encodeWave } = await import("/src/import-audio.js");
    const buffer = new AudioBuffer({
      length: 44100 * 20,
      sampleRate: 44100,
      numberOfChannels: 1,
    });
    const clip = await prepareClip(encodeWave(buffer), "long.wav", 15);
    const ctx = new OfflineAudioContext(1, 1, 44100);
    return (await ctx.decodeAudioData(await clip.blob.arrayBuffer())).duration;
  });
  expect(result).toBeCloseTo(15, 2);
});
test("network feedback leaves saved clips usable", async ({ page }) => {
  await page.locator("#catalogButton").click();
  await page.evaluate(() => window.libraryStatus("Download failed (503)"));
  await expect(page.locator("#catalogStatus")).toContainText("503");
  await page.locator("#catalogClose").click();
  await expect(page.locator(".card")).toHaveCount(3);
});
test("character presets, audio boosts and Times New Roman persist", async ({
  page,
}) => {
  await page.locator("#mic").check();
  await expect(page.locator("#mute")).toHaveText("◉ Mic live");
  await page.locator("#voicePreset").selectOption("venom");
  await expect(page.locator("#voicePitch")).toHaveValue("-10");
  await page.locator("#customize").click();
  await page.locator("#micBoost").fill("12");
  await page.locator("#gateEnabled").check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator("#voicePreset")).toHaveValue("venom");
  await page.locator("#customize").click();
  await expect(page.locator("#micBoost")).toHaveValue("12");
  await expect(page.locator("#gateEnabled")).toBeChecked();
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Times New Roman");
});
