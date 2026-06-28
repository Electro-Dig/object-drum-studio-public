import assert from "node:assert/strict";
import test from "node:test";

import {
  getLilyPalette,
  listLilyPalettes,
} from "../src/lily/lilyPalettes.js";

test("getLilyPalette returns local built-in palettes with required voices", () => {
  const palette = getLilyPalette("water-pluck");

  assert.equal(palette.id, "water-pluck");
  assert.equal(palette.source, "local");
  assert.ok(palette.voices.sourcePulse);
  assert.ok(palette.voices.pluck);
  assert.ok(palette.voices.bell);
  assert.ok(palette.voices.padTail);
});

test("listLilyPalettes exposes all local palette choices", () => {
  const ids = listLilyPalettes().map((palette) => palette.id);

  assert.ok(ids.includes("gemidi-marimba"));
  assert.ok(ids.includes("pond-ensemble"));
  assert.ok(ids.includes("water-pluck"));
  assert.ok(ids.includes("glass-bell"));
  assert.ok(ids.includes("kalimba-garden"));
  assert.ok(ids.includes("warm-pond"));
});

test("gemidi-marimba is the cohesive default Lily instrument", () => {
  const palette = getLilyPalette();

  assert.equal(palette.id, "gemidi-marimba");
  assert.equal(palette.mappingMode, "melody-instrument");
  assert.equal(palette.voices.sourcePulse.synth, "marimba");
  assert.equal(palette.voices.pluck.synth, "marimba");
  assert.ok(palette.effects.reverbWet >= 0.35);
});

test("pond-ensemble exposes color ensemble voice families", () => {
  const palette = getLilyPalette("pond-ensemble");

  assert.equal(palette.mappingMode, "color-ensemble");
  assert.ok(palette.voices["warm-marimba"]);
  assert.ok(palette.voices["soft-kalimba"]);
  assert.ok(palette.voices["glass-accent"]);
});
