const test = require("node:test");
const assert = require("node:assert/strict");
const { validAccelerator } = require("../desktop/shortcuts.cjs");
test("accepts supported modified shortcuts", () => {
  for (const value of [
    "CommandOrControl+Shift+1",
    "Alt+F12",
    "Control+Space",
    "CommandOrControl+Up",
  ])
    assert.equal(validAccelerator(value), true, value);
});
test("rejects bare keys, invalid syntax, unsupported keys and non-strings", () => {
  for (const value of [
    "S",
    "Ctrl+S",
    "Alt+",
    "Control+Shift",
    "Control+F25",
    "Control+Enter",
    null,
    {},
    "Shift+;",
  ])
    assert.equal(validAccelerator(value), false, String(value));
});
