export class TrackColorResolver {
  constructor(options = {}) {
    this.options = {
      windowSize: 5,
      confirmVotes: 3,
      minConfidence: 0.1,
      switchVotes: 3,
      switchConfidence: 0.7,
      ...options,
    };
    this.states = new Map();
  }

  reset() {
    this.states.clear();
  }

  update(pads = []) {
    const activeIds = new Set();
    const resolved = [];
    for (const pad of Array.isArray(pads) ? pads : []) {
      if (!pad?.id) continue;
      activeIds.add(pad.id);
      const state = this.states.get(pad.id) ?? createState();
      this.states.set(pad.id, state);
      const isFreshObservation = recordObservation(state, pad, this.options);
      if (state.locked && isFreshObservation) updateSwitchEvidence(state, pad, this.options);
      if (!state.locked) state.switchCandidate = null;
      if (!state.locked) state.locked = resolveIdentity(state.votes, this.options.confirmVotes);
      if (!state.locked) continue;
      resolved.push({
        ...pad,
        ruleId: state.locked.ruleId,
        instrument: state.locked.instrument,
        label: state.locked.label,
      });
    }
    for (const id of this.states.keys()) {
      if (!activeIds.has(id)) this.states.delete(id);
    }
    return resolved;
  }
}

function createState() {
  return {
    votes: [],
    locked: null,
    switchCandidate: null,
    lastObservedAt: null,
  };
}

function updateSwitchEvidence(state, pad, options) {
  const confidence = Number.isFinite(pad.classification?.confidence)
    ? pad.classification.confidence
    : 1;
  if (!pad.ruleId || pad.ruleId === state.locked.ruleId || confidence < options.switchConfidence) {
    state.switchCandidate = null;
    return;
  }
  if (state.switchCandidate?.ruleId === pad.ruleId) {
    state.switchCandidate.count += 1;
  } else {
    state.switchCandidate = {
      ruleId: pad.ruleId,
      instrument: pad.instrument,
      label: pad.label,
      count: 1,
    };
  }
  if (state.switchCandidate.count < options.switchVotes) return;
  const identity = {
    ruleId: state.switchCandidate.ruleId,
    instrument: state.switchCandidate.instrument,
    label: state.switchCandidate.label,
  };
  state.locked = null;
  state.switchCandidate = null;
  state.votes = [identity];
}

function recordObservation(state, pad, options) {
  const hasTimestamp = Number.isFinite(pad.observedAt);
  if (hasTimestamp && state.lastObservedAt === pad.observedAt) return false;
  if (hasTimestamp) state.lastObservedAt = pad.observedAt;
  const confidence = Number.isFinite(pad.classification?.confidence)
    ? pad.classification.confidence
    : 1;
  if (!pad.ruleId || confidence < options.minConfidence) return true;
  state.votes.push({
    ruleId: pad.ruleId,
    instrument: pad.instrument,
    label: pad.label,
  });
  if (state.votes.length > options.windowSize) {
    state.votes.splice(0, state.votes.length - options.windowSize);
  }
  return true;
}

function resolveIdentity(votes, confirmVotes) {
  const groups = new Map();
  for (const vote of votes) {
    const group = groups.get(vote.ruleId) ?? { count: 0, identity: vote };
    group.count += 1;
    group.identity = vote;
    groups.set(vote.ruleId, group);
  }
  const ranked = [...groups.values()].sort((first, second) => second.count - first.count);
  if (!ranked[0] || ranked[0].count < confirmVotes) return null;
  if (ranked[1]?.count === ranked[0].count) return null;
  return { ...ranked[0].identity };
}
