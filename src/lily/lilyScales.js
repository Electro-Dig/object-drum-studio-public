const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ROOTS = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export const LILY_SCALES = {
  "major-pentatonic": { id: "major-pentatonic", label: "Major Pentatonic", intervals: [0, 2, 4, 7, 9] },
  "minor-pentatonic": { id: "minor-pentatonic", label: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10] },
  major: { id: "major", label: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { id: "minor", label: "Minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
  lydian: { id: "lydian", label: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
};

export function scaleStepToNote(scaleId = "major-pentatonic", scaleStep = 0, octave = 3, root = "C") {
  const scale = scaleFor(scaleId);
  const intervals = scale.intervals;
  const safeStep = Math.trunc(numberOr(scaleStep, 0));
  const octaveOffset = Math.floor(safeStep / intervals.length);
  const interval = intervals[wrapIndex(safeStep, intervals.length)];
  const rootSemitone = ROOTS[root] ?? ROOTS.C;
  return noteName(rootSemitone + interval, Math.trunc(numberOr(octave, 3)) + octaveOffset);
}

export function hueToScaleStep(hue = 0, scaleId = "major-pentatonic") {
  const count = scaleFor(scaleId).intervals.length;
  const normalized = normalizeHue(hue);
  return Math.min(count - 1, Math.floor(normalized / (360 / count)));
}

export function octaveFromY(y = 0, height = 1, options = {}) {
  const minOctave = Math.trunc(numberOr(options.minOctave, 2));
  const maxOctave = Math.trunc(numberOr(options.maxOctave, 4));
  const safeHeight = Math.max(1, numberOr(height, 1));
  const ratio = clamp(numberOr(y, 0) / safeHeight, 0, 1);
  return Math.round(maxOctave - ratio * (maxOctave - minOctave));
}

export function lilyNoteForPosition({ hue = 0, y = 0 } = {}, frame = {}, options = {}) {
  const scaleId = options.scaleId || "major-pentatonic";
  const scaleStep = hueToScaleStep(hue, scaleId);
  const octave = octaveFromY(y, frame.height, options);
  return {
    scaleStep,
    octave,
    note: scaleStepToNote(scaleId, scaleStep, octave, options.root || "C"),
  };
}

function scaleFor(scaleId) {
  return LILY_SCALES[scaleId] || LILY_SCALES["major-pentatonic"];
}

function noteName(semitone, octave) {
  const normalized = wrapIndex(semitone, 12);
  const octaveOffset = Math.floor(semitone / 12);
  return `${NOTE_NAMES[normalized]}${octave + octaveOffset}`;
}

function normalizeHue(hue) {
  return ((numberOr(hue, 0) % 360) + 360) % 360;
}

function wrapIndex(index, count) {
  const safeCount = Math.max(1, Number(count) || 1);
  return ((Math.trunc(Number(index) || 0) % safeCount) + safeCount) % safeCount;
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
