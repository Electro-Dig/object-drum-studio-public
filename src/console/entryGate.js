const DEFAULT_OPTIONS = Object.freeze({
  settleDelayMs: 0,
  minStableObservations: 2,
  maxObservationGapMs: 220,
  movementTolerancePx: 4,
  areaChangeRatio: 0.38,
  boundsChangeRatio: 0.38,
  maxAreaRatio: 0.025,
  maxWidthRatio: 0.22,
  maxHeightRatio: 0.35,
  minAspectRatio: 0.4,
  maxAspectRatio: 2.5,
  minCompactness: 0.32,
});

export class EntryGate {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.states = new Map();
  }

  update(pads = [], context = {}) {
    const options = { ...this.options, ...context };
    const stableMode = options.stableMode === true;
    const activeIds = new Set();
    const entries = [];

    for (const pad of Array.isArray(pads) ? pads : []) {
      if (!pad || pad.id == null) continue;
      const id = String(pad.id);
      activeIds.add(id);
      let state = this.states.get(id);
      if (!state) {
        state = createState();
        this.states.set(id, state);
      }

      if (state.emitted) continue;
      if (!stableMode) {
        emitEntry(state, pad, entries);
        continue;
      }

      const observationTime = finiteOr(pad.observedAt, finiteOr(options.timeMs, 0));
      const previousObservedAt = state.lastObservedAt;
      if (previousObservedAt === observationTime) continue;
      state.lastObservedAt = observationTime;

      if (!isObjectLike(pad, options)) {
        resetPendingState(state);
        continue;
      }

      const snapshot = snapshotPad(pad);
      const observationGap = previousObservedAt == null ? 0 : observationTime - previousObservedAt;
      if (
        !state.snapshot
        || observationGap > finiteOr(options.maxObservationGapMs, 220)
        || !isStableContinuation(snapshot, state.snapshot, options)
      ) {
        state.stableSince = observationTime;
        state.stableObservations = 1;
      } else {
        state.stableObservations += 1;
      }
      state.snapshot = snapshot;

      const settleDelayMs = clamp(finiteOr(options.settleDelayMs, 0), 0, 800);
      const stableFor = observationTime - state.stableSince;
      if (
        state.stableObservations >= Math.max(2, Math.round(options.minStableObservations))
        && stableFor >= settleDelayMs
      ) {
        emitEntry(state, pad, entries);
      }
    }

    for (const id of this.states.keys()) {
      if (!activeIds.has(id)) this.states.delete(id);
    }
    return entries;
  }

  lockIdentities(pads = []) {
    return (Array.isArray(pads) ? pads : []).map((pad) => {
      const state = this.states.get(String(pad?.id));
      return state?.emitted && state.frozenIdentity
        ? { ...pad, ...state.frozenIdentity }
        : pad;
    });
  }

  reset() {
    this.states.clear();
  }
}

function createState() {
  return {
    emitted: false,
    frozenIdentity: null,
    lastObservedAt: null,
    stableSince: 0,
    stableObservations: 0,
    snapshot: null,
  };
}

function emitEntry(state, pad, entries) {
  state.emitted = true;
  state.frozenIdentity = {};
  if (pad.ruleId !== undefined) state.frozenIdentity.ruleId = pad.ruleId;
  if (pad.instrument !== undefined) state.frozenIdentity.instrument = pad.instrument;
  if (pad.label !== undefined) state.frozenIdentity.label = pad.label;
  entries.push({ ...pad, ...state.frozenIdentity });
}

function resetPendingState(state) {
  state.stableSince = 0;
  state.stableObservations = 0;
  state.snapshot = null;
}

function snapshotPad(pad) {
  const bounds = pad.bounds ?? {};
  const width = Math.max(0, finiteOr(bounds.width, 0));
  const height = Math.max(0, finiteOr(bounds.height, 0));
  return {
    ruleId: String(pad.ruleId ?? ""),
    area: Math.max(0, finiteOr(pad.area, width * height)),
    width,
    height,
    centroid: {
      x: finiteOr(pad.centroid?.x, finiteOr(bounds.x, 0) + width / 2),
      y: finiteOr(pad.centroid?.y, finiteOr(bounds.y, 0) + height / 2),
    },
  };
}

function isStableContinuation(current, previous, options) {
  if (!current.ruleId || current.ruleId !== previous.ruleId) return false;
  const movement = Math.hypot(
    current.centroid.x - previous.centroid.x,
    current.centroid.y - previous.centroid.y,
  );
  if (movement > finiteOr(options.movementTolerancePx, 4)) return false;
  if (relativeChange(current.area, previous.area) > finiteOr(options.areaChangeRatio, 0.38)) return false;
  if (relativeChange(current.width, previous.width) > finiteOr(options.boundsChangeRatio, 0.38)) return false;
  if (relativeChange(current.height, previous.height) > finiteOr(options.boundsChangeRatio, 0.38)) return false;
  return true;
}

function isObjectLike(pad, options) {
  const snapshot = snapshotPad(pad);
  if (!snapshot.ruleId || snapshot.width <= 0 || snapshot.height <= 0 || snapshot.area <= 0) return false;
  const frameWidth = Math.max(1, finiteOr(options.frameWidth, 1));
  const frameHeight = Math.max(1, finiteOr(options.frameHeight, 1));
  const frameArea = frameWidth * frameHeight;
  const aspectRatio = snapshot.width / snapshot.height;
  const compactness = snapshot.area / (snapshot.width * snapshot.height);
  return snapshot.area / frameArea <= finiteOr(options.maxAreaRatio, 0.025)
    && snapshot.width / frameWidth <= finiteOr(options.maxWidthRatio, 0.22)
    && snapshot.height / frameHeight <= finiteOr(options.maxHeightRatio, 0.35)
    && aspectRatio >= finiteOr(options.minAspectRatio, 0.4)
    && aspectRatio <= finiteOr(options.maxAspectRatio, 2.5)
    && compactness >= finiteOr(options.minCompactness, 0.32);
}

function relativeChange(first, second) {
  const scale = Math.max(1, Math.abs(first), Math.abs(second));
  return Math.abs(first - second) / scale;
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
