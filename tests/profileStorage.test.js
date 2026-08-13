import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_STORAGE_KEY,
  loadStoredProfile,
} from "../src/console/profileStorage.js";

function storageWith(values = {}) {
  const records = new Map(Object.entries(values));
  return {
    getItem(key) {
      return records.has(key) ? records.get(key) : null;
    },
    setItem(key, value) {
      records.set(key, value);
    },
  };
}

test("new palette storage ignores the stale v2 test profile", () => {
  const storage = storageWith({
    "object-drum-show-console-profile-v2": JSON.stringify({
      slots: [{ label: "绿色", colorHex: "#bacfd1" }],
    }),
  });

  const profile = loadStoredProfile(storage);

  assert.equal(PROFILE_STORAGE_KEY, "object-drum-show-console-profile-v3");
  assert.deepEqual(profile.slots.slice(0, 5).map((slot) => slot.label), [
    "粉色", "宝蓝", "红色", "深青绿", "深蓝",
  ]);
});

test("new palette storage restores a valid v3 profile", () => {
  const storage = storageWith({
    "object-drum-show-console-profile-v3": JSON.stringify({ name: "现场 A" }),
  });

  assert.equal(loadStoredProfile(storage).name, "现场 A");
});
