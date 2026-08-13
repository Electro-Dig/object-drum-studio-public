import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultProfile, MAPPING_MODES } from "../src/console/profile.js";
import {
  ConsoleRecognitionSession,
  colorPrototypesFromProfile,
} from "../src/console/recognitionSession.js";

function rgbaFrame(width, height, fill) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) data.set(fill, index);
  return data;
}

function fillRect(data, width, x, y, rectWidth, rectHeight, rgba) {
  for (let yy = y; yy < y + rectHeight; yy += 1) {
    for (let xx = x; xx < x + rectWidth; xx += 1) {
      data.set(rgba, (yy * width + xx) * 4);
    }
  }
}

test("colorPrototypesFromProfile exposes ten fixed mappings and the first enabled random color", () => {
  const profile = createDefaultProfile();
  const fixed = colorPrototypesFromProfile(profile);
  profile.mappingMode = MAPPING_MODES.SAME_COLOR_RANDOM;
  profile.slots[0].enabled = false;
  const random = colorPrototypesFromProfile(profile);

  assert.equal(fixed.length, 10);
  assert.deepEqual(fixed.map((prototype) => prototype.instrument), [
    "slot-1", "slot-2", "slot-3", "slot-4", "slot-5",
    "slot-6", "slot-7", "slot-8", "slot-9", "slot-10",
  ]);
  assert.equal(random.length, 1);
  assert.equal(random[0].instrument, "slot-2");
});

test("ConsoleRecognitionSession keeps HSV fallback available before empty-scene calibration", () => {
  const width = 20;
  const height = 12;
  const frame = rgbaFrame(width, height, [110, 112, 114, 255]);
  fillRect(frame, width, 5, 3, 8, 6, [232, 52, 51, 255]);
  const profile = createDefaultProfile();
  profile.recognition.minArea = 16;
  const session = new ConsoleRecognitionSession(profile);

  let result;
  for (const now of [0, 80, 160]) result = session.process(frame, width, height, now);

  assert.equal(result.mode, "hsv-fallback");
  assert.equal(result.status, "needs-calibration");
  assert.equal(result.pads.length, 1);
  assert.equal(result.pads[0].instrument, "slot-3");
});

test("ConsoleRecognitionSession recognizes brown after empty-scene calibration and three votes", () => {
  const width = 24;
  const height = 16;
  const empty = rgbaFrame(width, height, [112, 114, 116, 255]);
  const current = new Uint8ClampedArray(empty);
  fillRect(current, width, 7, 5, 10, 7, [63, 58, 54, 255]);
  const profile = createDefaultProfile();
  profile.recognition.minArea = 16;
  const session = new ConsoleRecognitionSession(profile);
  session.captureBackground(empty, width, height);

  let result;
  for (const now of [0, 80, 160]) result = session.process(current, width, height, now);

  assert.equal(result.mode, "calibrated-lab");
  assert.equal(result.status, "ok");
  assert.equal(result.pads.length, 1);
  assert.equal(result.pads[0].instrument, "slot-6");
});

test("ConsoleRecognitionSession suppresses tracks when lighting invalidates the background", () => {
  const width = 20;
  const height = 12;
  const empty = rgbaFrame(width, height, [80, 82, 84, 255]);
  const changed = rgbaFrame(width, height, [180, 182, 184, 255]);
  const session = new ConsoleRecognitionSession(createDefaultProfile());
  session.captureBackground(empty, width, height);

  const result = session.process(changed, width, height, 0);

  assert.equal(result.status, "background-mismatch");
  assert.deepEqual(result.pads, []);
});

test("ConsoleRecognitionSession can confirm when the profile requests six frames", () => {
  const width = 24;
  const height = 16;
  const empty = rgbaFrame(width, height, [112, 114, 116, 255]);
  const current = new Uint8ClampedArray(empty);
  fillRect(current, width, 7, 5, 10, 7, [232, 52, 51, 255]);
  const profile = createDefaultProfile();
  profile.recognition.minArea = 16;
  profile.recognition.confirmFrames = 6;
  const session = new ConsoleRecognitionSession(profile);
  session.captureBackground(empty, width, height);

  let result;
  for (let frame = 0; frame < 6; frame += 1) {
    result = session.process(current, width, height, frame * 80);
  }

  assert.equal(result.pads.length, 1);
  assert.equal(result.pads[0].instrument, "slot-3");
});
