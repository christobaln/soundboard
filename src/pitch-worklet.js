// Dual overlapping delay windows shift pitch without changing microphone speed.
// This trades roughly 40–100 ms of processing delay for continuous live audio.
class WaveformVoiceProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "pitch",
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: "k-rate",
      },
      {
        name: "gate",
        defaultValue: -100,
        minValue: -100,
        maxValue: -10,
        automationRate: "k-rate",
      },
    ];
  }
  constructor() {
    super();
    this.buffer = new Float32Array(32768);
    this.write = 0;
    this.phase = 0;
    this.envelope = 0;
    this.gain = 1;
  }
  read(delay) {
    let index = (this.write - delay + this.buffer.length) % this.buffer.length;
    const left = Math.floor(index),
      mix = index - left;
    return (
      this.buffer[left] * (1 - mix) +
      this.buffer[(left + 1) % this.buffer.length] * mix
    );
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output?.length) return true;
    const pitch = parameters.pitch[0],
      ratio = Math.pow(2, pitch / 12),
      window = Math.min(sampleRate * 0.06, this.buffer.length / 2),
      base = Math.min(sampleRate * 0.04, this.buffer.length / 4),
      threshold =
        parameters.gate[0] <= -99 ? 0 : Math.pow(10, parameters.gate[0] / 20);
    const attack = Math.exp(-1 / (sampleRate * 0.005)),
      release = Math.exp(-1 / (sampleRate * 0.08));
    for (let i = 0; i < output[0].length; i++) {
      let sample = 0;
      for (const channel of input || [])
        sample += (channel[i] || 0) / (input.length || 1);
      const level = Math.abs(sample);
      this.envelope = Math.max(level, this.envelope * release);
      const target = this.envelope >= threshold ? 1 : 0;
      const coefficient = target > this.gain ? attack : release;
      this.gain = target + (this.gain - target) * coefficient;
      this.buffer[this.write] = sample;
      let value = sample;
      if (Math.abs(pitch) > 0.001) {
        const other = (this.phase + 0.5) % 1;
        const weight = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.phase);
        value =
          this.read(base + this.phase * window) * weight +
          this.read(base + other * window) * (1 - weight);
        this.phase = (this.phase + (1 - ratio) / window + 1) % 1;
      }
      for (const channel of output) channel[i] = value * this.gain;
      this.write = (this.write + 1) % this.buffer.length;
    }
    return true;
  }
}
registerProcessor("waveform-voice", WaveformVoiceProcessor);
