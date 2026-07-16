import assert from "node:assert/strict";
import test from "node:test";

import { EntryGate } from "../src/console/entryGate.js";
import {
  MAPPING_MODES,
  createDefaultProfile,
  normalizeProfile,
} from "../src/console/profile.js";
import { selectSoundSlot } from "../src/console/soundSelector.js";

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

test("selectSoundSlot maps a six-color pad to the matching enabled slot", () => {
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
  assert.equal(selectSoundSlot({ profile, pad: {}, random: () => 0.999 }).id, "slot-6");
});
