import assert from "node:assert/strict";
import test from "node:test";

import {
  MELODIC_PRESET_CATEGORIES,
  getMelodicPreset,
  listMelodicPresets,
  melodicPresetToCapsule,
  melodicPresetToLilyPalette,
  melodicPresetToLilyVoice,
} from "../src/audio/melodicPresets.js";

test("listMelodicPresets exposes global Lily-friendly categories", () => {
  const presets = listMelodicPresets();
  const categories = new Set(presets.map((preset) => preset.category));

  for (const category of ["Lead", "Pad", "Pluck", "Mallet", "Bell", "Bass", "FX"]) {
    assert.ok(MELODIC_PRESET_CATEGORIES.includes(category));
    assert.ok(categories.has(category));
  }
  assert.ok(presets.some((preset) => preset.id === "gemidi-marimba"));
});

test("melodicPresetToCapsule creates a reusable global sound capsule", () => {
  const capsule = melodicPresetToCapsule("gemidi-marimba");

  assert.equal(capsule.id, "melodic-gemidi-marimba");
  assert.equal(capsule.type, "web-audio-synth");
  assert.equal(capsule.kind, "drum");
  assert.equal(capsule.source.alias, "marimba");
  assert.equal(capsule.params.cutoff, 5200);
  assert.equal(capsule.params.room, 0.48);
});

test("melodicPresetToLilyVoice keeps musical parameters compact and playable", () => {
  const voice = melodicPresetToLilyVoice(getMelodicPreset("glass-bell"), { role: "glass-bell" });

  assert.equal(voice.role, "glass-bell");
  assert.equal(voice.synth, "fm");
  assert.ok(voice.gain > 0);
  assert.ok(voice.release >= 0.3);
});

test("melodicPresetToLilyPalette builds a single-instrument Lily palette", () => {
  const palette = melodicPresetToLilyPalette("gemidi-marimba");

  assert.equal(palette.id, "melodic-gemidi-marimba");
  assert.equal(palette.source, "global-preset");
  assert.equal(palette.mappingMode, "melody-instrument");
  assert.equal(palette.voices.pluck.synth, "marimba");
  assert.equal(palette.voices.sourcePulse.synth, "marimba");
  assert.ok(palette.effects.reverbWet >= 0.35);
});
