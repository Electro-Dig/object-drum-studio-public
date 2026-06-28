import assert from "node:assert/strict";
import test from "node:test";

import { nextStrictStartTime } from "../src/audio/triggerScheduler.js";

test("nextStrictStartTime bumps repeated starts for the same voice", () => {
  const starts = new Map();

  assert.equal(nextStrictStartTime(starts, "kick", 1, 10, 0.002), 1);
  assert.equal(nextStrictStartTime(starts, "kick", 1, 10, 0.002), 1.002);
  assert.equal(nextStrictStartTime(starts, "kick", 1.001, 10, 0.002), 1.004);
});

test("nextStrictStartTime allows separate voices at the same time", () => {
  const starts = new Map();

  assert.equal(nextStrictStartTime(starts, "kick", 2, 10, 0.002), 2);
  assert.equal(nextStrictStartTime(starts, "snare", 2, 10, 0.002), 2);
});

test("nextStrictStartTime uses the current audio time when no explicit time is provided", () => {
  const starts = new Map();

  assert.equal(nextStrictStartTime(starts, "tom", undefined, 4.5, 0.002), 4.5);
  assert.equal(nextStrictStartTime(starts, "tom", undefined, 4.5, 0.002), 4.502);
});
