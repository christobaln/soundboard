import { searchSounds, downloadSound } from "../shared/commons.mjs";
const request = (url, options) =>
  fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "User-Agent":
        "Waveform/0.2.0 (https://github.com/christobaln/soundboard)",
    },
  });
const result = await searchSounds("applause", 0, request);
if (!result.sounds.length)
  throw new Error("Live provider returned no usable applause audio.");
const clip = result.sounds[0];
const audio = await downloadSound(clip.url, request);
if (!audio.bytes.length) throw new Error("Live provider returned empty audio.");
console.log(
  `Live Wikimedia search/download passed: ${clip.name} · ${clip.license} · ${audio.bytes.length} bytes`,
);
