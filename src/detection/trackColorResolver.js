export class TrackColorResolver {
  constructor(options = {}) {
    this.options = {
      windowSize: 5,
      confirmVotes: 3,
      minConfidence: 0.1,
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
      recordObservation(state, pad, this.options);
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
    lastObservedAt: null,
  };
}

function recordObservation(state, pad, options) {
  const hasTimestamp = Number.isFinite(pad.observedAt);
  if (hasTimestamp && state.lastObservedAt === pad.observedAt) return;
  if (hasTimestamp) state.lastObservedAt = pad.observedAt;
  const confidence = Number.isFinite(pad.classification?.confidence)
    ? pad.classification.confidence
    : 1;
  if (!pad.ruleId || confidence < options.minConfidence) return;
  state.votes.push({
    ruleId: pad.ruleId,
    instrument: pad.instrument,
    label: pad.label,
  });
  if (state.votes.length > options.windowSize) {
    state.votes.splice(0, state.votes.length - options.windowSize);
  }
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
