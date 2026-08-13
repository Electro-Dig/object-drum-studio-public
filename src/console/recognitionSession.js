import {
  createBackgroundModel,
  detectCalibratedObjects,
} from "../detection/calibratedColorDetector.js";
import { hexToLab } from "../detection/colorMetrics.js";
import { detectColorPadsFromRgba } from "../detection/colorSegmentation.js";
import { PadTracker } from "../detection/padTracker.js";
import { TrackColorResolver } from "../detection/trackColorResolver.js";
import { MAPPING_MODES, activeColorRules, normalizeProfile } from "./profile.js";

export function colorPrototypesFromProfile(profileValue) {
  const profile = normalizeProfile(profileValue);
  const enabled = profile.slots.filter((slot) => slot.enabled);
  const slots = profile.mappingMode === MAPPING_MODES.SAME_COLOR_RANDOM
    ? enabled.slice(0, 1)
    : enabled;
  return slots.map((slot) => ({
    ruleId: slot.colorRule.id,
    instrument: slot.id,
    label: slot.label,
    colorHex: slot.colorHex,
    lab: hexToLab(slot.colorHex),
  }));
}

export class ConsoleRecognitionSession {
  constructor(profileValue) {
    this.backgroundModel = null;
    this.configure(profileValue);
  }

  configure(profileValue) {
    this.profile = normalizeProfile(profileValue);
    this.prototypes = colorPrototypesFromProfile(this.profile);
    this.colorRules = activeColorRules(this.profile);
    this.tracker = new PadTracker({
      confirmFrames: 1,
      missingTtlMs: this.profile.recognition.missingTtlMs,
      maxMatchDistance: 64,
      minIoU: 0.035,
      smoothing: 0.3,
      strictRuleMatch: false,
    });
    const confirmVotes = Math.max(3, this.profile.recognition.confirmFrames);
    this.colorResolver = new TrackColorResolver({
      windowSize: Math.max(5, confirmVotes),
      confirmVotes,
      minConfidence: 0.08,
    });
  }

  captureBackground(rgba, width, height) {
    this.backgroundModel = createBackgroundModel(rgba, width, height);
    this.resetTracking();
    return this.backgroundModel;
  }

  clearBackground() {
    this.backgroundModel = null;
    this.resetTracking();
  }

  get calibrated() {
    return !!this.backgroundModel;
  }

  resetTracking() {
    this.tracker.reset();
    this.colorResolver.reset();
  }

  process(rgba, width, height, timeMs = 0) {
    if (this.backgroundModel
      && (this.backgroundModel.width !== width || this.backgroundModel.height !== height)) {
      this.clearBackground();
    }

    let candidates;
    let mode;
    let status;
    let foregroundFraction = 0;
    if (this.backgroundModel) {
      const result = detectCalibratedObjects(rgba, width, height, {
        backgroundModel: this.backgroundModel,
        prototypes: this.prototypes,
        minArea: this.profile.recognition.minArea,
        maxObjects: 24,
        foregroundDeltaE: 12,
        maxForegroundFraction: 0.62,
        maxColorDistance: 36,
        minColorMargin: 3,
        innerShrink: 0.18,
      });
      mode = "calibrated-lab";
      status = result.status;
      foregroundFraction = result.foregroundFraction;
      if (result.status === "background-mismatch") {
        this.resetTracking();
        return { mode, status, pads: [], foregroundFraction };
      }
      candidates = result.pads;
    } else {
      mode = "hsv-fallback";
      status = "needs-calibration";
      candidates = detectColorPadsFromRgba(rgba, width, height, {
        colorRules: this.colorRules,
        minArea: this.profile.recognition.minArea,
        maxPads: 24,
      });
    }

    const tracked = this.tracker.update(candidates, timeMs);
    const pads = this.colorResolver.update(tracked);
    return { mode, status, pads, foregroundFraction };
  }
}
