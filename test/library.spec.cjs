const { test, expect } = require("@playwright/test");
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).toHaveCount(3);
});
test("renders complete interface without runtime errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your library" }),
  ).toBeVisible();
  await expect(page.getByText("Browser preview. Launch")).toBeVisible();
  await page.screenshot({ path: "/tmp/waveform-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("favorites, metadata and shortcuts persist across reload", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Edit Bass hit" }).click();
  await page.locator("#soundName").fill("My bass");
  await page.locator("#soundKey").press("Control+Alt+B");
  await page.getByRole("button", { name: "Save sound" }).click();
  await page
    .getByRole("button", { name: "Favorite My bass", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unfavorite My bass", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".card").filter({ hasText: "My bass" }),
  ).toContainText("Ctrl/⌘+Alt+B");
  await page.locator("[data-view=favorites]").click();
  await expect(page.locator(".card")).toHaveCount(2);
});
test("looping clips play, focused hotkey stops and stop-all works", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Edit Bass hit" }).click();
  await page.locator("#clipLoop").check();
  await page.getByRole("button", { name: "Save sound" }).click();
  await page
    .getByRole("button", { name: "Play Bass hit", exact: true })
    .click();
  await expect(page.locator(".card.playing")).toHaveCount(1);
  await expect(page.locator("#nowTitle")).toHaveText("Bass hit");
  await page.keyboard.press("Control+Shift+S");
  await expect(page.locator(".card.playing")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Play Bass hit", exact: true })
    .click();
  await page.locator("#stopAll").click();
  await expect(page.locator("#nowTitle")).toHaveText("Nothing playing");
});
test("valid WAV import persists while invalid audio is rejected", async ({
  page,
}) => {
  const buffer = Buffer.alloc(44 + 16000);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(16000, 40);
  for (let i = 0; i < 8000; i++)
    buffer.writeInt16LE(
      Math.sin((i * 2 * Math.PI * 440) / 8000) * 8000,
      44 + i * 2,
    );
  await page.locator("#files").setInputFiles({
    name: "Imported chime.wav",
    mimeType: "audio/wav",
    buffer,
  });
  await expect(page.locator(".card")).toHaveCount(4);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Play Imported chime", exact: true }),
  ).toBeVisible();
  await page.locator("#files").setInputFiles({
    name: "broken.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("not audio"),
  });
  await expect(page.locator(".toast")).toContainText("import failed");
  await expect(page.locator(".card")).toHaveCount(4);
});
test("microphone capture, voice filters and preferences work", async ({
  page,
}) => {
  await page.locator("#mic").check();
  await expect(page.locator("#mic")).toBeChecked();
  await expect(page.locator("#mute")).toHaveText("◉ Mic live");
  await expect(page.locator(".toast")).toHaveCount(0);
  await page.locator("[data-effect=radio]").click();
  await expect(page.locator("[data-effect=radio]")).toHaveClass("active");
  await page.locator("#mute").click();
  await expect(page.locator("#mute")).toHaveText("◉ Mic muted");
  await page.locator("#mic").uncheck();
  await page.locator("#customize").click();
  await page.locator("#compact").check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator("body")).toHaveClass("compact");
  await expect(page.locator("#mic")).not.toBeChecked();
  await expect(page.locator("[data-effect=radio]")).toHaveClass("active");
});
test("search, shortcut collisions and deletion behave correctly", async ({
  page,
}) => {
  await page.locator("#search").fill("bass");
  await expect(page.locator(".card")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit Bass hit" }).click();
  await page.locator("#soundKey").press("Control+Shift+1");
  await expect(page.locator(".toast")).toContainText("already assigned");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(0);
  await page.locator("#search").fill("");
  await expect(page.locator(".card")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".card")).toHaveCount(2);
});
test("routed mix contains clip audio and master zero silences it", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { Mixer } = await import("/src/audio.js");
    const { demoSound } = await import("/src/storage.js");
    const mixer = new Mixer(() => {});
    await mixer.configure({
      master: 100,
      soundVolume: 100,
      micVolume: 100,
      monitor: false,
      routing: false,
      effect: "clean",
      delay: 100,
      delayWet: 0,
    });
    const analyser = mixer.ctx.createAnalyser();
    mixer.limiter.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    const sound = {
      id: "signal-test",
      blob: demoSound(2),
      loop: true,
      volume: 100,
    };
    await mixer.play(sound);
    await new Promise((r) => setTimeout(r, 120));
    analyser.getFloatTimeDomainData(data);
    const loud = Math.max(...data.map(Math.abs));
    await mixer.configure({ ...mixer.settings, master: 0 });
    await new Promise((r) => setTimeout(r, 120));
    analyser.getFloatTimeDomainData(data);
    const silent = Math.max(...data.map(Math.abs));
    mixer.stopAll();
    mixer.output.pause();
    await mixer.ctx.close();
    return { loud, silent };
  });
  expect(result.loud).toBeGreaterThan(0.01);
  expect(result.silent).toBeLessThan(0.001);
});
test("denied microphone permission returns to disabled state with explanation", async ({
  page,
}) => {
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  await page.locator("#mic").check();
  await expect(page.locator("#mic")).not.toBeChecked();
  await expect(page.locator(".toast")).toContainText(
    "Microphone unavailable: Permission denied",
  );
});
test("stop-all cancels decoding clips before they can start", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { Mixer } = await import("/src/audio.js");
    const { demoSound } = await import("/src/storage.js");
    const mixer = new Mixer(() => {});
    await mixer.configure({
      master: 100,
      soundVolume: 100,
      micVolume: 100,
      monitor: false,
      routing: false,
      effect: "clean",
      delay: 100,
      delayWet: 0,
    });
    const bytes = await demoSound(1).arrayBuffer();
    let release, started;
    const decoding = new Promise((resolve) => {
      started = resolve;
    });
    const sound = {
      id: "slow",
      loop: true,
      blob: {
        size:bytes.byteLength,
        type:"audio/wav",
        arrayBuffer: () => {
          started();
          return new Promise((resolve) => {
            release = resolve;
          });
        },
      },
    };
    const playing = mixer.play(sound);
    await decoding;
    mixer.stopAll();
    release(bytes);
    await playing;
    const result = { active: mixer.active.size, pending: mixer.pending.size };
    await mixer.ctx.close();
    return result;
  });
  expect(result).toEqual({ active: 0, pending: 0 });
});
test("missing saved devices fall back to local playback", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "waveform-settings",
      JSON.stringify({ output: "missing-device" }),
    ),
  );
  await page.reload();
  await expect(page.locator("#audioStatus")).toContainText(
    "saved device is unavailable",
  );
  await expect(page.locator("#output")).toHaveValue("");
  await page.getByRole("button", { name: "Edit Bass hit" }).click();
  await page.locator("#clipLoop").check();
  await page.getByRole("button", { name: "Save sound" }).click();
  await page
    .getByRole("button", { name: "Play Bass hit", exact: true })
    .click();
  await expect(page.locator("#nowTitle")).toHaveText("Bass hit");
  await expect(page.locator(".toast")).toHaveCount(0);
});
test("Windows cable guide opens downloads and reports installer launch accurately", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.desktop = {
      platform: "win32",
      setShortcuts: async (entries) => entries.map((e) => ({ ...e, ok: true })),
      onShortcut: () => {},
      downloadCable: async () => {
        window.downloadOpened = true;
      },
      installCable: async () => ({ status: "launched" }),
    };
  });
  await page.reload();
  await page.locator("#routingHelp").click();
  await expect(page.locator("#cableSetup")).toBeVisible();
  await page.locator("#downloadCable").click();
  expect(await page.evaluate(() => window.downloadOpened)).toBe(true);
  await page.locator("#installCable").click();
  await expect(page.locator("#cableStatus")).toContainText(
    "Driver installer launched. Complete its setup",
  );
  await page.evaluate(() => {
    window.desktop.installCable = async () => {
      throw new Error("Invalid driver signature");
    };
  });
  await page.locator("#installCable").click();
  await expect(page.locator("#cableStatus")).toHaveText(
    "Invalid driver signature",
  );
  await expect(page.locator("#installCable")).toBeEnabled();
});
