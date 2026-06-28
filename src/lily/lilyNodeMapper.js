import { filterLilyPadsForRecognition } from "./lilyRecognition.js";
import { LILY_SCALES, lilyNoteForPosition, scaleStepToNote } from "./lilyScales.js";
import { presetIdForLilyPad } from "./lilyEnsembleMapping.js";

const DEFAULT_FIXED_SOURCE_ID = "fixed-source";
const DEFAULT_INSTRUMENT_ID = "gemidi-marimba";

export function createLilyNodesFromPads(pads = [], frame = {}, options = {}) {
  const width = Math.max(1, numberOr(frame.width, 1));
  const height = Math.max(1, numberOr(frame.height, 1));
  const sourceId = options.sourceId || "";
  const mappingMode = normalizeMappingMode(options.mappingMode);
  const filteredPads = filterLilyPadsForRecognition(pads, { width, height }, options).filter(isUsablePad);
  const spatialRankById = spatialRanksForPads(filteredPads);

  return filteredPads
    .map((pad) => {
      const x = numberOr(pad.centroid?.x, pad.bounds.x + pad.bounds.width / 2);
      const y = numberOr(pad.centroid?.y, pad.bounds.y + pad.bounds.height / 2);
      const hue = numberOr(pad.hue, 0);
      const pitch = pitchForPad({
        pad,
        x,
        y,
        hue,
        rank: spatialRankById.get(String(pad.id)) ?? 0,
        frame: { width, height },
        mappingMode,
        options,
      });
      const color = pad.color ? { ...pad.color } : { r: 255, g: 255, b: 255 };
      return {
        id: String(pad.id),
        padId: String(pad.id),
        label: lilyLabelForPad(pad),
        ruleId: pad.ruleId || null,
        x,
        y,
        radius: visualRadiusForPad(pad, options),
        area: Math.max(1, numberOr(pad.area, 1)),
        hue,
        color,
        brightness: colorBrightness(color),
        scaleStep: pitch.scaleStep,
        octave: pitch.octave,
        note: pitch.note,
        mappingMode,
        voiceId: mappingMode === "color-ensemble" ? ensembleVoiceForPad(pad, options) : null,
        instrumentId: mappingMode === "melody-instrument" ? (options.instrumentId || DEFAULT_INSTRUMENT_ID) : null,
        isSource: String(pad.id) === sourceId,
        isFixedSource: false,
      };
    });
}

export function createFixedSourceNode(frame = {}, options = {}) {
  const width = Math.max(1, numberOr(frame.width, 1));
  const height = Math.max(1, numberOr(frame.height, 1));
  const x = numberOr(options.x, width / 2);
  const y = numberOr(options.y, height / 2);
  const hue = numberOr(options.hue, 185);
  const pitch = lilyNoteForPosition({ hue, y }, { width, height }, options);
  return {
    id: options.id || DEFAULT_FIXED_SOURCE_ID,
    padId: null,
    label: options.label || "Source",
    ruleId: null,
    x,
    y,
    radius: Math.max(8, numberOr(options.radius, 12)),
    area: 1,
    hue,
    color: options.color ? { ...options.color } : { r: 75, g: 215, b: 203 },
    brightness: 0.82,
    scaleStep: pitch.scaleStep,
    octave: pitch.octave,
    note: pitch.note,
    mappingMode: normalizeMappingMode(options.mappingMode),
    voiceId: null,
    instrumentId: options.instrumentId || DEFAULT_INSTRUMENT_ID,
    isSource: true,
    isFixedSource: true,
  };
}

