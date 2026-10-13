import { MPEGDecoderWebWorker } from "mpg123-decoder";
const MAX_BYTES = 50 * 1024 * 1024;
export function encodeWave(buffer, maxSeconds = 600) {
  const frames = Math.min(
    buffer.length,
    Math.floor(buffer.sampleRate * maxSeconds),
  );
  const channels = buffer.numberOfChannels,
    size = frames * channels * 2;
  if (size > 128 * 1024 * 1024)
    throw new Error("Decoded audio is too large. Use a shorter clip.");
  const bytes = new ArrayBuffer(44 + size),
    view = new DataView(bytes);
  const text = (offset, value) =>
    [...value].forEach((char, i) =>
      view.setUint8(offset + i, char.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, 36 + size, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, size, true);
  const data = Array.from({ length: channels }, (_, channel) =>
    buffer.getChannelData(channel),
  );
  let offset = 44;
  for (let i = 0; i < frames; i++)
    for (const channel of data) {
      const value = Math.max(-1, Math.min(1, channel[i]));
      view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true);
      offset += 2;
    }
  return new Blob([bytes], { type: "audio/wav" });
}
export async function decodeClip(blob, name = "", maxSeconds = 600) {
  if (!blob?.size)
    throw new Error("This audio file is empty. Download it again.");
  if (blob.size > 128 * 1024 * 1024 + 44)
    throw new Error("Decoded audio exceeds the playback size limit.");
  let bytes;
  try {
    bytes = new Uint8Array(await blob.arrayBuffer());
  } catch (error) {
    throw new Error(
      `Cannot read the selected file (${error.name}). Copy it to a local folder and try again.`,
    );
  }
  const prefix = new TextDecoder().decode(bytes.subarray(0, 200)).trimStart();
  if (/^(?:<!doctype|<html|<head|<body|\{"(?:error|message)")/i.test(prefix))
    throw new Error(
      "This file contains a web page or download error, not audio. Download the actual sound file.",
    );
  const nativeHeader = /^(?:RIFF|OggS|fLaC)/.test(prefix);
  const isMp3 =
    !nativeHeader &&
    (/mpeg|mp3/i.test(blob.type) ||
      /\.mp3$/i.test(name) ||
      prefix.startsWith("ID3") ||
      (bytes[0] === 255 && (bytes[1] & 224) === 224));
  if (isMp3) {
    let decoder;
    try {
      decoder = new MPEGDecoderWebWorker();
    } catch (error) {
      throw new Error(
        `MP3 decoder could not start (${error.name}): ${error.message}`,
      );
    }
    const parts = [];
    let length = 0,
      sampleRate = 0,
      channels = 0;
    let timeout;
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Decoder timed out. Try a shorter MP3.")),
        60000,
      );
    });
    const bounded = (operation) => Promise.race([operation, deadline]);
    try {
      await bounded(decoder.ready);
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        const decoded = await bounded(
          decoder.decode(bytes.subarray(offset, offset + 65536)),
        );
        if (!decoded.samplesDecoded) continue;
        sampleRate = decoded.sampleRate;
        channels = decoded.channelData.length;
        length += decoded.samplesDecoded;
        parts.push(decoded.channelData);
        if (length / sampleRate >= maxSeconds) break;
      }
      if (!length || !sampleRate || !channels)
        throw new Error(
          "No readable MP3 frames found. The file may be incomplete or damaged.",
        );
      const frames = Math.min(length, Math.floor(sampleRate * maxSeconds));
      const buffer = new AudioBuffer({
        length: frames,
        sampleRate,
        numberOfChannels: channels,
      });
      let offset = 0;
      for (const part of parts) {
        const count = Math.min(part[0].length, frames - offset);
        if (count <= 0) break;
        for (let channel = 0; channel < channels; channel++)
          buffer.copyToChannel(
            part[channel].subarray(0, count),
            channel,
            offset,
          );
        offset += count;
      }
      return buffer;
    } catch (error) {
      throw new Error(`MP3 decoding failed: ${error.message}`);
    } finally {
      clearTimeout(timeout);
      decoder.terminate();
    }
  }
  try {
    const context = new OfflineAudioContext(2, 1, 44100);
    const buffer = await context.decodeAudioData(bytes.buffer);
    return buffer;
  } catch (error) {
    throw new Error(
      `Audio decoding failed (${error.name || "unsupported format"}): ${error.message}. Try a WAV, MP3, OGG, or FLAC file.`,
    );
  }
}
export async function prepareClip(blob, name = "", maxSeconds = 600) {
  if (blob?.size > MAX_BYTES)
    throw new Error("Maximum audio file size is 50 MB.");
  const buffer = await decodeClip(blob, name, maxSeconds);
  try {
    return {
      blob: encodeWave(buffer, maxSeconds),
      duration: Math.min(buffer.duration, maxSeconds),
      buffer,
    };
  } catch (error) {
    throw new Error(
      `Could not prepare the sound for saving (${error.name}): ${error.message}`,
    );
  }
}
