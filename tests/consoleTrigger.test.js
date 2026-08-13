import assert from "node:assert/strict";
import test from "node:test";

import { EntryGate } from "../src/console/entryGate.js";
import {
  MAPPING_MODES,
  createDefaultProfile,
  normalizeProfile,
} from "../src/console/profile.js";
import { selectSoundSlot } from "../src/console/soundSelector.js";

function observedPad(id, ruleId, observedAt, overrides = {}) {
  return {
    id,
    ruleId,
    instrument: ruleId.replace("-color", ""),
    label: ruleId,
    observedAt,
    area: 220,
    bounds: { x: 50, y: 40, width: 20, height: 20 },
    centroid: { x: 60, y: 50 },
    ...overrides,
  };
}

function stableContext(timeMs, settleDelayMs = 100) {
  return {
    timeMs,
    settleDelayMs,
    stableMode: true,
    frameWidth: 360,
    frameHeight: 200,
  };
}

test("EntryGate emits a held object once and emits it again after leaving", () => {
  const gate = new EntryGate();
  const red = { id: "track-red", ruleId: "slot-1-color" };

  assert.deepEqual(gate.update([red]), [red]);
  assert.deepEqual(gate.update([red]), []);
  assert.deepEqual(gate.update([]), []);
  assert.deepEqual(gate.update([red]), [red]);
});

test("EntryGate emits simultaneous new objects without collapsing them", () => {
  const gate = new EntryGate();
  const pads = [
    { id: "track-a", ruleId: "slot-1-color" },
    { id: "track-b", ruleId: "slot-2-color" },
    { id: "track-c", ruleId: "slot-3-color" },
  ];

  assert.deepEqual(gate.update(pads), pads);
  assert.deepEqual(gate.update(pads), []);
});

test("EntryGate reset makes currently visible objects eligible again", () => {
  const gate = new EntryGate();
  const pad = { id: "track-a" };

  gate.update([pad]);
  gate.reset();

  assert.deepEqual(gate.update([pad]), [pad]);
});

test("EntryGate waits for 100ms of fresh stable observations before emitting", () => {
  const gate = new EntryGate();

  assert.deepEqual(gate.update([
    observedPad("track-red", "slot-3-color", 0),
  ], stableContext(0)), []);
  assert.deepEqual(gate.update([
    observedPad("track-red", "slot-3-color", 50),
  ], stableContext(50)), []);
  assert.deepEqual(gate.update([
    observedPad("track-red", "slot-3-color", 100),
  ], stableContext(100)).map((pad) => pad.id), ["track-red"]);
});

test("EntryGate does not count tracker-held copies as settle time", () => {
  const gate = new EntryGate();
  const first = observedPad("track-brown", "slot-6-color", 0);

  assert.deepEqual(gate.update([first], stableContext(0)), []);
  assert.deepEqual(gate.update([first], stableContext(180)), []);
  assert.deepEqual(gate.update([
    { ...first, observedAt: 240 },
  ], stableContext(240)), []);
  assert.deepEqual(gate.update([
    { ...first, observedAt: 340 },
  ], stableContext(340)).map((pad) => pad.id), ["track-brown"]);
});

test("EntryGate restarts settling when color or geometry changes", () => {
  const gate = new EntryGate();

  gate.update([observedPad("track-a", "slot-3-color", 0)], stableContext(0));
  gate.update([observedPad("track-a", "slot-3-color", 80)], stableContext(80));
  assert.deepEqual(gate.update([
    observedPad("track-a", "slot-6-color", 120, {
      bounds: { x: 58, y: 40, width: 20, height: 20 },
      centroid: { x: 68, y: 50 },
    }),
  ], stableContext(120)), []);
  assert.deepEqual(gate.update([
    observedPad("track-a", "slot-6-color", 200, {
      bounds: { x: 58, y: 40, width: 20, height: 20 },
      centroid: { x: 68, y: 50 },
    }),
  ], stableContext(200)), []);
  assert.deepEqual(gate.update([
    observedPad("track-a", "slot-6-color", 220, {
      bounds: { x: 58, y: 40, width: 20, height: 20 },
      centroid: { x: 68, y: 50 },
    }),
  ], stableContext(220)).map((pad) => pad.ruleId), ["slot-6-color"]);
});

