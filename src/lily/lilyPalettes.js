const LOCAL_PALETTES = [
  {
    id: "gemidi-marimba",
    name: "Gemidi Marimba",
    source: "local",
    mappingMode: "melody-instrument",
    effects: { reverbWet: 0.48, reverbDecay: 2.4, limiterDb: -2 },
    voices: {
      sourcePulse: { role: "sourcePulse", synth: "marimba", gain: 0.54, attack: 0.004, decay: 0.22, sustain: 0.05, release: 0.52, duration: 0.2, cutoff: 5200 },
      pluck: { role: "pluck", synth: "marimba", gain: 0.7, attack: 0.003, decay: 0.2, sustain: 0.04, release: 0.42, duration: 0.18, cutoff: 5600 },
      bell: { role: "bell", synth: "marimba", gain: 0.6, attack: 0.004, decay: 0.24, sustain: 0.04, release: 0.62, duration: 0.22, cutoff: 6200 },
      padTail: { role: "padTail", synth: "marimba", gain: 0.44, attack: 0.006, decay: 0.26, sustain: 0.035, release: 0.85, duration: 0.28, cutoff: 4800 },
      bassRoot: { role: "bassRoot", synth: "marimba", gain: 0.34, attack: 0.006, decay: 0.28, sustain: 0.06, release: 0.72, duration: 0.28, cutoff: 4200 },
    },
  },
  {
    id: "pond-ensemble",
    name: "Pond Ensemble",
    source: "local",
    mappingMode: "color-ensemble",
    effects: { reverbWet: 0.42, reverbDecay: 2.8, limiterDb: -2 },
    voices: {
      sourcePulse: { role: "sourcePulse", synth: "marimba", gain: 0.48, attack: 0.004, decay: 0.22, sustain: 0.05, release: 0.5, duration: 0.2, cutoff: 5200 },
      pluck: { role: "pluck", synth: "marimba", gain: 0.62, attack: 0.003, decay: 0.2, sustain: 0.04, release: 0.42, duration: 0.18, cutoff: 5600 },
      bell: { role: "bell", synth: "triangle", gain: 0.48, attack: 0.006, decay: 0.24, sustain: 0.06, release: 0.72, duration: 0.28, cutoff: 6400 },
      padTail: { role: "padTail", synth: "triangle", gain: 0.28, attack: 0.08, decay: 0.34, sustain: 0.18, release: 1.3, duration: 0.7, cutoff: 3800 },
      bassRoot: { role: "bassRoot", synth: "sine", gain: 0.26, attack: 0.02, decay: 0.22, sustain: 0.08, release: 0.58, duration: 0.28, cutoff: 3600 },
      "warm-marimba": { role: "warm-marimba", synth: "marimba", gain: 0.66, attack: 0.004, decay: 0.22, sustain: 0.05, release: 0.48, duration: 0.18, cutoff: 5400 },
      "bright-marimba": { role: "bright-marimba", synth: "marimba", gain: 0.62, attack: 0.003, decay: 0.18, sustain: 0.04, release: 0.38, duration: 0.16, cutoff: 6600 },
      "soft-kalimba": { role: "soft-kalimba", synth: "pluck", gain: 0.7, attack: 0.002, release: 0.24, duration: 0.16, cutoff: 4400 },
      "glass-accent": { role: "glass-accent", synth: "fm", gain: 0.46, attack: 0.004, decay: 0.2, sustain: 0.06, release: 0.9, duration: 0.26, cutoff: 7200 },
      "airy-pad": { role: "airy-pad", synth: "triangle", gain: 0.3, attack: 0.12, decay: 0.28, sustain: 0.18, release: 1.4, duration: 0.8, cutoff: 3600 },
    },
  },
  {
    id: "water-pluck",
    name: "Water Pluck",
    source: "local",
    voices: {
      sourcePulse: { role: "sourcePulse", synth: "sine", gain: 0.58, attack: 0.012, release: 0.42, duration: 0.22 },
      pluck: { role: "pluck", synth: "pluck", gain: 0.78, attack: 0.002, release: 0.22, duration: 0.16 },
      bell: { role: "bell", synth: "fm", gain: 0.58, attack: 0.004, release: 0.72, duration: 0.38 },
      padTail: { role: "padTail", synth: "triangle", gain: 0.34, attack: 0.08, release: 1.2, duration: 0.75 },
      bassRoot: { role: "bassRoot", synth: "sine", gain: 0.28, attack: 0.02, release: 0.45, duration: 0.3 },
    },
  },
  {
    id: "glass-bell",
    name: "Glass Bell",
    source: "local",
    voices: {
      sourcePulse: { role: "sourcePulse", synth: "triangle", gain: 0.48, attack: 0.01, release: 0.5, duration: 0.24 },
      pluck: { role: "pluck", synth: "fm", gain: 0.62, attack: 0.001, release: 0.32, duration: 0.2 },
      bell: { role: "bell", synth: "fm", gain: 0.72, attack: 0.003, release: 1.1, duration: 0.48 },
      padTail: { role: "padTail", synth: "sine", gain: 0.28, attack: 0.16, release: 1.6, duration: 0.95 },
      bassRoot: { role: "bassRoot", synth: "triangle", gain: 0.24, attack: 0.04, release: 0.62, duration: 0.36 },
    },
  },
  {
    id: "kalimba-garden",
    name: "Kalimba Garden",
    source: "local",
    voices: {
      sourcePulse: { role: "sourcePulse", synth: "pluck", gain: 0.52, attack: 0.002, release: 0.28, duration: 0.2 },
      pluck: { role: "pluck", synth: "pluck", gain: 0.86, attack: 0.001, release: 0.18, duration: 0.14 },
      bell: { role: "bell", synth: "triangle", gain: 0.52, attack: 0.006, release: 0.44, duration: 0.25 },
      padTail: { role: "padTail", synth: "sine", gain: 0.24, attack: 0.1, release: 0.9, duration: 0.62 },
      bassRoot: { role: "bassRoot", synth: "sine", gain: 0.26, attack: 0.01, release: 0.32, duration: 0.24 },
    },
  },
  {
    id: "warm-pond",
    name: "Warm Pond",
    source: "local",
    voices: {
      sourcePulse: { role: "sourcePulse", synth: "sine", gain: 0.44, attack: 0.05, release: 0.85, duration: 0.42 },
      pluck: { role: "pluck", synth: "triangle", gain: 0.52, attack: 0.01, release: 0.38, duration: 0.24 },
      bell: { role: "bell", synth: "fm", gain: 0.42, attack: 0.02, release: 0.9, duration: 0.48 },
      padTail: { role: "padTail", synth: "sawtooth", gain: 0.2, attack: 0.24, release: 1.8, duration: 1.2 },
      bassRoot: { role: "bassRoot", synth: "sine", gain: 0.2, attack: 0.08, release: 0.9, duration: 0.5 },
    },
  },
];

const PALETTES_BY_ID = Object.fromEntries(LOCAL_PALETTES.map((palette) => [palette.id, palette]));
const DEFAULT_PALETTE_ID = "gemidi-marimba";

export function listLilyPalettes() {
  return LOCAL_PALETTES.map(cloneJson);
}

export function getLilyPalette(id = DEFAULT_PALETTE_ID) {
  return cloneJson(PALETTES_BY_ID[id] || PALETTES_BY_ID[DEFAULT_PALETTE_ID]);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
