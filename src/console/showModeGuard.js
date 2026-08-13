export function evaluateShowModeReadiness({ calibrated, recognitionStatus } = {}) {
  if (recognitionStatus === "background-mismatch") {
    return { allowed: false, reason: "recapture-background" };
  }
  if (!calibrated || recognitionStatus !== "ok") {
    return { allowed: false, reason: "capture-background" };
  }
  return { allowed: true, reason: null };
}

export function canTriggerCalibratedRecognition({ live, result } = {}) {
  return !!live && result?.mode === "calibrated-lab" && result?.status === "ok";
}
