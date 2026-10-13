const { test, expect } = require("@playwright/test");
const path = require("node:path");
test("MP3 import uses bundled decoding, stores owned bytes, persists and plays", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".card")).toHaveCount(3);
  await page.evaluate(() => {
    window.nativeDecode = OfflineAudioContext.prototype.decodeAudioData;
    OfflineAudioContext.prototype.decodeAudioData = () =>
      Promise.reject(new Error("Internal error"));
  });
  await page
    .locator("#files")
    .setInputFiles(path.join(__dirname, "fixtures/chime.mp3"));
  await expect(page.locator(".card")).toHaveCount(4);
  const record = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("waveform");
        req.onsuccess = () => {
          const tx = req.result.transaction("sounds");
          const all = tx.objectStore("sounds").getAll();
          all.onsuccess = () => {
            const item = all.result.find((item) => item.name === "chime");
            resolve({
              raw: item.audioBytes instanceof ArrayBuffer,
              file: item.blob instanceof File,
              mime: item.audioMime,
            });
            req.result.close();
          };
        };
      }),
  );
  expect(record).toEqual({ raw: true, file: false, mime: "audio/wav" });
  await page.reload();
  await page.getByRole("button", { name: "Edit chime", exact: true }).click();
  await page.locator("#clipLoop").check();
  await page.getByRole("button", { name: "Save sound" }).click();
  await page.getByRole("button", { name: "Play chime", exact: true }).click();
  await expect(page.locator("#nowTitle")).toHaveText("chime");
});
test("HTML downloads disguised as MP3 receive a useful error", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".card")).toHaveCount(3);
  await page.locator("#files").setInputFiles({
    name: "bad.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("<!doctype html><html>Download failed</html>"),
  });
  await expect(page.locator(".toast")).toContainText(
    "web page or download error",
  );
  await expect(page.locator(".card")).toHaveCount(3);
});