export function pickLilyNodeAtPoint(nodes = [], point = {}, maxDistance = 28) {
  let best = null;
  let bestDistance = Infinity;
  const px = numberOr(point.x, NaN);
  const py = numberOr(point.y, NaN);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

  for (const node of nodes) {
    const distance = Math.hypot(numberOr(node.x, 0) - px, numberOr(node.y, 0) - py);
    const hitRadius = Math.max(numberOr(maxDistance, 28), numberOr(node.radius, 0));
    if (distance <= hitRadius && distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }

  return best;
}

function pitchForPad({ hue, y, rank, frame, mappingMode, options }) {
  if (mappingMode === "melody-instrument" || mappingMode === "color-ensemble") {
    return pitchForSpatialRank(rank, options);
  }
  return lilyNoteForPosition({ hue, y }, frame, options);
}

function pitchForSpatialRank(rank = 0, options = {}) {
  const scaleId = options.scaleId || "major-pentatonic";
  const scale = LILY_SCALES[scaleId] || LILY_SCALES["major-pentatonic"];
  const root = options.root || "C";
  const minOctave = Math.trunc(numberOr(options.minOctave, 3));
  const maxOctave = Math.max(minOctave, Math.trunc(numberOr(options.maxOctave, 5)));
  const scaleLength = Math.max(1, scale.intervals.length);
  const maxStep = scaleLength * (maxOctave - minOctave + 1) - 1;
  const scaleStep = clamp(Math.trunc(numberOr(rank, 0)), 0, maxStep);
  const octave = Math.min(maxOctave, minOctave + Math.floor(scaleStep / scaleLength));
  return {
    scaleStep,
    octave,
    note: scaleStepToNote(scaleId, scaleStep, minOctave, root),
  };
}

function spatialRanksForPads(pads) {
  const ranked = [...pads].sort((a, b) => {
    const ax = numberOr(a.centroid?.x, a.bounds.x + a.bounds.width / 2);
    const bx = numberOr(b.centroid?.x, b.bounds.x + b.bounds.width / 2);
    if (ax !== bx) return ax - bx;
    const ay = numberOr(a.centroid?.y, a.bounds.y + a.bounds.height / 2);
    const by = numberOr(b.centroid?.y, b.bounds.y + b.bounds.height / 2);
    if (ay !== by) return ay - by;
    return String(a.id).localeCompare(String(b.id));
  });
  return new Map(ranked.map((pad, index) => [String(pad.id), index]));
}

function ensembleVoiceForPad(pad, options = {}) {
  return presetIdForLilyPad(pad, options.ensembleAssignments || {}, {
    allowedPresetIds: options.allowedPresetIds,
  });
}

function lilyLabelForPad(pad) {
  const key = `${pad.ruleId || ""} ${pad.instrument || ""} ${pad.label || ""}`.toLowerCase();
  if (key.includes("yellow") || key.includes("snare")) return "黄色珠";
  if (key.includes("green") || key.includes("hihat")) return "绿色珠";
  if (key.includes("purple") || key.includes("tom")) return "紫色珠";
  if (key.includes("cyan") || key.includes("pad")) return "青色珠";
  if (key.includes("blue") || key.includes("clap")) return "蓝色珠";
  if (key.includes("red") || key.includes("kick")) return "红色珠";
  return pad.label ? `${pad.label}` : String(pad.id);
}

function visualRadiusForPad(pad = {}, options = {}) {
  const minRadius = clamp(numberOr(options.visualRadiusMin, 12), 6, 40);
  const maxRadius = Math.max(minRadius, clamp(numberOr(options.visualRadiusMax, 18), 8, 48));
  const areaRadius = Math.sqrt(Math.max(1, numberOr(pad.area, 1))) * 0.36;
  return clamp(areaRadius, minRadius, maxRadius);
}

function normalizeMappingMode(mode) {
  return mode === "melody-instrument" || mode === "color-ensemble" ? mode : "hue-position";
}

function isUsablePad(pad) {
  return Boolean(
    pad &&
    pad.id &&
    pad.bounds &&
    Number.isFinite(Number(pad.bounds.x)) &&
    Number.isFinite(Number(pad.bounds.y)) &&
    Number.isFinite(Number(pad.bounds.width)) &&
    Number.isFinite(Number(pad.bounds.height)) &&
    pad.bounds.width > 0 &&
    pad.bounds.height > 0,
  );
}

function colorBrightness(color) {
  const r = numberOr(color.r, 255);
  const g = numberOr(color.g, 255);
  const b = numberOr(color.b, 255);
  return clamp((r * 0.2126 + g * 0.7152 + b * 0.0722) / 255, 0, 1);
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
