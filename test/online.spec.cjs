const { test, expect } = require("@playwright/test");
function wav() {
  const data = Buffer.alloc(44 + 16000);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24);
  data.writeUInt32LE(16000, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(16000, 40);
  for (let i = 0; i < 8000; i++)
    data.writeInt16LE(
      Math.sin((i * 2 * Math.PI * 440) / 8000) * 8000,
      44 + i * 2,
    );
  return data;
}
const url =
  "https://upload.wikimedia.org/wikipedia/commons/a/ab/Test_chime.wav";
const response = {
  query: {
    pages: {
      1: {
        pageid: 1,
        index: 1,
        title: "File:Test chime.wav",
        imageinfo: [
          {
            url,
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Test_chime.wav",
            size: 16044,
            mime: "audio/wav",
            extmetadata: {
              Artist: { value: "<a>Test author</a>" },
              LicenseShortName: { value: "CC BY 4.0" },
            },
          },
        ],
      },
    },
  },
};
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).toHaveCount(3);
});
test("search downloads a decoded clip with persistent license credits", async ({
  page,
}) => {
  await page.route("https://commons.wikimedia.org/w/api.php?**", (route) =>
    route.fulfill({
      json: response,
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route(url, (route) =>
    route.fulfill({
      body: wav(),
      contentType: "audio/wav",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.locator("#catalogButton").click();
  await page.locator("#catalogQuery").fill("chime");
  await page
    .getByRole("button", { name: "Search library", exact: true })
    .click();
  await expect(page.locator(".catalog-result")).toHaveCount(1);
  await expect(page.locator(".catalog-result")).toContainText("CC BY 4.0");
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await expect(page.locator(".card")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Added ✓", exact: true }),
  ).toBeVisible();
  await page.locator("#catalogClose").click();
  await page.reload();
  await page.getByRole("button", { name: "Edit Test chime" }).click();
  await expect(page.locator("#clipAttribution")).toContainText("CC BY 4.0");
  await expect(page.locator("#clipAttribution")).toContainText("Test author");
  await page.locator("#clipLoop").check();
  await page.getByRole("button", { name: "Save sound" }).click();
  await page
    .getByRole("button", { name: "Play Test chime", exact: true })
    .click();
  await expect(page.locator("#nowTitle")).toHaveText("Test chime");
});
test("network errors explain the failure while local sounds remain available", async ({
  page,
}) => {
  await page.route("https://commons.wikimedia.org/w/api.php?**", (route) =>
    route.fulfill({
      status: 503,
      body: "Unavailable",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.locator("#catalogButton").click();
  await page.locator("#catalogQuery").fill("chime");
  await page
    .getByRole("button", { name: "Search library", exact: true })
    .click();
  await expect(page.locator("#catalogStatus")).toContainText("503");
  await expect(page.locator("#catalogStatus")).toContainText(
    "saved clips still work offline",
  );
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
  await expect(page.locator("#voiceDrive")).toHaveValue("22");
  await page.locator("#voicePitch").fill("-8");
  await page.locator("#customize").click();
  await page.locator("#micBoost").fill("12");
  await page.locator("#gateEnabled").check();
  await page.locator("#reduceMotion").check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator("#voicePreset")).toHaveValue("venom");
  await expect(page.locator("#voicePitch")).toHaveValue("-8");
  await page.locator("#customize").click();
  await expect(page.locator("#micBoost")).toHaveValue("12");
  await expect(page.locator("#gateEnabled")).toBeChecked();
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Times New Roman");
});
