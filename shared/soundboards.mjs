export const PROVIDER = "Myinstants";
export function libraryURL(query = "") {
  if (typeof query !== "string" || query.length > 120)
    throw new Error("Search must be no more than 120 characters.");
  const url = new URL(
    query.trim()
      ? "https://www.myinstants.com/en/search/"
      : "https://www.myinstants.com/en/index/us/",
  );
  if (query.trim()) url.searchParams.set("name", query.trim());
  return url.href;
}
export function isLibraryURL(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["www.myinstants.com", "myinstants.com"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}
export function audioURL(value) {
  const url = new URL(value);
  if (
    !isLibraryURL(value) ||
    !url.pathname.startsWith("/media/sounds/") ||
    !/^.*\.(mp3|wav|ogg|flac)$/i.test(url.pathname)
  )
    throw new Error(
      "Download must be an audio clip from the selected soundboard library.",
    );
  return url.href;
}
export async function downloadBoardClip(value, request = fetch) {
  const response = await request(audioURL(value), {
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw new Error(`Sound download failed (${response.status}).`);
  if (Number(response.headers.get("content-length")) > 20 * 1024 * 1024)
    throw new Error("Soundboard clip exceeds 20 MB.");
  const reader = response.body.getReader(),
    parts = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 20 * 1024 * 1024)
        throw new Error("Soundboard clip exceeds 20 MB.");
      parts.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return {
    bytes,
    mime: (response.headers.get("content-type") || "audio/mpeg").split(";")[0],
  };
}
