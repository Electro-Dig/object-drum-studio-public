import assert from "node:assert/strict";
import test from "node:test";

import {
  createBackgroundModel,
  detectCalibratedObjects,
} from "../src/detection/calibratedColorDetector.js";
import { hexToLab } from "../src/detection/colorMetrics.js";

function rgbaFrame(width, height, fill = [128, 128, 128, 255]) {
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

function rgb(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255,
  ];
}

const COLORS = [
  ["slot-1-color", "slot-1", "粉色", "#ff89df"],
  ["slot-2-color", "slot-2", "宝蓝", "#295ada"],
  ["slot-3-color", "slot-3", "红色", "#e83433"],
  ["slot-4-color", "slot-4", "深青绿", "#075e5f"],
  ["slot-5-color", "slot-5", "天蓝", "#2394e4"],
  ["slot-6-color", "slot-6", "深棕", "#3f3a36"],
  ["slot-7-color", "slot-7", "紫色", "#5b2ba4"],
  ["slot-8-color", "slot-8", "橙色", "#f49e13"],
  ["slot-9-color", "slot-9", "亮黄", "#ebde1d"],
  ["slot-10-color", "slot-10", "荧光绿", "#94db16"],
];

const PROTOTYPES = COLORS.map(([ruleId, instrument, label, hex]) => ({
  ruleId,
  instrument,
  label,
  lab: hexToLab(hex),
}));

test("detectCalibratedObjects returns no objects when the frame matches the empty background", () => {
  const width = 24;
  const height = 16;
  const background = rgbaFrame(width, height);
  const model = createBackgroundModel(background, width, height);
  const result = detectCalibratedObjects(background, width, height, {
    backgroundModel: model,
    prototypes: PROTOTYPES,
    minArea: 8,
  });

  assert.equal(result.status, "ok");
  assert.deepEqual(result.pads, []);
  assert.equal(result.foregroundFraction, 0);
});

test("detectCalibratedObjects finds low-saturation brown on gray fabric", () => {
  const width = 24;
  const height = 16;
  const background = rgbaFrame(width, height, [112, 114, 116, 255]);
  const current = new Uint8ClampedArray(background);
  fillRect(current, width, 7, 5, 10, 7, rgb("#3f3a36"));

  const result = detectCalibratedObjects(current, width, height, {
    backgroundModel: createBackgroundModel(background, width, height),
    prototypes: PROTOTYPES,
    foregroundDeltaE: 10,
    maxColorDistance: 30,
    minColorMargin: 2,
    minArea: 16,
  });

  assert.equal(result.status, "ok");
  assert.equal(result.pads.length, 1);
  assert.equal(result.pads[0].ruleId, "slot-6-color");
  assert.equal(result.pads[0].instrument, "slot-6");
  assert.deepEqual(result.pads[0].bounds, { x: 7, y: 5, width: 10, height: 7 });
});

test("detectCalibratedObjects returns all ten separated colors instead of truncating at eight", () => {
  const width = 72;
  const height = 22;
  const background = rgbaFrame(width, height, [105, 108, 110, 255]);
  const current = new Uint8ClampedArray(background);
  COLORS.forEach((color, index) => {
    const row = Math.floor(index / 5);
    const column = index % 5;
    fillRect(current, width, 4 + column * 13, 3 + row * 10, 7, 7, rgb(color[3]));
  });

  const result = detectCalibratedObjects(current, width, height, {
    backgroundModel: createBackgroundModel(background, width, height),
    prototypes: PROTOTYPES,
    minArea: 16,
    maxObjects: 24,
    maxColorDistance: 38,
    minColorMargin: 1.5,
  });

  assert.equal(result.pads.length, 10);
  assert.deepEqual(
    new Set(result.pads.map((pad) => pad.instrument)),
    new Set(COLORS.map((color) => color[1])),
  );
});

test("detectCalibratedObjects samples the painted center instead of a dark bark border", () => {
  const width = 24;
  const height = 18;
  const background = rgbaFrame(width, height, [118, 120, 122, 255]);
  const current = new Uint8ClampedArray(background);
  fillRect(current, width, 6, 4, 12, 12, [28, 24, 22, 255]);
  fillRect(current, width, 8, 6, 8, 8, rgb("#f49e13"));

  const result = detectCalibratedObjects(current, width, height, {
    backgroundModel: createBackgroundModel(background, width, height),
    prototypes: PROTOTYPES,
    minArea: 30,
    innerShrink: 0.2,
    maxColorDistance: 32,
    minColorMargin: 2,
  });

  assert.equal(result.pads.length, 1);
  assert.equal(result.pads[0].ruleId, "slot-8-color");
});

test("detectCalibratedObjects reports background mismatch instead of returning a full-frame object", () => {
  const width = 20;
  const height = 12;
  const background = rgbaFrame(width, height, [80, 82, 84, 255]);
  const changedLighting = rgbaFrame(width, height, [180, 182, 184, 255]);

  const result = detectCalibratedObjects(changedLighting, width, height, {
    backgroundModel: createBackgroundModel(background, width, height),
    prototypes: PROTOTYPES,
    foregroundDeltaE: 10,
    maxForegroundFraction: 0.6,
    minArea: 4,
  });

  assert.equal(result.status, "background-mismatch");
  assert.deepEqual(result.pads, []);
  assert.ok(result.foregroundFraction > 0.95);
});
