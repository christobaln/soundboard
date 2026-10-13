const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createLibrary } = require("../desktop/library.cjs");
test("desktop bytes, edits and deletion survive new storage instances", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "waveform-files-"));
  try {
    let storage = createLibrary(dir);
    const record = {
      id: "test-clip",
      name: "Clip",
      audioMime: "audio/wav",
      audioBytes: new Uint8Array([1, 2, 3]),
      favorite: false,
    };
    await storage("put", record);
    await storage("put", { ...record, favorite: true });
    storage = createLibrary(dir);
    const data = await storage("all");
    assert.equal(data.sounds[0].favorite, true);
    assert.deepEqual([...data.sounds[0].audioBytes], [1, 2, 3]);
    assert.equal(
      (await fs.readdir(dir)).filter((name) => name.endsWith(".audio")).length,
      1,
    );
    await storage("migrated");
    assert.equal((await createLibrary(dir)("all")).migrated, true);
    await storage("delete", record.id);
    assert.equal((await createLibrary(dir)("all")).sounds.length, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("desktop storage rejects traversal, missing bytes, and reports disk failures", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "waveform-validation-"));
  try {
    const storage = createLibrary(dir);
    await assert.rejects(
      storage("put", { id: "../escape", audioBytes: new Uint8Array([1]) }),
      /Invalid sound ID/,
    );
    await assert.rejects(storage("delete", "../escape"), /Invalid sound ID/);
    await assert.rejects(storage("put", { id: "clip" }), /Missing audio bytes/);
    await storage("put", {
      id: "valid",
      audioBytes: new Uint8Array([5]),
      name: "Still works",
    });
    assert.equal((await storage("all")).sounds.length, 1);
    const file = path.join(dir, "file");
    await fs.writeFile(file, "x");
    await assert.rejects(
      createLibrary(file)("all"),
      /Desktop library all failed \((?:EEXIST|ENOTDIR)\)/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
