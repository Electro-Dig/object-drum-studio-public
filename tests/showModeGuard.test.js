import assert from "node:assert/strict";
import test from "node:test";

import {
  canTriggerCalibratedRecognition,
  evaluateShowModeReadiness,
} from "../src/console/showModeGuard.js";

test("show mode rejects a session without empty-scene calibration", () => {
  assert.deepEqual(evaluateShowModeReadiness({
    calibrated: false,
    recognitionStatus: "needs-calibration",
  }), {
    allowed: false,
    reason: "capture-background",
  });
});

test("show mode accepts healthy Lab calibration and rejects background mismatch", () => {
  assert.deepEqual(evaluateShowModeReadiness({
    calibrated: true,
    recognitionStatus: "ok",
  }), {
    allowed: true,
    reason: null,
  });
  assert.deepEqual(evaluateShowModeReadiness({
    calibrated: true,
    recognitionStatus: "background-mismatch",
  }), {
    allowed: false,
    reason: "recapture-background",
  });
});

test("sound triggering requires a live healthy calibrated-Lab result", () => {
  const healthy = { mode: "calibrated-lab", status: "ok" };
  assert.equal(canTriggerCalibratedRecognition({ live: true, result: healthy }), true);
  assert.equal(canTriggerCalibratedRecognition({ live: false, result: healthy }), false);
  assert.equal(canTriggerCalibratedRecognition({
    live: true,
    result: { mode: "hsv-fallback", status: "needs-calibration" },
  }), false);
  assert.equal(canTriggerCalibratedRecognition({
    live: true,
    result: { mode: "calibrated-lab", status: "background-mismatch" },
  }), false);
});
