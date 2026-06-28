const DEFAULT_OPTIONS = {
  spreadMs: 175,
  allowFeedback: false,
  maxTriggers: 24,
  maxNeighbors: 6,
};

export function createLilyPulseEvents(graph, sourceId, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxTriggers = Math.max(1, Math.floor(numberOr(opts.maxTriggers, DEFAULT_OPTIONS.maxTriggers)));
  const maxNeighbors = Math.max(1, Math.floor(numberOr(opts.maxNeighbors, DEFAULT_OPTIONS.maxNeighbors)));
  const spreadMs = Math.max(1, numberOr(opts.spreadMs, DEFAULT_OPTIONS.spreadMs));
  const nodesById = new Map((graph.nodes || []).map((node) => [node.id, node]));
  if (!nodesById.has(sourceId)) return [];

  const events = [];
  const visited = new Set();
  const queue = [{ nodeId: sourceId, depth: 0, fromId: null }];

  while (queue.length && events.length < maxTriggers) {
    const current = queue.shift();
    if (!opts.allowFeedback && visited.has(current.nodeId)) continue;
    if (!opts.allowFeedback) visited.add(current.nodeId);

    const node = nodesById.get(current.nodeId);
    if (!node) continue;
    events.push({
      node,
      nodeId: node.id,
      fromId: current.fromId,
      depth: current.depth,
      delayMs: current.depth * spreadMs,
      velocity: velocityForNode(node, current.depth),
      voiceRole: voiceRoleForDepth(current.depth),
      voiceId: voiceIdForEvent(node, opts),
      instrumentId: instrumentIdForEvent(node, opts),
      scaleStep: node.scaleStep,
      octave: node.octave,
      note: node.note,
    });

    if (events.length >= maxTriggers) break;
    const neighbors = (graph.neighborsById?.[current.nodeId] || []).slice(0, maxNeighbors);
    for (const neighbor of neighbors) {
      if (!opts.allowFeedback && visited.has(neighbor.id)) continue;
      queue.push({ nodeId: neighbor.id, depth: current.depth + 1, fromId: current.nodeId });
    }
  }

  return events;
}

function velocityForNode(node, depth) {
  const brightness = Number.isFinite(Number(node.brightness)) ? Number(node.brightness) : 0.7;
  return clamp(0.34 + brightness * 0.48 - depth * 0.035, 0.18, 0.92);
}

function voiceRoleForDepth(depth) {
  if (depth <= 0) return "sourcePulse";
  if (depth === 1) return "pluck";
  if (depth === 2) return "bell";
  return "padTail";
}

function voiceIdForEvent(node, options) {
  if (options.mappingMode === "color-ensemble" && node.voiceId) return node.voiceId;
  return node.voiceId || null;
}

function instrumentIdForEvent(node, options) {
  if (options.mappingMode === "melody-instrument") {
    return options.instrumentId || node.instrumentId || "gemidi-marimba";
  }
  return node.instrumentId || null;
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
