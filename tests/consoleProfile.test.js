import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSOLE_SCHEMA_VERSION,
  MAPPING_MODES,
  activeColorRules,
  createDefaultProfile,
  normalizeProfile,
  validateShowPackage,
} from "../src/console/profile.js";

test("createDefaultProfile exposes ten immediately playable photo-matched color and sound slots", () => {
  const profile = createDefaultProfile();

  assert.equal(profile.schemaVersion, CONSOLE_SCHEMA_VERSION);
  assert.equal(profile.mappingMode, MAPPING_MODES.TEN_COLOR);
  assert.equal(profile.slots.length, 10);
  assert.equal(new Set(profile.slots.map((slot) => slot.id)).size, 10);
  assert.deepEqual(profile.slots.map((slot) => slot.label), [
    "粉色",
    "宝蓝",
    "红色",
    "深青绿",
    "深蓝",
    "深棕",
    "紫色",
    "橙色",
    "亮黄",
    "荧光绿",
  ]);
  assert.deepEqual(profile.slots.map((slot) => slot.colorHex), [
    "#ed77c0",
    "#3b7bd4",
    "#c0332c",
    "#357575",
    "#2347d1",
    "#595653",
    "#692cc3",
    "#ea9f39",
    "#f3f952",
    "#b0e548",
  ]);
  assert.ok(profile.slots.every((slot) => slot.enabled));
  assert.ok(profile.slots.every((slot) => slot.colorRule.instrument === slot.id));
  assert.ok(profile.slots.every((slot) => slot.fallbackVoice));
});

test("normalizeProfile fills missing slots and clamps operational values", () => {
  const profile = normalizeProfile({
    name: "  华西演示  ",
    masterGain: 4,
    recognition: {
      minArea: -20,
      confirmFrames: 99,
      missingTtlMs: 10,
    },
    slots: [{
      id: "custom-red",
      label: "  红色纸片  ",
      gain: -3,
      colorRule: {
        id: "custom-red-rule",
        hueCenter: 725,
        hueRange: 999,
        minSaturation: -1,
        minValue: 2,
      },
    }],
  });

  assert.equal(profile.name, "华西演示");
  assert.equal(profile.masterGain, 1);
  assert.equal(profile.recognition.minArea, 12);
  assert.equal(profile.recognition.confirmFrames, 6);
  assert.equal(profile.recognition.missingTtlMs, 120);
  assert.equal(profile.slots.length, 10);
  assert.equal(profile.slots[0].id, "custom-red");
  assert.equal(profile.slots[0].label, "红色纸片");
  assert.equal(profile.slots[0].gain, 0);
  assert.equal(profile.slots[0].colorRule.instrument, "custom-red");
  assert.equal(profile.slots[0].colorRule.hueCenter, 5);
  assert.equal(profile.slots[0].colorRule.hueRange, 180);
  assert.equal(profile.slots[0].colorRule.minSaturation, 0);
  assert.equal(profile.slots[0].colorRule.minValue, 1);
});

test("activeColorRules returns ten mappings by default and one recognition color in random mode", () => {
  const tenColor = createDefaultProfile();
  const random = normalizeProfile({
    ...tenColor,
    mappingMode: MAPPING_MODES.SAME_COLOR_RANDOM,
  });

  assert.equal(activeColorRules(tenColor).length, 10);
  assert.equal(activeColorRules(random).length, 1);
  assert.equal(activeColorRules(random)[0].id, random.slots[0].colorRule.id);
});

test("normalizeProfile migrates a legacy six-color profile without losing its original slots", () => {
  const legacySlots = Array.from({ length: 6 }, (_, index) => ({
    id: `legacy-${index + 1}`,
    label: `旧槽 ${index + 1}`,
    colorHex: `#${String(index + 1).repeat(6)}`,
  }));

  const profile = normalizeProfile({
    schemaVersion: 1,
    mappingMode: "six-color",
    slots: legacySlots,
  });

  assert.equal(profile.schemaVersion, 2);
  assert.equal(profile.mappingMode, MAPPING_MODES.TEN_COLOR);
  assert.equal(profile.slots.length, 10);
  assert.deepEqual(profile.slots.slice(0, 6).map((slot) => slot.id), legacySlots.map((slot) => slot.id));
  assert.deepEqual(profile.slots.slice(6).map((slot) => slot.id), ["slot-7", "slot-8", "slot-9", "slot-10"]);
});

test("legacy color rules without a saturation ceiling remain unrestricted after migration", () => {
  const profile = normalizeProfile({
    schemaVersion: 1,
    mappingMode: "six-color",
    slots: Array.from({ length: 6 }, (_, index) => ({
      id: `legacy-${index + 1}`,
      colorRule: {
        id: `legacy-${index + 1}-color`,
        hueCenter: index === 5 ? 264 : index * 40,
        hueRange: 20,
        minSaturation: 0.35,
        minValue: 0.18,
        maxValue: 1,
      },
    })),
  });

  assert.equal(profile.slots[5].colorRule.maxSaturation, 1);
});

test("validateShowPackage normalizes a supported package and rejects unsupported schemas", () => {
  const valid = validateShowPackage({
    schemaVersion: CONSOLE_SCHEMA_VERSION,
    profile: { name: "Client package" },
    samples: { "slot-1": { name: "hit.wav", dataUrl: "data:audio/wav;base64,AA==" } },
  });

  assert.equal(valid.profile.name, "Client package");
  assert.equal(valid.profile.slots.length, 10);
  assert.equal(valid.samples["slot-1"].name, "hit.wav");
  assert.throws(
    () => validateShowPackage({ schemaVersion: 99, profile: {} }),
    /不支持的配置包版本/,
  );
});

test("validateShowPackage accepts and upgrades a legacy v1 package", () => {
  const migrated = validateShowPackage({
    schemaVersion: 1,
    profile: { schemaVersion: 1, mappingMode: "six-color", slots: [{ id: "legacy-red" }] },
    samples: { "legacy-red": { name: "old.wav", dataUrl: "data:audio/wav;base64,AA==" } },
  });

  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.profile.slots.length, 10);
  assert.equal(migrated.samples["legacy-red"].name, "old.wav");
});
