export const MELODIC_PRESET_CATEGORIES = ["Lead", "Pad", "Pluck", "Mallet", "Bell", "Bass", "FX"];

const BUILT_IN_MELODIC_PRESETS = [
  {
    id: "gemidi-marimba",
    name: "Gemidi Marimba",
    category: "Mallet",
    engine: "tone-synth",
    synth: "marimba",
    kind: "drum",
    tags: ["Melodic", "Mallet", "Lily"],
    params: {
      gain: 0.7,
      attack: 0.004,
      decay: 0.22,
      sustain: 0.05,
      release: 0.52,
      duration: 0.2,
      cutoff: 5200,
      room: 0.48,
      delay: 0.06,
    },
  },
  {
    id: "warm-pluck",
    name: "Warm Pluck",
    category: "Pluck",
    engine: "tone-synth",
    synth: "pluck",
    kind: "drum",
    tags: ["Melodic", "Pluck", "Short"],
    params: {
      gain: 0.74,
      attack: 0.002,
      decay: 0.16,
      sustain: 0.02,
      release: 0.26,
      duration: 0.16,
      cutoff: 4600,
      room: 0.34,
      delay: 0.04,
    },
  },
  {
    id: "glass-bell",
    name: "Glass Bell",
    category: "Bell",
    engine: "tone-synth",
    synth: "fm",
    kind: "drum",
    tags: ["Melodic", "Bell", "Glass"],
    params: {
      gain: 0.5,
      attack: 0.004,
      decay: 0.2,
      sustain: 0.06,
      release: 0.9,
      duration: 0.28,
      cutoff: 7200,
      room: 0.52,
      delay: 0.08,
    },
  },
  {
    id: "soft-kalimba",
    name: "Soft Kalimba",
    category: "Pluck",
    engine: "tone-synth",
    synth: "pluck",
    kind: "drum",
    tags: ["Melodic", "Kalimba", "Soft"],
    params: {
      gain: 0.72,
      attack: 0.002,
      decay: 0.14,
      sustain: 0.02,
      release: 0.24,
      duration: 0.15,
      cutoff: 4300,
      room: 0.4,
      delay: 0.05,
    },
  },
  {
    id: "airy-pad",
    name: "Airy Pad",
    category: "Pad",
    engine: "tone-synth",
    synth: "triangle",
    kind: "pad",
    tags: ["Melodic", "Pad", "Air"],
    params: {
      gain: 0.3,
      attack: 0.14,
      decay: 0.32,
      sustain: 0.2,
      release: 1.45,
      duration: 0.85,
      cutoff: 3600,
      room: 0.62,
      delay: 0.08,
    },
  },
  {
    id: "bass-pulse",
    name: "Bass Pulse",
    category: "Bass",
    engine: "tone-synth",
    synth: "sine",
    kind: "drum",
    tags: ["Melodic", "Bass", "Pulse"],
    params: {
      gain: 0.42,
      attack: 0.015,
      decay: 0.2,
      sustain: 0.08,
      release: 0.5,
      duration: 0.24,
      cutoff: 3200,
      room: 0.22,
      delay: 0.02,
    },
  },
  {
    id: "bright-lead",
    name: "Bright Lead",
    category: "Lead",
    engine: "tone-synth",
    synth: "triangle",
    kind: "drum",
    tags: ["Melodic", "Lead", "Bright"],
    params: {
      gain: 0.46,
      attack: 0.006,
      decay: 0.22,
      sustain: 0.1,
      release: 0.42,
      duration: 0.24,
      cutoff: 6200,
      room: 0.34,
      delay: 0.06,
    },
  },
  {
    id: "shimmer-fx",
    name: "Shimmer FX",
    category: "FX",
    engine: "tone-synth",
    synth: "fm",
    kind: "drum",
    tags: ["Melodic", "FX", "Shimmer"],
    params: {
      gain: 0.34,
      attack: 0.02,
      decay: 0.3,
      sustain: 0.08,
      release: 1.2,
      duration: 0.45,
      cutoff: 7800,
      room: 0.7,
      delay: 0.16,
    },
  },
];

const PRESETS_BY_ID = new Map(BUILT_IN_MELODIC_PRESETS.map((preset) => [preset.id, preset]));

export function listMelodicPresets() {
  return BUILT_IN_MELODIC_PRESETS.map(cloneJson);
}

export function getMelodicPreset(id = "gemidi-marimba") {
  return cloneJson(PRESETS_BY_ID.get(String(id || "")) || PRESETS_BY_ID.get("gemidi-marimba"));
}

export function hasMelodicPreset(id) {
  return PRESETS_BY_ID.has(String(id || ""));
}

