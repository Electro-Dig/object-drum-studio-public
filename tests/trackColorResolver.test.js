import assert from "node:assert/strict";
import test from "node:test";

import { TrackColorResolver } from "../src/detection/trackColorResolver.js";

function trackedPad(ruleId, observedAt, overrides = {}) {
  return {
    id: "tracked-1",
    ruleId,
    instrument: ruleId === "blue" ? "slot-2" : "slot-5",
    label: ruleId === "blue" ? "宝蓝" : "天蓝",
    observedAt,
    classification: { confidence: 0.8 },
    bounds: { x: 10, y: 10, width: 10, height: 10 },
    centroid: { x: 15, y: 15 },
    color: { r: 40, g: 80, b: 220 },
    outline: [],
    ...overrides,
  };
}

test("TrackColorResolver waits for three matching observations before exposing a track", () => {
  const resolver = new TrackColorResolver({ windowSize: 5, confirmVotes: 3 });

  assert.deepEqual(resolver.update([trackedPad("blue", 0)]), []);
  assert.deepEqual(resolver.update([trackedPad("blue", 80)]), []);
  const confirmed = resolver.update([trackedPad("blue", 160)]);

  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].ruleId, "blue");
  assert.equal(confirmed[0].instrument, "slot-2");
});

test("TrackColorResolver uses a three-of-five vote and ignores one-frame color jitter after lock", () => {
  const resolver = new TrackColorResolver({ windowSize: 5, confirmVotes: 3 });

  resolver.update([trackedPad("blue", 0)]);
  resolver.update([trackedPad("sky", 80)]);
  resolver.update([trackedPad("blue", 160)]);
  const locked = resolver.update([trackedPad("blue", 240)]);
  const jittered = resolver.update([trackedPad("sky", 320, { centroid: { x: 17, y: 15 } })]);

  assert.equal(locked[0].ruleId, "blue");
  assert.equal(jittered[0].ruleId, "blue");
  assert.equal(jittered[0].instrument, "slot-2");
  assert.deepEqual(jittered[0].centroid, { x: 17, y: 15 });
});

test("TrackColorResolver ignores rejected or low-confidence color observations", () => {
  const resolver = new TrackColorResolver({ confirmVotes: 2, minConfidence: 0.2 });

  assert.deepEqual(resolver.update([trackedPad(null, 0)]), []);
  assert.deepEqual(resolver.update([trackedPad("blue", 80, {
    classification: { confidence: 0.05 },
  })]), []);
  assert.deepEqual(resolver.update([trackedPad("blue", 160)]), []);
});

test("TrackColorResolver clears voting state after the track leaves", () => {
  const resolver = new TrackColorResolver({ confirmVotes: 2 });

  resolver.update([trackedPad("blue", 0)]);
  resolver.update([]);
  const returned = resolver.update([trackedPad("blue", 160)]);

  assert.deepEqual(returned, []);
});

test("TrackColorResolver unlocks after three consecutive high-confidence observations of another color", () => {
  const resolver = new TrackColorResolver({
    confirmVotes: 3,
    switchVotes: 3,
    switchConfidence: 0.7,
  });

  resolver.update([trackedPad("blue", 0)]);
  resolver.update([trackedPad("blue", 80)]);
  resolver.update([trackedPad("blue", 160)]);
  assert.equal(resolver.update([trackedPad("sky", 240)])[0].ruleId, "blue");
  assert.equal(resolver.update([trackedPad("sky", 320)])[0].ruleId, "blue");
  const switched = resolver.update([trackedPad("sky", 400)]);

  assert.deepEqual(switched, []);
  assert.equal(resolver.update([trackedPad("sky", 480)]).length, 0);
  const reconfirmed = resolver.update([trackedPad("sky", 560)]);
  assert.equal(reconfirmed.length, 1);
  assert.equal(reconfirmed[0].ruleId, "sky");
  assert.equal(reconfirmed[0].instrument, "slot-5");
});

test("TrackColorResolver does not count tracker-held copies as fresh switch evidence", () => {
  const resolver = new TrackColorResolver({
    confirmVotes: 3,
    switchVotes: 3,
    switchConfidence: 0.7,
  });

  resolver.update([trackedPad("blue", 0)]);
  resolver.update([trackedPad("blue", 80)]);
  resolver.update([trackedPad("blue", 160)]);
  resolver.update([trackedPad("sky", 240)]);
  resolver.update([trackedPad("sky", 240)]);
  const heldAgain = resolver.update([trackedPad("sky", 240)]);

  assert.equal(heldAgain.length, 1);
  assert.equal(heldAgain[0].ruleId, "blue");
});
