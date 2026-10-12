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
    await this.ctx.resume();
  }
  async configure(settings) {
    await this.init();
    this.settings = settings;
    this.sounds.gain.value = settings.soundVolume / 100;
    this.master.gain.value = settings.master / 100;
    this.monitor.gain.value = settings.monitor
      ? settings.monitorVolume / 100
      : 0;
    this.voice.gain.value = this.muted ? 0 : settings.micVolume / 100;
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
          echoCancellation: false,
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
    this.mic.disconnect();
    for (const node of this.effects || []) node.disconnect();
    const filter = this.ctx.createBiquadFilter();
    const distortion = this.ctx.createWaveShaper();
    const delay = this.ctx.createDelay(1);
    const wet = this.ctx.createGain();
    filter.type =
      this.settings.effect === "radio"
        ? "bandpass"
        : this.settings.effect === "dark"
          ? "lowpass"
          : "highpass";
    filter.frequency.value =
      this.settings.effect === "radio"
        ? 1600
        : this.settings.effect === "dark"
          ? 700
          : 80;
    filter.Q.value = this.settings.effect === "radio" ? 1.5 : 0.7;
    const amount = this.settings.effect === "robot" ? 35 : 0;
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i * 2) / (curve.length - 1) - 1;
      curve[i] = amount ? ((1 + amount) * x) / (1 + amount * Math.abs(x)) : x;
    }
    distortion.curve = curve;
    distortion.oversample = "4x";
    this.mic.connect(filter);
    filter.connect(distortion);
    distortion.connect(this.voice);
    delay.delayTime.value = this.settings.delay / 1000;
    wet.gain.value = this.settings.delayWet / 100;
    distortion.connect(delay);
    delay.connect(wet);
    wet.connect(this.voice);
    this.effects = [filter, distortion, delay, wet];
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
        buffer = await this.ctx.decodeAudioData(await sound.blob.arrayBuffer());
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
        : (this.settings?.micVolume ?? 100) / 100;
    return this.muted;
  }
}