export function melodicPresetToCapsule(presetOrId) {
  const preset = normalizeMelodicPreset(presetOrId);
  return {
    id: `melodic-${preset.id}`,
    type: "web-audio-synth",
    kind: preset.kind,
    source: {
      alias: preset.synth,
      presetId: preset.id,
      category: preset.category,
    },
    params: {
      ...preset.params,
      clip: preset.params.duration,
      lpf: preset.params.cutoff,
    },
    controls: controlsForPreset(preset),
  };
}

export function melodicPresetToLilyVoice(presetOrId, { role } = {}) {
  const preset = normalizeMelodicPreset(presetOrId);
  return {
    role: role || preset.id,
    synth: preset.synth,
    gain: clamp(numberOr(preset.params.gain, 0.62), 0.05, 1.2),
    attack: clamp(numberOr(preset.params.attack, 0.006), 0.001, 1),
    decay: clamp(numberOr(preset.params.decay, 0.22), 0.01, 2),
    sustain: clamp(numberOr(preset.params.sustain, 0.05), 0, 1),
    release: clamp(numberOr(preset.params.release, 0.48), 0.03, 3),
    duration: clamp(numberOr(preset.params.duration, 0.24), 0.04, 2.8),
    cutoff: numberOr(preset.params.cutoff, 5600),
  };
}

export function melodicPresetToLilyPalette(presetOrId, options = {}) {
  const preset = normalizeMelodicPreset(presetOrId);
  const baseVoice = melodicPresetToLilyVoice(preset, { role: "pluck" });
  const sourcePulse = {
    ...baseVoice,
    role: "sourcePulse",
    gain: clamp(baseVoice.gain * 0.78, 0.05, 1.2),
    duration: clamp(baseVoice.duration * 1.05, 0.04, 2.8),
  };
  return {
    id: `melodic-${preset.id}`,
    name: preset.name,
    source: "global-preset",
    presetId: preset.id,
    mappingMode: options.mappingMode || "melody-instrument",
    effects: {
      reverbWet: clamp(numberOr(preset.params.room, 0.38), 0, 0.9),
      reverbDecay: clamp(numberOr(preset.params.reverbDecay, 2.4), 0.2, 8),
      limiterDb: -2,
    },
    voices: {
      sourcePulse,
      pluck: baseVoice,
      bell: { ...baseVoice, role: "bell", gain: clamp(baseVoice.gain * 0.86, 0.05, 1.2) },
      padTail: { ...baseVoice, role: "padTail", gain: clamp(baseVoice.gain * 0.58, 0.05, 1.2), duration: clamp(baseVoice.duration * 1.8, 0.04, 2.8) },
      bassRoot: { ...baseVoice, role: "bassRoot", gain: clamp(baseVoice.gain * 0.48, 0.05, 1.2), cutoff: Math.min(baseVoice.cutoff, 4200) },
    },
  };
}

export function normalizeMelodicPreset(presetOrId) {
  if (typeof presetOrId === "string" || !presetOrId) return getMelodicPreset(presetOrId);
  const fallback = getMelodicPreset("gemidi-marimba");
  const category = MELODIC_PRESET_CATEGORIES.includes(presetOrId.category) ? presetOrId.category : fallback.category;
  const id = String(presetOrId.id || fallback.id).trim() || fallback.id;
  const params = {
    ...fallback.params,
    ...(presetOrId.params && typeof presetOrId.params === "object" ? presetOrId.params : {}),
  };
  return {
    id,
    name: String(presetOrId.name || fallback.name).trim() || fallback.name,
    category,
    engine: presetOrId.engine === "tone-synth" ? "tone-synth" : fallback.engine,
    synth: normalizeSynth(presetOrId.synth || fallback.synth),
    kind: presetOrId.kind === "pad" ? "pad" : "drum",
    tags: Array.isArray(presetOrId.tags) ? presetOrId.tags.map(String) : [...fallback.tags],
    params,
  };
}

function controlsForPreset(preset) {
  return {
    gain: { label: "Gain", min: 0, max: 1.4, step: 0.01 },
    cutoff: { label: "Cutoff", min: 800, max: 12000, step: 10 },
    attack: { label: "Attack", min: 0.001, max: 1, step: 0.001 },
    release: { label: "Release", min: 0.02, max: 2.5, step: 0.01 },
    delay: { label: "Delay", min: 0, max: 0.8, step: 0.01 },
    room: { label: "Room", min: 0, max: 1, step: 0.01 },
  };
}

function normalizeSynth(synth) {
  const value = String(synth || "").trim();
  return ["marimba", "pluck", "fm", "sine", "triangle", "square", "sawtooth", "saw"].includes(value)
    ? value
    : "sine";
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
