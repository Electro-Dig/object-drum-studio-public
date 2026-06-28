import assert from "node:assert/strict";
import test from "node:test";

import {
  activeLilyColorRules,
  filterLilyPadsForRecognition,
  shouldCreatePlayableLilyNodes,
} from "../src/lily/lilyRecognition.js";

const RULES = [
  { id: "orange-bead", enabled: true, label: "Orange bead" },
  { id: "green-bead", enabled: true, label: "Green bead" },
  { id: "skin-orange", enabled: true, label: "Skin orange" },
  { id: "disabled-purple", enabled: false, label: "Disabled purple" },
];

test("activeLilyColorRules uses locked rule ids as a strict whitelist", () => {
  const active = activeLilyColorRules(RULES, {
    strict: true,
    lockedRuleIds: ["orange-bead", "disabled-purple"],
  });

  assert.deepEqual(active.map((rule) => rule.id), ["orange-bead"]);
});

test("activeLilyColorRules keeps enabled rules visible before colors are locked", () => {
  const active = activeLilyColorRules(RULES, {
    strict: true,
    lockedRuleIds: [],
  });

  assert.deepEqual(active.map((rule) => rule.id), ["orange-bead", "green-bead", "skin-orange"]);
});

test("filterLilyPadsForRecognition rejects unlocked colors and hand-sized blobs", () => {
  const pads = [
    {
      id: "small-orange",
      ruleId: "orange-bead",
      area: 120,
      bounds: { x: 10, y: 10, width: 16, height: 16 },
    },
    {
      id: "small-green",
      ruleId: "green-bead",
      area: 110,
      bounds: { x: 50, y: 10, width: 15, height: 16 },
    },
    {
      id: "hand-blob",
      ruleId: "orange-bead",
      area: 3800,
      bounds: { x: 0, y: 0, width: 150, height: 120 },
    },
    {
      id: "skin",
      ruleId: "skin-orange",
      area: 140,
      bounds: { x: 80, y: 10, width: 18, height: 18 },
    },
  ];

  const filtered = filterLilyPadsForRecognition(pads, { width: 200, height: 120 }, {
    strict: true,
    lockedRuleIds: ["orange-bead", "green-bead"],
    maxAreaRatio: 0.05,
    maxBoundsRatio: 0.32,
    maxNodes: 8,
  });

  assert.deepEqual(filtered.map((pad) => pad.id), ["small-orange", "small-green"]);
});

test("filterLilyPadsForRecognition caps node candidates by area after filtering", () => {
  const pads = Array.from({ length: 5 }, (_, index) => ({
    id: `pad-${index}`,
    ruleId: "orange-bead",
    area: 50 + index,
    bounds: { x: index * 8, y: 0, width: 8, height: 8 },
  }));

  const filtered = filterLilyPadsForRecognition(pads, { width: 200, height: 120 }, {
    strict: true,
    lockedRuleIds: ["orange-bead"],
    maxNodes: 3,
  });

  assert.deepEqual(filtered.map((pad) => pad.id), ["pad-4", "pad-3", "pad-2"]);
});

test("shouldCreatePlayableLilyNodes allows enabled object rules without a separate color lock", () => {
  assert.equal(shouldCreatePlayableLilyNodes({
    strict: true,
    lockedRuleIds: [],
  }), true);
  assert.equal(shouldCreatePlayableLilyNodes({
    strict: true,
    lockedRuleIds: ["orange-bead"],
  }), true);
  assert.equal(shouldCreatePlayableLilyNodes({
    strict: false,
    lockedRuleIds: [],
  }), true);
});
