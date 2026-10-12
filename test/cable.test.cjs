const test = require("node:test");
const assert = require("node:assert/strict");
const { trustedDriver } = require("../desktop/cable.cjs");
test("requires both a valid signature and an identified VB-Audio publisher", () => {
  assert.equal(
    trustedDriver({ Status: "Valid", Subject: "CN=VB-AUDIO Software" }),
    true,
  );
  assert.equal(
    trustedDriver({ Status: "Valid", Subject: "CN=Vincent Burel" }),
    true,
  );
  for (const value of [
    { Status: "NotSigned", Subject: "CN=VB-AUDIO Software" },
    { Status: "HashMismatch", Subject: "CN=Vincent Burel" },
    { Status: "Valid", Subject: "CN=Other publisher" },
    { Status: "Valid" },
  ])
    assert.equal(trustedDriver(value), false);
});
