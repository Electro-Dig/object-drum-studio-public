import assert from "node:assert/strict";
import test from "node:test";

import { PadTracker } from "../src/detection/padTracker.js";

function pad(id, x, y, overrides = {}) {
  return {
    id,
    instrument: "kick",
    label: "Kick",
    ruleId: "kick-red",
    hue: 356,
    area: 100,
    bounds: { x, y, width: 10, height: 10 },
    centroid: { x: x + 5, y: y + 5 },
    color: { r: 240, g: 40, b: 45 },
    outline: [
      { x, y },
      { x: x + 10, y },
      { x: x + 10, y: y + 10 },
      { x, y: y + 10 },
    ],
    ...overrides,
  };
}

test("PadTracker keeps a stable id and smooths jittering detections", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    smoothing: 0.25,
    maxMatchDistance: 40,
  });

  const first = tracker.update([pad("raw-a", 10, 10)], 0)[0];
  const second = tracker.update([pad("raw-b", 18, 10)], 80)[0];

  assert.equal(second.id, first.id);
  assert.ok(second.centroid.x > first.centroid.x);
  assert.ok(second.centroid.x < 23);
});

test("PadTracker waits for repeated observations before confirming a pad", () => {
  const tracker = new PadTracker({
    confirmFrames: 2,
    smoothing: 0.5,
    maxMatchDistance: 40,
  });

  assert.equal(tracker.update([pad("raw-a", 10, 10)], 0).length, 0);
  assert.equal(tracker.update([pad("raw-b", 11, 10)], 80).length, 1);
});

test("PadTracker holds pad geometry while locked for performance", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    smoothing: 0.4,
    maxMatchDistance: 80,
  });

  const first = tracker.update([pad("raw-a", 10, 10)], 0)[0];
  const locked = tracker.update([pad("raw-b", 60, 10)], 80, { locked: true })[0];

  assert.equal(locked.id, first.id);
  assert.equal(locked.centroid.x, first.centroid.x);
});

test("PadTracker keeps recently missed pads briefly to avoid flicker", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    missingTtlMs: 250,
  });

  const first = tracker.update([pad("raw-a", 10, 10)], 0)[0];
  const held = tracker.update([], 120)[0];
  const expired = tracker.update([], 320);

  assert.equal(held.id, first.id);
  assert.equal(expired.length, 0);
});

test("PadTracker can keep one geometry track when the detected color changes", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    strictRuleMatch: false,
    maxMatchDistance: 40,
  });

  const first = tracker.update([pad("raw-a", 10, 10)], 0);
  const changed = tracker.update([pad("raw-b", 11, 10, {
    instrument: "clap",
    label: "Sky blue",
    ruleId: "sky-blue",
  })], 80);

  assert.equal(first.length, 1);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].id, first[0].id);
  assert.equal(changed[0].ruleId, "sky-blue");
  assert.equal(changed[0].observedAt, 80);
});

test("PadTracker does not transfer a color identity to a different nearby object", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    strictRuleMatch: false,
    maxMatchDistance: 64,
    maxRuleMismatchDistance: 20,
  });
  tracker.update([pad("brown", 90, 50, {
    ruleId: "brown-red",
    instrument: "slot-6",
  })], 0);

  const pads = tracker.update([
    pad("orange", 137, 50, { ruleId: "orange", instrument: "slot-8" }),
  ], 80);

  const orange = pads.find((candidate) => candidate.ruleId === "orange");
  assert.equal(orange?.id, "tracked-2");
});

test("PadTracker gives a distant same-color replacement a new identity", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    strictRuleMatch: false,
    maxMatchDistance: 64,
    maxContinuationDistance: 30,
  });
  tracker.update([pad("brown-a", 90, 50, {
    ruleId: "brown-red",
    instrument: "slot-6",
  })], 0);

  const pads = tracker.update([pad("brown-b", 137, 50, {
    ruleId: "brown-red",
    instrument: "slot-6",
  })], 80);

  assert.equal(pads.find((candidate) => candidate.observedAt === 80)?.id, "tracked-2");
});

test("PadTracker keeps a moving object identity across a short color wobble", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    strictRuleMatch: false,
    maxMatchDistance: 64,
    maxRuleMismatchDistance: 30,
    maxContinuationDistance: 30,
  });
  const first = tracker.update([pad("deep-blue", 90, 50, {
    ruleId: "deep-blue",
    instrument: "slot-5",
  })], 0)[0];

  const moved = tracker.update([pad("light-blue", 111, 50, {
    ruleId: "light-blue",
    instrument: "slot-2",
  })], 80);

  assert.equal(moved.length, 1);
  assert.equal(moved[0].id, first.id);
});
