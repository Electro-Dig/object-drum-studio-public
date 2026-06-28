import { hasMelodicPreset } from "../audio/melodicPresets.js";

const DEFAULT_PRESET_BY_INSTRUMENT = {
  kick: "gemidi-marimba",
  snare: "glass-bell",
  hihat: "soft-kalimba",
  pad: "airy-pad",
  clap: "warm-pluck",
  tom: "bass-pulse",
};

export function createDefaultLilyEnsembleAssignments(colorRules = []) {
  const assignments = {};
  for (const rule of Array.isArray(colorRules) ? colorRules : []) {
    if (!rule?.id) continue;
    assignments[String(rule.id)] = defaultPresetIdForRule(rule);
  }
  return assignments;
}

export function normalizeLilyEnsembleAssignments(raw = {}, colorRules = [], options = {}) {
  const defaults = createDefaultLilyEnsembleAssignments(colorRules);
  const source = raw && typeof raw === "object" ? raw : {};
  const normalized = {};
  for (const rule of Array.isArray(colorRules) ? colorRules : []) {
    if (!rule?.id) continue;
    const ruleId = String(rule.id);
    const custom = String(source[ruleId] || "").trim();
    normalized[ruleId] = hasAllowedPreset(custom, options) ? custom : defaults[ruleId];
  }
  return normalized;
}

export function presetIdForLilyPad(pad = {}, assignments = {}, options = {}) {
  const ruleId = String(pad.ruleId || "").trim();
  if (ruleId && hasAllowedPreset(assignments?.[ruleId], options)) return assignments[ruleId];
  return defaultPresetIdForRule(pad);
}

export function uniqueAssignedPresetIds(assignments = {}, options = {}) {
  const seen = new Set();
  const ids = [];
  for (const presetId of Object.values(assignments || {})) {
    const id = String(presetId || "").trim();
    if (!id || seen.has(id) || !hasAllowedPreset(id, options)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function defaultPresetIdForRule(rule = {}) {
  const key = `${rule.instrument || ""} ${rule.label || ""} ${rule.id || ""}`.toLowerCase();
  if (key.includes("pad") || key.includes("blue") || key.includes("cyan")) return "airy-pad";
  if (key.includes("hihat") || key.includes("green") || key.includes("kalimba")) return "soft-kalimba";
  if (key.includes("snare") || key.includes("yellow") || key.includes("bell")) return "glass-bell";
  if (key.includes("clap")) return "warm-pluck";
  if (key.includes("tom") || key.includes("bass")) return "bass-pulse";
  return DEFAULT_PRESET_BY_INSTRUMENT[rule.instrument] || "gemidi-marimba";
}

function hasAllowedPreset(id, options = {}) {
  const normalized = String(id || "").trim();
  if (!normalized) return false;
  if (hasMelodicPreset(normalized)) return true;
  const allowed = options.allowedPresetIds;
  if (allowed instanceof Set) return allowed.has(normalized);
  if (Array.isArray(allowed)) return allowed.includes(normalized);
  return false;
}
