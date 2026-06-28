const DEFAULT_OPTIONS = {
  strict: true,
  lockedRuleIds: [],
  maxNodes: 12,
  maxAreaRatio: 0.075,
  maxBoundsRatio: 0.42,
  allowUnlockedWhenEmpty: true,
};

export function activeLilyColorRules(colorRules = [], options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lockedRuleIds = normalizeLockedRuleIds(opts.lockedRuleIds);
  const enabledRules = Array.isArray(colorRules)
    ? colorRules.filter((rule) => rule && rule.enabled !== false)
    : [];

  if (opts.strict && lockedRuleIds.size) {
    return enabledRules.filter((rule) => lockedRuleIds.has(String(rule.id || "")));
  }

  return enabledRules;
}

export function filterLilyPadsForRecognition(pads = [], frame = {}, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lockedRuleIds = normalizeLockedRuleIds(opts.lockedRuleIds);
  const strictLocked = Boolean(opts.strict && lockedRuleIds.size);
  const width = Math.max(1, numberOr(frame.width, 1));
  const height = Math.max(1, numberOr(frame.height, 1));
  const frameArea = width * height;
  const maxArea = Math.max(1, numberOr(opts.maxArea, frameArea * numberOr(opts.maxAreaRatio, DEFAULT_OPTIONS.maxAreaRatio)));
  const maxWidth = Math.max(1, numberOr(opts.maxWidth, width * numberOr(opts.maxBoundsRatio, DEFAULT_OPTIONS.maxBoundsRatio)));
  const maxHeight = Math.max(1, numberOr(opts.maxHeight, height * numberOr(opts.maxBoundsRatio, DEFAULT_OPTIONS.maxBoundsRatio)));
  const maxNodes = Math.max(1, Math.floor(numberOr(opts.maxNodes, DEFAULT_OPTIONS.maxNodes)));

  return (Array.isArray(pads) ? pads : [])
    .filter((pad) => isAllowedPad(pad, {
      strictLocked,
      lockedRuleIds,
      maxArea,
      maxWidth,
      maxHeight,
    }))
    .sort((a, b) => numberOr(b.area, 0) - numberOr(a.area, 0))
    .slice(0, maxNodes);
}

export function shouldCreatePlayableLilyNodes(options = {}) {
  return true;
}

export function normalizeLockedRuleIds(ruleIds = []) {
  return new Set(
    (Array.isArray(ruleIds) ? ruleIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
}

function isAllowedPad(pad, options) {
  if (!pad || !pad.bounds) return false;
  if (options.strictLocked && !options.lockedRuleIds.has(String(pad.ruleId || ""))) return false;

  const width = numberOr(pad.bounds.width, 0);
  const height = numberOr(pad.bounds.height, 0);
  if (width <= 0 || height <= 0) return false;
  if (width > options.maxWidth || height > options.maxHeight) return false;
  if (numberOr(pad.area, width * height) > options.maxArea) return false;

  return true;
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
