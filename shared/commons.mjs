export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const API = "https://commons.wikimedia.org/w/api.php";
export function mediaURL(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "upload.wikimedia.org" ||
    !url.pathname.startsWith("/wikipedia/commons/") ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Untrusted sound download URL");
  return url.href;
}
export function sourceURL(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "commons.wikimedia.org" ||
    !url.pathname.startsWith("/wiki/File:") ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Invalid sound source page");
  return url.href;
}
function text(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|#39);/g,
      (entity) =>
        ({
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&#39;": "'",
        })[entity],
    )
    .slice(0, 600);
}
export function normalizeResults(data) {
  if (data.error)
    throw new Error(
      data.error.info || "The sound library could not complete the search.",
    );
  return Object.values(data.query?.pages || {})
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .flatMap((page) => {
      const info = page.imageinfo?.[0];
      if (
        !info ||
        !info.mime?.startsWith("audio/") ||
        info.size > MAX_AUDIO_BYTES
      )
        return [];
      try {
        return [
          {
            id: String(page.pageid),
            name: page.title.replace(/^File:/, ""),
            url: mediaURL(info.url),
            source: sourceURL(info.descriptionurl),
            size: info.size,
            mime: info.mime,
            author: text(
              info.extmetadata?.Artist?.value ||
                info.extmetadata?.Credit?.value ||
                "See source page",
            ),
            license: text(
              info.extmetadata?.LicenseShortName?.value || "See source page",
            ),
            licenseURL: info.extmetadata?.LicenseUrl?.value || "",
          },
        ];
      } catch {
        return [];
      }
    });
}
async function readBounded(response, limit) {
  if (!response.ok)
    throw new Error(
      `Sound library request failed (${response.status}). Try again later.`,
    );
  if (Number(response.headers.get("content-length")) > limit)
    throw new Error("This download is too large. Maximum clip size is 50 MB.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit)
        throw new Error("Sound library response exceeds its size limit.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function searchSounds(query, offset = 0, request = fetch) {
  if (
    typeof query !== "string" ||
    query.trim().length < 2 ||
    query.length > 120
  )
    throw new Error("Enter between 2 and 120 characters to search.");
  if (!Number.isInteger(offset) || offset < 0 || offset > 1000)
    throw new Error("Invalid search page");
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${query.trim()} filetype:audio`,
    gsrnamespace: "6",
    gsrlimit: "12",
    gsroffset: String(offset),
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    format: "json",
    origin: "*",
  }).toString();
  const response = await request(url.href, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  const bytes = await readBounded(response, 2 * 1024 * 1024);
  const data = JSON.parse(new TextDecoder().decode(bytes));
  return {
    sounds: normalizeResults(data),
    nextOffset: data.continue?.gsroffset ?? null,
  };
}
export async function downloadSound(url, request = fetch) {
  const response = await request(mediaURL(url), {
    signal: AbortSignal.timeout(60000),
    redirect: "error",
  });
  const mime = (response.headers.get("content-type") || "").split(";")[0];
  if (
    !mime.startsWith("audio/") &&
    mime !== "application/ogg" &&
    mime !== "application/octet-stream"
  )
    throw new Error("The library did not return an audio file.");
  return { bytes: await readBounded(response, MAX_AUDIO_BYTES), mime };
}
