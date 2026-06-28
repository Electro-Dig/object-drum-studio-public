import assert from "node:assert/strict";
import test from "node:test";

import {
  LILY_SCALES,
  hueToScaleStep,
  octaveFromY,
  scaleStepToNote,
} from "../src/lily/lilyScales.js";

test("scaleStepToNote wraps major pentatonic steps across octaves", () => {
  assert.equal(scaleStepToNote("major-pentatonic", 0, 3), "C3");
  assert.equal(scaleStepToNote("major-pentatonic", 4, 3), "A3");
  assert.equal(scaleStepToNote("major-pentatonic", 5, 3), "C4");
  assert.equal(scaleStepToNote("major-pentatonic", -1, 3), "A2");
});

test("hueToScaleStep maps hue around the wheel into scale slots", () => {
  assert.equal(hueToScaleStep(0, "major-pentatonic"), 0);
  assert.equal(hueToScaleStep(72, "major-pentatonic"), 1);
  assert.equal(hueToScaleStep(359, "major-pentatonic"), 4);
});

test("octaveFromY maps higher image positions to higher octaves", () => {
  assert.equal(octaveFromY(0, 100), 4);
  assert.equal(octaveFromY(50, 100), 3);
  assert.equal(octaveFromY(100, 100), 2);
});

test("LILY_SCALES exposes required presets", () => {
  assert.ok(LILY_SCALES["major-pentatonic"]);
  assert.ok(LILY_SCALES["minor-pentatonic"]);
  assert.ok(LILY_SCALES.lydian);
});
