let database;
function openDatabase() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(new Error("Library database open failed: request timed out.")),
      5000,
    );
    const request = indexedDB.open("waveform", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("sounds", { keyPath: "id" });
    request.onsuccess = () => {
      clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Library database open failed (${request.error?.name}): ${request.error?.message}`,
        ),
      );
    };
    request.onblocked = () => {
      clearTimeout(timeout);
      reject(
        new Error(
          "Library database is blocked by another window. Quit Waveform completely and reopen it.",
        ),
      );
    };
  });
  return database;
}
async function browserStorage(operation, value) {
  const db = await openDatabase();
  let record = value;
  if (operation === "put") {
    const { blob, ...metadata } = value;
    record = { ...metadata };
    if (blob) {
      record.audioBytes = await blob.arrayBuffer();
      record.audioMime = blob.type || "audio/wav";
    }
  }
  return new Promise((resolve, reject) => {
    let tx, request;
    try {
      tx = db.transaction(
        "sounds",
        operation === "all" ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("sounds");
      request =
        operation === "all"
          ? store.getAll()
          : operation === "put"
            ? store.put(record)
            : store.delete(value);
    } catch (error) {
      reject(
        new Error(`Library storage failed (${error.name}): ${error.message}`),
      );
      return;
    }
    tx.oncomplete = () => {
      if (operation === "all")
        resolve(
          request.result.map((record) => {
            const { audioBytes, audioMime, ...sound } = record;
            return audioBytes
              ? {
                  ...sound,
                  blob: new Blob([audioBytes], {
                    type: audioMime || "audio/wav",
                  }),
                }
              : sound;
          }),
        );
      else resolve(request.result);
    };
    const failed = () =>
      reject(
        new Error(
          `Library storage failed (${tx.error?.name || request.error?.name || "transaction aborted"}): ${tx.error?.message || request.error?.message || "Could not save the audio bytes"}`,
        ),
      );
    tx.onerror = failed;
    tx.onabort = failed;
  });
}
let warning = "";
export const storageWarning = () => warning;
const hydrate = (record) => {
  const { audioBytes, audioMime, ...sound } = record;
  return {
    ...sound,
    blob: new Blob([audioBytes], { type: audioMime || "audio/wav" }),
  };
};
export async function storage(operation, value) {
  if (!window.desktop?.libraryStorage) return browserStorage(operation, value);
  const native = window.desktop.libraryStorage;
  if (operation === "all") {
    let result = await native("all");
    if (!result.migrated) {
      try {
        const legacy = await browserStorage("all");
        const ids = new Set(result.sounds.map((sound) => sound.id));
        for (const sound of legacy)
          if (!ids.has(sound.id)) await storage("put", sound);
        await native("migrated");
      } catch (error) {
        warning = `Previous library could not be read: ${error.message}. Existing database files were kept. New imports use desktop file storage.`;
      }
      result = await native("all");
    }
    return result.sounds.map(hydrate);
  }
  if (operation === "put") {
    const { blob, ...metadata } = value;
    if (!blob) throw new Error("Cannot save sound: audio is missing.");
    let audioBytes;
    try {
      audioBytes = await blob.arrayBuffer();
    } catch (error) {
      throw new Error(
        `Cannot read sound bytes for storage (${error.name}): ${error.message}`,
      );
    }
    return native("put", { ...metadata, audioBytes, audioMime: blob.type });
  }
  return native(operation, value);
}
export function demoSound(kind) {
  const rate = 22050,
    seconds = kind === 2 ? 1.1 : 0.5,
    length = Math.floor(rate * seconds);
  const bytes = new ArrayBuffer(44 + length * 2),
    v = new DataView(bytes);
  const write = (offset, text) =>
    [...text].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
  write(0, "RIFF");
  v.setUint32(4, 36 + length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, "data");
  v.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    let s;
    if (kind === 0)
      s = Math.sin(2 * Math.PI * (620 * t + 180 * t * t)) * Math.exp(-8 * t);
    else if (kind === 1)
      s =
        Math.sin(2 * Math.PI * 110 * t) * Math.exp(-12 * t) +
        Math.sin(2 * Math.PI * 55 * t) * Math.exp(-7 * t);
    else
      s =
        ((Math.sin(2 * Math.PI * 440 * t) +
          Math.sin(2 * Math.PI * 554.37 * t) +
          Math.sin(2 * Math.PI * 659.25 * t)) /
          3) *
        Math.exp(-3 * t);
    v.setInt16(44 + 2 * i, s * 18000, true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}
