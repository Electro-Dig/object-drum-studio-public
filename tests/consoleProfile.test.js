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

test("createDefaultProfile exposes six immediately playable color and sound slots", () => {
  const profile = createDefaultProfile();

  assert.equal(profile.schemaVersion, CONSOLE_SCHEMA_VERSION);
  assert.equal(profile.mappingMode, MAPPING_MODES.SIX_COLOR);
  assert.equal(profile.slots.length, 6);
  assert.equal(new Set(profile.slots.map((slot) => slot.id)).size, 6);
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
  assert.equal(profile.slots.length, 6);
  assert.equal(profile.slots[0].id, "custom-red");
  assert.equal(profile.slots[0].label, "红色纸片");
  assert.equal(profile.slots[0].gain, 0);
  assert.equal(profile.slots[0].colorRule.instrument, "custom-red");
  assert.equal(profile.slots[0].colorRule.hueCenter, 5);
  assert.equal(profile.slots[0].colorRule.hueRange, 180);
  assert.equal(profile.slots[0].colorRule.minSaturation, 0);
  assert.equal(profile.slots[0].colorRule.minValue, 1);
});

test("activeColorRules returns six mappings by default and one recognition color in random mode", () => {
  const sixColor = createDefaultProfile();
  const random = normalizeProfile({
    ...sixColor,
    mappingMode: MAPPING_MODES.SAME_COLOR_RANDOM,
  });

  assert.equal(activeColorRules(sixColor).length, 6);
  assert.equal(activeColorRules(random).length, 1);
  assert.equal(activeColorRules(random)[0].id, random.slots[0].colorRule.id);
});

test("validateShowPackage normalizes a supported package and rejects unsupported schemas", () => {
  const valid = validateShowPackage({
    schemaVersion: CONSOLE_SCHEMA_VERSION,
    profile: { name: "Client package" },
    samples: { "slot-1": { name: "hit.wav", dataUrl: "data:audio/wav;base64,AA==" } },
  });

  assert.equal(valid.profile.name, "Client package");
  assert.equal(valid.profile.slots.length, 6);
  assert.equal(valid.samples["slot-1"].name, "hit.wav");
  assert.throws(
    () => validateShowPackage({ schemaVersion: 99, profile: {} }),
    /不支持的配置包版本/,
  );
});