test("EntryGate rejects oversized and elongated hand-like candidates", () => {
  const gate = new EntryGate();
  const palm = observedPad("hand-palm", "slot-6-color", 0, {
    area: 4200,
    bounds: { x: 20, y: 20, width: 90, height: 70 },
    centroid: { x: 65, y: 55 },
  });
  const finger = observedPad("hand-finger", "slot-6-color", 0, {
    area: 260,
    bounds: { x: 120, y: 15, width: 8, height: 48 },
    centroid: { x: 124, y: 39 },
  });

  assert.deepEqual(gate.update([palm, finger], stableContext(0)), []);
  assert.deepEqual(gate.update([
    { ...palm, observedAt: 120 },
    { ...finger, observedAt: 120 },
  ], stableContext(120)), []);
});

test("EntryGate emits multiple settled objects independently and freezes each entry identity", () => {
  const gate = new EntryGate();
  const red = observedPad("track-red", "slot-3-color", 0);
  const blue = observedPad("track-blue", "slot-2-color", 0, {
    instrument: "slot-2",
    bounds: { x: 100, y: 40, width: 20, height: 20 },
    centroid: { x: 110, y: 50 },
  });

  gate.update([red, blue], stableContext(0));
  const entries = gate.update([
    { ...red, observedAt: 100 },
    { ...blue, observedAt: 100 },
  ], stableContext(100));
  assert.deepEqual(entries.map((pad) => pad.id), ["track-red", "track-blue"]);

  assert.deepEqual(gate.update([
    observedPad("track-red", "slot-6-color", 200),
    { ...blue, observedAt: 200 },
  ], stableContext(200)), []);
  assert.deepEqual(
    gate.lockIdentities([
      observedPad("track-red", "slot-6-color", 200),
      { ...blue, observedAt: 200, ruleId: "slot-5-color", instrument: "slot-5" },
    ]).map((pad) => pad.ruleId),
    ["slot-3-color", "slot-2-color"],
  );

  gate.update([], stableContext(300));
  assert.deepEqual(gate.update([
    observedPad("track-red", "slot-3-color", 400),
  ], stableContext(400)), []);
  assert.deepEqual(gate.update([
    observedPad("track-red", "slot-3-color", 500),
  ], stableContext(500)).map((pad) => pad.id), ["track-red"]);
});

test("selectSoundSlot maps a ten-color pad to the matching enabled slot", () => {
  const profile = createDefaultProfile();
  const target = profile.slots[3];

  assert.equal(
    selectSoundSlot({
      profile,
      pad: { ruleId: target.colorRule.id, instrument: target.id },
    }).id,
    target.id,
  );
});

test("selectSoundSlot returns null when the matching color slot is disabled", () => {
  const profile = createDefaultProfile();
  profile.slots[2].enabled = false;

  assert.equal(selectSoundSlot({
    profile,
    pad: {
      ruleId: profile.slots[2].colorRule.id,
      instrument: profile.slots[2].id,
    },
  }), null);
});

test("selectSoundSlot uses injected randomness across enabled slots in same-color mode", () => {
  const base = createDefaultProfile();
  base.slots[1].enabled = false;
  const profile = normalizeProfile({
    ...base,
    mappingMode: MAPPING_MODES.SAME_COLOR_RANDOM,
  });

  assert.equal(selectSoundSlot({ profile, pad: {}, random: () => 0 }).id, "slot-1");
  assert.equal(selectSoundSlot({ profile, pad: {}, random: () => 0.999 }).id, "slot-10");
});
