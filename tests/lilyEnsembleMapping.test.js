import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultLilyEnsembleAssignments,
  normalizeLilyEnsembleAssignments,
  presetIdForLilyPad,
  uniqueAssignedPresetIds,
} from "../src/lily/lilyEnsembleMapping.js";

const RULES = [
  { id: "orange-rule", instrument: "kick", label: "Orange Pluck" },
  { id: "yellow-rule", instrument: "snare", label: "Yellow Bell" },
  { id: "green-rule", instrument: "hihat", label: "Green Kalimba" },
  { id: "blue-rule", instrument: "pad", label: "Blue Pad" },
];

test("createDefaultLilyEnsembleAssignments maps global object slots to melodic presets", () => {
  const assignments = createDefaultLilyEnsembleAssignments(RULES);

  assert.equal(assignments["orange-rule"], "gemidi-marimba");
  assert.equal(assignments["yellow-rule"], "glass-bell");
  assert.equal(assignments["green-rule"], "soft-kalimba");
  assert.equal(assignments["blue-rule"], "airy-pad");
});

test("normalizeLilyEnsembleAssignments preserves valid custom choices and fills missing rules", () => {
  const assignments = normalizeLilyEnsembleAssignments({
    "orange-rule": "warm-pluck",
    "yellow-rule": "not-a-preset",
    "stale-rule": "glass-bell",
  }, RULES);

  assert.deepEqual(assignments, {
    "orange-rule": "warm-pluck",
    "yellow-rule": "glass-bell",
    "green-rule": "soft-kalimba",
    "blue-rule": "airy-pad",
  });
});

test("presetIdForLilyPad uses explicit rule mapping before instrument fallback", () => {
  const assignments = normalizeLilyEnsembleAssignments({ "orange-rule": "bass-pulse" }, RULES);

  assert.equal(presetIdForLilyPad({ ruleId: "orange-rule", instrument: "kick" }, assignments), "bass-pulse");
  assert.equal(presetIdForLilyPad({ ruleId: "missing", instrument: "hihat" }, assignments), "soft-kalimba");
});

test("uniqueAssignedPresetIds returns stable unique preset ids", () => {
  const ids = uniqueAssignedPresetIds({
    a: "gemidi-marimba",
    b: "glass-bell",
    c: "gemidi-marimba",
  });

  assert.deepEqual(ids, ["gemidi-marimba", "glass-bell"]);
});

test("ensemble assignments can use dynamic global library preset ids", () => {
  const allowedPresetIds = new Set(["gemidi-marimba", "library:preset-soft-pluck"]);
  const assignments = normalizeLilyEnsembleAssignments({
    "orange-rule": "library:preset-soft-pluck",
  }, RULES, { allowedPresetIds });

  assert.equal(assignments["orange-rule"], "library:preset-soft-pluck");
  assert.equal(uniqueAssignedPresetIds(assignments, { allowedPresetIds }).includes("library:preset-soft-pluck"), true);
  assert.equal(
    presetIdForLilyPad({ ruleId: "orange-rule", instrument: "kick" }, assignments, { allowedPresetIds }),
    "library:preset-soft-pluck",
  );
});
