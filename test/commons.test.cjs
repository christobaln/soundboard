const test = require("node:test");
const assert = require("node:assert/strict");
const library = import("../shared/commons.mjs");
const item = {
  pageid: 12,
  index: 1,
  title: "File:Applause.ogg",
  imageinfo: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/1/12/Applause.ogg",
      descriptionurl: "https://commons.wikimedia.org/wiki/File:Applause.ogg",
      mime: "audio/ogg",
      size: 200,
      extmetadata: {
        Artist: { value: '<a href="x">Alice</a>' },
        LicenseShortName: { value: "CC BY 4.0" },
      },
    },
  ],
};
test("normalizes audio with credits and filters unsupported/untrusted results", async () => {
  const { normalizeResults } = await library;
  const results = normalizeResults({
    query: {
      pages: {
        12: item,
        13: {
          ...item,
          imageinfo: [
            { ...item.imageinfo[0], url: "https://example.com/file.ogg" },
          ],
        },
        14: {
          ...item,
          imageinfo: [{ ...item.imageinfo[0], mime: "image/png" }],
        },
      },
    },
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].author, "Alice");
  assert.equal(results[0].license, "CC BY 4.0");
});
test("search uses a bounded, encoded public API request and preserves pagination", async () => {
  const { searchSounds } = await library;
  const result = await searchSounds("applause", 12, async (url) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("gsrsearch"), "applause filetype:audio");
    assert.equal(params.get("gsroffset"), "12");
    return new Response(
      JSON.stringify({
        query: { pages: { 12: item } },
        continue: { gsroffset: 24 },
      }),
    );
  });
  assert.equal(result.sounds.length, 1);
  assert.equal(result.nextOffset, 24);
});
test("rejects unsafe URLs, wrong MIME and oversized downloads", async () => {
  const { mediaURL, downloadSound } = await library;
  for (const value of [
    "http://upload.wikimedia.org/wikipedia/commons/a",
    "https://upload.wikimedia.org.evil.test/wikipedia/commons/a",
    "https://user:pass@upload.wikimedia.org/wikipedia/commons/a",
    "https://upload.wikimedia.org:8443/wikipedia/commons/a",
  ])
    assert.throws(() => mediaURL(value));
  await assert.rejects(
    downloadSound(
      item.imageinfo[0].url,
      async () =>
        new Response("<html>", { headers: { "content-type": "text/html" } }),
    ),
    /audio file/,
  );
  await assert.rejects(
    downloadSound(
      item.imageinfo[0].url,
      async () =>
        new Response("x", {
          headers: {
            "content-type": "audio/ogg",
            "content-length": String(51 * 1024 * 1024),
          },
        }),
    ),
    /too large/,
  );
});
test("reports upstream errors without treating them as empty results", async () => {
  const { searchSounds } = await library;
  await assert.rejects(
    searchSounds(
      "test",
      0,
      async () => new Response("blocked", { status: 403 }),
    ),
    /403/,
  );
  await assert.rejects(
    searchSounds(
      "test",
      0,
      async () =>
        new Response(JSON.stringify({ error: { info: "Unavailable" } })),
    ),
    /Unavailable/,
  );
});
