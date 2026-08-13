const REFERENCE_WHITE = Object.freeze({ x: 0.95047, y: 1, z: 1.08883 });

export function rgbToLab(red, green, blue) {
  const r = linearizeSrgb(red);
  const g = linearizeSrgb(green);
  const b = linearizeSrgb(blue);
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;
  const fx = labPivot(x / REFERENCE_WHITE.x);
  const fy = labPivot(y / REFERENCE_WHITE.y);
  const fz = labPivot(z / REFERENCE_WHITE.z);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function hexToLab(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!match) throw new TypeError(`无效颜色：${String(hex)}`);
  return rgbToLab(
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  );
}

export function colorDistance(first, second) {
  return Math.hypot(
    Number(first?.l) - Number(second?.l),
    Number(first?.a) - Number(second?.a),
    Number(first?.b) - Number(second?.b),
  );
}

export function classifyColor(lab, prototypes = [], options = {}) {
  const maxDistance = finiteOr(options.maxDistance, 36);
  const minMargin = finiteOr(options.minMargin, 3);
  const ranked = prototypes
    .filter((prototype) => prototype?.lab)
    .map((prototype) => ({ prototype, distance: colorDistance(lab, prototype.lab) }))
    .filter((candidate) => Number.isFinite(candidate.distance))
    .sort((first, second) => first.distance - second.distance);
  const best = ranked[0];
  if (!best || best.distance > maxDistance) return null;
  const runnerUp = ranked[1];
  const margin = runnerUp ? runnerUp.distance - best.distance : Infinity;
  if (margin < minMargin) return null;
  const distanceConfidence = maxDistance > 0
    ? clamp(1 - best.distance / maxDistance, 0, 1)
    : Number(best.distance === 0);
  const marginConfidence = Number.isFinite(margin) && minMargin > 0
    ? clamp(margin / (minMargin * 3), 0, 1)
    : 1;
  return {
    ...best.prototype,
    distance: best.distance,
    margin,
    confidence: distanceConfidence * marginConfidence,
  };
}

function linearizeSrgb(value) {
  const channel = clamp(Number(value) / 255, 0, 1);
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function labPivot(value) {
  const delta = 6 / 29;
  return value > delta ** 3
    ? Math.cbrt(value)
    : value / (3 * delta ** 2) + 4 / 29;
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
