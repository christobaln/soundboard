const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function processor() {
  let Voice;
  vm.runInNewContext(fs.readFileSync("src/pitch-worklet.js", "utf8"), {
    AudioWorkletProcessor: class {},
    sampleRate: 48000,
    Float32Array,
    Math,
    registerProcessor: (_name, value) => {
      Voice = value;
    },
  });
  return new Voice();
}
function render(pitch, amplitude = 0.3, gate = -100) {
  const voice = processor(),
    output = new Float32Array(48000);
  for (let base = 0; base < output.length; base += 128) {
    const input = new Float32Array(128),
      block = new Float32Array(128);
    for (let i = 0; i < 128; i++)
      input[i] = Math.sin(((base + i) * 2 * Math.PI * 440) / 48000) * amplitude;
    voice.process([[input]], [[block]], { pitch: [pitch], gate: [gate] });
    output.set(block, base);
  }
  return output;
}
test("clean preset preserves the input waveform", () => {
  const output = render(0);
  for (let i = 0; i < output.length; i++)
    assert.ok(
      Math.abs(output[i] - Math.sin((i * 2 * Math.PI * 440) / 48000) * 0.3) <
        1e-6,
    );
});
test("one-octave voice shift lowers the measured fundamental", () => {
  const output = render(-12);
  let crossings = 0;
  for (let i = 12001; i < output.length; i++)
    if (output[i - 1] < 0 && output[i] >= 0) crossings++;
  const hz = crossings / 0.75;
  assert.ok(hz > 200 && hz < 240, `Measured pitch: ${hz}`);
  assert.ok(output.every(Number.isFinite));
});
test("noise gate attenuates quiet input and preserves speech above threshold", () => {
  const quiet = render(0, 0.0001, -40);
  assert.ok(Math.max(...quiet.slice(-4000).map(Math.abs)) < 1e-7);
  const loud = render(0, 0.3, -40);
  assert.ok(Math.max(...loud.slice(-4000).map(Math.abs)) > 0.25);
});
