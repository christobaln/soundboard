const database = new Promise((resolve, reject) => {
  const request = indexedDB.open("waveform", 1);
  request.onupgradeneeded = () =>
    request.result.createObjectStore("sounds", { keyPath: "id" });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function storage(operation, value) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      "sounds",
      operation === "all" ? "readonly" : "readwrite",
    );
    const store = tx.objectStore("sounds");
    const req =
      operation === "all"
        ? store.getAll()
        : operation === "put"
          ? store.put(value)
          : store.delete(value);
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
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
