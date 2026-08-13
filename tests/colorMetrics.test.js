import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyColor,
  colorDistance,
  hexToLab,
  rgbToLab,
} from "../src/detection/colorMetrics.js";

const PHOTO_PROTOTYPES = [
  { ruleId: "pink", instrument: "slot-1", label: "粉色", lab: hexToLab("#ff89df") },
  { ruleId: "royal-blue", instrument: "slot-2", label: "宝蓝", lab: hexToLab("#295ada") },
  { ruleId: "red", instrument: "slot-3", label: "红色", lab: hexToLab("#e83433") },
  { ruleId: "teal", instrument: "slot-4", label: "深青绿", lab: hexToLab("#075e5f") },
  { ruleId: "sky-blue", instrument: "slot-5", label: "天蓝", lab: hexToLab("#2394e4") },
  { ruleId: "brown", instrument: "slot-6", label: "深棕", lab: hexToLab("#3f3a36") },
  { ruleId: "purple", instrument: "slot-7", label: "紫色", lab: hexToLab("#5b2ba4") },
  { ruleId: "orange", instrument: "slot-8", label: "橙色", lab: hexToLab("#f49e13") },
  { ruleId: "yellow", instrument: "slot-9", label: "亮黄", lab: hexToLab("#ebde1d") },
  { ruleId: "lime", instrument: "slot-10", label: "荧光绿", lab: hexToLab("#94db16") },
];

test("rgbToLab produces the standard sRGB reference values", () => {
  const red = rgbToLab(255, 0, 0);
  const white = rgbToLab(255, 255, 255);

  assert.ok(Math.abs(red.l - 53.24) < 0.2);
  assert.ok(Math.abs(red.a - 80.09) < 0.2);
  assert.ok(Math.abs(red.b - 67.2) < 0.2);
  assert.ok(Math.abs(white.l - 100) < 0.05);
  assert.ok(Math.abs(white.a) < 0.05);
  assert.ok(Math.abs(white.b) < 0.05);
});

test("classifyColor chooses the nearest prototype independent of array order", () => {
  const sample = rgbToLab(42, 91, 218);
  const forward = classifyColor(sample, PHOTO_PROTOTYPES, { maxDistance: 35, minMargin: 2 });
  const reversed = classifyColor(sample, [...PHOTO_PROTOTYPES].reverse(), { maxDistance: 35, minMargin: 2 });

  assert.equal(forward.ruleId, "royal-blue");
  assert.equal(reversed.ruleId, "royal-blue");
  assert.equal(forward.instrument, "slot-2");
  assert.ok(forward.margin > 2);
});

test("classifyColor keeps a mildly shaded orange in the orange class", () => {
  const result = classifyColor(rgbToLab(224, 137, 20), PHOTO_PROTOTYPES, {
    maxDistance: 35,
    minMargin: 2,
  });

  assert.equal(result.ruleId, "orange");
  assert.ok(result.confidence > 0);
});

test("classifyColor recognizes low-saturation deep brown instead of treating it as gray", () => {
  const result = classifyColor(rgbToLab(62, 56, 52), PHOTO_PROTOTYPES, {
    maxDistance: 22,
    minMargin: 2,
  });

  assert.equal(result.ruleId, "brown");
});

test("classifyColor rejects an unknown gray background by maximum distance", () => {
  const result = classifyColor(rgbToLab(120, 124, 126), PHOTO_PROTOTYPES, {
    maxDistance: 20,
    minMargin: 2,
  });

  assert.equal(result, null);
});

test("classifyColor rejects a color exactly between two prototypes when the margin is ambiguous", () => {
  const prototypes = [
    { ruleId: "a", lab: { l: 50, a: 10, b: 0 } },
    { ruleId: "b", lab: { l: 50, a: -10, b: 0 } },
  ];
  const result = classifyColor({ l: 50, a: 0, b: 0 }, prototypes, {
    maxDistance: 20,
    minMargin: 1,
  });

  assert.equal(colorDistance(prototypes[0].lab, prototypes[1].lab), 20);
  assert.equal(result, null);
});
