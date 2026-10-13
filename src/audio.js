import { decodeClip } from "./import-audio.js";
import { presetFor } from "./presets.js";
export class Mixer {
  constructor(onStatus, onMicLost = () => {}) {
    this.onStatus = onStatus;
    this.onMicLost = onMicLost;
    this.active = new Map();
    this.pending = new Map();
    this.cache = new Map();
    this.stream = null;
    this.muted = false;
  }
  async init() {
    if (this.ctx) {
      await this.ready;
      await this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.sounds = this.ctx.createGain();
    this.voice = this.ctx.createGain();
    this.master = this.ctx.createGain();
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.monitor = this.ctx.createGain();
    this.monitor.gain.value = 0.7;
    this.destination = this.ctx.createMediaStreamDestination();
    this.sounds.connect(this.master);
    this.voice.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(this.destination);
    this.sounds.connect(this.monitor);
    this.monitor.connect(this.ctx.destination);
    this.output = new Audio();
    this.output.srcObject = this.destination.stream;
    this.output.autoplay = true;
    this.output.muted = true;
    this.ready = this.ctx.audioWorklet.addModule(
      new URL("./pitch-worklet.js", import.meta.url),
    );
    await this.ready;
    await this.ctx.resume();
  }
  async configure(settings) {
    await this.init();
    this.settings = settings;
    this.sounds.gain.value =
      (settings.soundVolume / 100) *
      Math.pow(10, (settings.soundBoost || 0) / 20);
    this.master.gain.value =
      (settings.master / 100) * Math.pow(10, (settings.outputBoost || 0) / 20);
    this.monitor.gain.value = settings.monitor
      ? settings.monitorVolume / 100
      : 0;
    this.voice.gain.value = this.muted
      ? 0
      : (settings.micVolume / 100) *
        Math.pow(10, (settings.micBoost || 0) / 20);
    await this.output.setSinkId(settings.output || "");
    this.output.muted = !settings.routing;
    if (settings.routing) await this.output.play();
    this.updateVoice();
  }
  async microphone(enabled, input) {
    await this.init();
    this.stopMic();
    if (!enabled) return;
    const generation = this.micGeneration;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: input ? { exact: input } : undefined,
          echoCancellation: this.settings.echoCancellation !== false,
          noiseSuppression: this.settings.noiseSuppression,
          autoGainControl: false,
        },
      });
      if (generation !== this.micGeneration) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      stream.getTracks().forEach((track) =>
        track.addEventListener("ended", () => {
          if (this.stream === stream) {
            this.stopMic();
            this.onMicLost();
          }
        }),
      );
      this.mic = this.ctx.createMediaStreamSource(this.stream);
      this.updateVoice();
    } catch (error) {
      if (generation === this.micGeneration) this.stopMic();
      throw error;
    }
  }
  stopMic() {
    this.micGeneration = (this.micGeneration || 0) + 1;
    this.mic?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mic = null;
  }
  updateVoice() {
    if (!this.mic) return;
    const preset = presetFor(this.settings);
    if (!this.voiceNodes) {
      const filter = this.ctx.createBiquadFilter();
      const body = this.ctx.createBiquadFilter();
      body.type = "peaking";
      body.frequency.value = 250;
      body.Q.value = 0.8;
      const pitch = new AudioWorkletNode(this.ctx, "waveform-voice", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      const distortion = this.ctx.createWaveShaper();
      distortion.oversample = "4x";
      const ring = this.ctx.createGain(),
        ringDepth = this.ctx.createGain(),
        oscillator = this.ctx.createOscillator();
      oscillator.connect(ringDepth);
      ringDepth.connect(ring.gain);
      oscillator.start();
      const delay = this.ctx.createDelay(1),
        wet = this.ctx.createGain();
      filter.connect(body);
      body.connect(pitch);
      pitch.connect(distortion);
      distortion.connect(ring);
      ring.connect(this.voice);
      ring.connect(delay);
      delay.connect(wet);
      wet.connect(this.voice);
      this.voiceNodes = {
        filter,
        body,
        pitch,
        distortion,
        ring,
        ringDepth,
        oscillator,
        delay,
        wet,
      };
    }
    const {
      filter,
      body,
      pitch,
      distortion,
      ring,
      ringDepth,
      oscillator,
      delay,
      wet,
    } = this.voiceNodes;
    this.mic.disconnect();
    this.mic.connect(filter);
    filter.type = preset.filter;
    filter.frequency.setTargetAtTime(preset.cutoff, this.ctx.currentTime, 0.02);
    filter.Q.value = preset.filter === "bandpass" ? 1.5 : 0.7;
    body.gain.setTargetAtTime(preset.body, this.ctx.currentTime, 0.02);
    pitch.parameters
      .get("pitch")
      .setValueAtTime(preset.pitch, this.ctx.currentTime);
    pitch.parameters
      .get("gate")
      .setValueAtTime(
        this.settings.gateEnabled ? (this.settings.gateThreshold ?? -50) : -100,
        this.ctx.currentTime,
      );
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i * 2) / (curve.length - 1) - 1;
      curve[i] = preset.drive
        ? ((1 + preset.drive) * x) / (1 + preset.drive * Math.abs(x))
        : x;
    }
    distortion.curve = curve;
    ring.gain.setTargetAtTime(1 - preset.ring, this.ctx.currentTime, 0.02);
    ringDepth.gain.setTargetAtTime(preset.ring, this.ctx.currentTime, 0.02);
    oscillator.frequency.value = preset.ringHz;
    delay.delayTime.setTargetAtTime(
      (this.settings.delay || 180) / 1000,
      this.ctx.currentTime,
      0.02,
    );
    wet.gain.setTargetAtTime(
      (this.settings.delayWet || 0) / 100,
      this.ctx.currentTime,
      0.02,
    );
  }
  async play(sound) {
    if (this.active.has(sound.id) || this.pending.has(sound.id)) {
      this.stop(sound.id);
      return;
    }
    const request = {};
    this.pending.set(sound.id, request);
    try {
      await this.init();
      let buffer = this.cache.get(sound.id);
      if (!buffer) {
        buffer = await decodeClip(sound.blob, sound.name);
        this.cache.set(sound.id, buffer);
      }
      if (this.pending.get(sound.id) !== request) return;
      if (this.settings?.exclusive) this.stopAll();
      this.pending.delete(sound.id);
      const source = this.ctx.createBufferSource(),
        gain = this.ctx.createGain();
      source.buffer = buffer;
      source.loop = sound.loop;
      source.playbackRate.value = (sound.speed || 100) / 100;
      gain.gain.value = (sound.volume ?? 100) / 100;
      source.connect(gain);
      gain.connect(this.sounds);
      source.onended = () => {
        if (this.active.get(sound.id)?.source === source) {
          this.active.delete(sound.id);
          this.onStatus();
        }
        source.disconnect();
        gain.disconnect();
      };
      this.active.set(sound.id, { source, gain });
      source.start();
      this.onStatus();
    } finally {
      if (this.pending.get(sound.id) === request) this.pending.delete(sound.id);
    }
  }
  stop(id) {
    this.pending.delete(id);
    const item = this.active.get(id);
    if (item) {
      this.active.delete(id);
      item.source.stop();
      this.onStatus();
    }
  }
  stopAll() {
    this.pending.clear();
    for (const id of [...this.active.keys()]) this.stop(id);
  }
  mute() {
    this.muted = !this.muted;
    if (this.voice)
      this.voice.gain.value = this.muted
        ? 0
        : ((this.settings?.micVolume ?? 100) / 100) *
          Math.pow(10, (this.settings?.micBoost || 0) / 20);
    return this.muted;
  }
}
