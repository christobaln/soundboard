const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const validId = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
const validAudio = (name) =>
  typeof name === "string" && /^[a-zA-Z0-9_-]+\.audio$/.test(name);
function createLibrary(directory) {
  let queue = Promise.resolve();
  const read = async (id) => {
    try {
      return JSON.parse(
        await fs.readFile(path.join(directory, `${id}.json`), "utf8"),
      );
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  };
  const atomic = async (filename, contents) => {
    const temporary = `${filename}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, contents);
      await fs.rename(temporary, filename);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  };
  const run = async (operation, value) => {
    await fs.mkdir(directory, { recursive: true });
    if (operation === "all") {
      const sounds = [];
      for (const filename of await fs.readdir(directory)) {
        if (!filename.endsWith(".json") || !validId(filename.slice(0, -5)))
          continue;
        const record = await read(filename.slice(0, -5));
        if (
          !record ||
          record.id !== filename.slice(0, -5) ||
          !validAudio(record.audioFile)
        )
          throw new Error(`Invalid saved sound record: ${filename}`);
        const { audioFile, ...metadata } = record;
        const audioBytes = await fs.readFile(path.join(directory, audioFile));
        sounds.push({ ...metadata, audioBytes });
      }
      let migrated = false;
      try {
        migrated =
          (await fs.readFile(
            path.join(directory, ".legacy-migrated"),
            "utf8",
          )) === "yes";
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      return { sounds, migrated };
    }
    if (operation === "migrated") {
      await atomic(path.join(directory, ".legacy-migrated"), "yes");
      return;
    }
    if (!validId(operation === "delete" ? value : value?.id))
      throw new Error("Invalid sound ID.");
    const id = operation === "delete" ? value : value.id;
    const previous = await read(id);
    if (operation === "delete") {
      await fs.rm(path.join(directory, `${id}.json`), { force: true });
      if (validAudio(previous?.audioFile))
        await fs
          .rm(path.join(directory, previous.audioFile), { force: true })
          .catch(() => {});
      return;
    }
    if (operation !== "put") throw new Error("Invalid library operation.");
    const { audioBytes, blob, ...metadata } = value;
    if (!(audioBytes instanceof ArrayBuffer) && !ArrayBuffer.isView(audioBytes))
      throw new Error("Missing audio bytes.");
    const bytes = ArrayBuffer.isView(audioBytes)
      ? Buffer.from(
          audioBytes.buffer,
          audioBytes.byteOffset,
          audioBytes.byteLength,
        )
      : Buffer.from(audioBytes);
    if (!bytes.length || bytes.length > 128 * 1024 * 1024 + 44)
      throw new Error("Audio bytes exceed the storage limit.");
    const audioFile = `${id}-${randomUUID()}.audio`;
    const json = JSON.stringify({ ...metadata, audioFile });
    if (Buffer.byteLength(json) > 128 * 1024)
      throw new Error("Sound metadata exceeds the storage limit.");
    await fs.writeFile(path.join(directory, audioFile), bytes, { flag: "wx" });
    try {
      await atomic(path.join(directory, `${id}.json`), json);
    } catch (error) {
      await fs
        .rm(path.join(directory, audioFile), { force: true })
        .catch(() => {});
      throw error;
    }
    if (validAudio(previous?.audioFile))
      await fs
        .rm(path.join(directory, previous.audioFile), { force: true })
        .catch(() => {});
  };
  return (operation, value) => {
    const result = queue
      .then(() => run(operation, value))
      .catch((error) => {
        throw new Error(
          `Desktop library ${operation} failed (${error.code || error.name}): ${error.message}`,
        );
      });
    queue = result.catch(() => {});
    return result;
  };
}
function registerLibrary({ app, ipcMain, window }) {
  const storage = createLibrary(
    path.join(app.getPath("userData"), "sound-library"),
  );
  ipcMain.handle("library:storage", (event, operation, value) => {
    if (event.sender !== window.webContents)
      throw new Error("Unauthorized window");
    return storage(operation, value);
  });
}
module.exports = { createLibrary, registerLibrary };
