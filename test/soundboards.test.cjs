const { test } = require("node:test");
const assert = require("node:assert/strict");
test("soundboard browsing validates query and exact HTTPS provider", async () => {
  const m = await import("../shared/soundboards.mjs");
  assert.equal(
    new URL(m.libraryURL("vine boom")).searchParams.get("name"),
    "vine boom",
  );
  assert.throws(() => m.libraryURL("a".repeat(121)));
  for (const url of [
    "http://www.myinstants.com/",
    "https://www.myinstants.com.evil.org/",
    "https://user@www.myinstants.com/",
    "https://localhost/",
  ])
    assert.equal(m.isLibraryURL(url), false);
});
test("downloads only bounded audio on the provider", async () => {
  const m = await import("../shared/soundboards.mjs");
  for (const url of [
    "https://evil.org/a.mp3",
    "https://www.myinstants.com/en/search/",
    "https://www.myinstants.com/media/sounds/a.exe",
  ])
    assert.throws(() => m.audioURL(url));
  const clip = await m.downloadBoardClip(
    "https://www.myinstants.com/media/sounds/bruh.mp3",
    async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "audio/mpeg" },
      }),
  );
  assert.deepEqual([...clip.bytes], [1, 2, 3]);
  await assert.rejects(
    m.downloadBoardClip(
      "https://www.myinstants.com/media/sounds/a.mp3",
      async () => new Response("error", { status: 503 }),
    ),
    /503/,
  );
  await assert.rejects(
    m.downloadBoardClip(
      "https://www.myinstants.com/media/sounds/a.mp3",
      async () =>
        new Response("x", { headers: { "content-length": 30 * 1024 * 1024 } }),
    ),
    /20 MB/,
  );
});
