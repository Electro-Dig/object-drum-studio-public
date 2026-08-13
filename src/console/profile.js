export const CONSOLE_SCHEMA_VERSION = 2;

export const MAPPING_MODES = Object.freeze({
  TEN_COLOR: "ten-color",
  SIX_COLOR: "six-color",
  SAME_COLOR_RANDOM: "same-color-random",
});

const SUPPORTED_SCHEMA_VERSIONS = new Set([1, CONSOLE_SCHEMA_VERSION]);
const SLOT_COUNT = 10;
const FALLBACK_VOICES = new Set(["kick", "snare", "hat", "tom", "clap", "bell"]);
const SLOT_DEFAULTS = [
  { label: "粉色", color: "#ed77c0", hue: 323, hueRange: 16, minSaturation: 0.3, minValue: 0.32, voice: "clap" },
  { label: "浅蓝", color: "#6ca6e9", hue: 212, hueRange: 16, minSaturation: 0.32, minValue: 0.45, voice: "kick" },
  { label: "红色", color: "#c5332d", hue: 2, hueRange: 15, minSaturation: 0.45, minValue: 0.3, voice: "snare" },
  { label: "深青绿", color: "#357575", hue: 180, hueRange: 18, minSaturation: 0.25, minValue: 0.16, voice: "tom" },
  { label: "深蓝", color: "#4261c0", hue: 225, hueRange: 16, minSaturation: 0.42, minValue: 0.32, voice: "hat" },
  { label: "棕红", color: "#aa4b42", hue: 5, hueRange: 15, minSaturation: 0.4, minValue: 0.28, voice: "bell" },
  { label: "紫色", color: "#692cc3", hue: 264, hueRange: 18, minSaturation: 0.42, minValue: 0.2, voice: "clap" },
  { label: "橙色", color: "#ea9f39", hue: 35, hueRange: 16, minSaturation: 0.42, minValue: 0.28, voice: "tom" },
  { label: "亮黄", color: "#ece847", hue: 59, hueRange: 15, minSaturation: 0.35, minValue: 0.36, voice: "snare" },
  { label: "荧光绿", color: "#b0e548", hue: 80, hueRange: 15, minSaturation: 0.35, minValue: 0.32, voice: "hat" },
];

export function createDefaultProfile() {
  return {
    schemaVersion: CONSOLE_SCHEMA_VERSION,
    id: "default-show",
    name: "现场演出配置",
    mappingMode: MAPPING_MODES.TEN_COLOR,
    masterGain: 0.82,
    recognition: {
      minArea: 72,
      confirmFrames: 2,
      missingTtlMs: 460,
      settleDelayMs: 100,
    },
    camera: {
      mirror: true,
    },
    slots: SLOT_DEFAULTS.map((defaults, index) => createDefaultSlot(index, defaults)),
  };
}

export function normalizeProfile(value = {}) {
  const defaults = createDefaultProfile();
  const source = isRecord(value) ? value : {};
  const sourceSlots = Array.isArray(source.slots) ? source.slots : [];
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) => (
    normalizeSlot(sourceSlots[index], defaults.slots[index], index)
  ));

  return {
    schemaVersion: CONSOLE_SCHEMA_VERSION,
    id: cleanText(source.id, defaults.id, 64),
    name: cleanText(source.name, defaults.name, 80),
    mappingMode: normalizeMappingMode(source.mappingMode),
    masterGain: clampNumber(source.masterGain, 0, 1, defaults.masterGain),
    recognition: {
      minArea: Math.round(clampNumber(source.recognition?.minArea, 12, 4000, defaults.recognition.minArea)),
      confirmFrames: Math.round(clampNumber(source.recognition?.confirmFrames, 1, 6, defaults.recognition.confirmFrames)),
      missingTtlMs: Math.round(clampNumber(source.recognition?.missingTtlMs, 120, 3000, defaults.recognition.missingTtlMs)),
      settleDelayMs: Math.round(clampNumber(source.recognition?.settleDelayMs, 0, 800, defaults.recognition.settleDelayMs)),
    },
    camera: {
      mirror: source.camera?.mirror !== false,
    },
    slots,
  };
}

export function activeColorRules(profileValue) {
  const profile = normalizeProfile(profileValue);
  const enabled = profile.slots.filter((slot) => slot.enabled);
  const slots = profile.mappingMode === MAPPING_MODES.SAME_COLOR_RANDOM
    ? enabled.slice(0, 1)
    : enabled;
  return slots.map((slot) => ({ ...slot.colorRule }));
}

export function validateShowPackage(value) {
  if (!isRecord(value)) {
    throw new Error("配置包格式无效");
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.has(value.schemaVersion)) {
    throw new Error(`不支持的配置包版本：${String(value.schemaVersion ?? "未知")}`);
  }

  const profile = normalizeProfile(value.profile);
  const validSlotIds = new Set(profile.slots.map((slot) => slot.id));
  const samples = {};
  if (isRecord(value.samples)) {
    for (const [slotId, record] of Object.entries(value.samples)) {
      if (!validSlotIds.has(slotId) || !isRecord(record)) continue;
      if (typeof record.dataUrl !== "string" || !record.dataUrl.startsWith("data:audio/")) continue;
      samples[slotId] = {
        name: cleanText(record.name, "现场音效", 120),
        type: cleanText(record.type, dataUrlMime(record.dataUrl), 80),
        dataUrl: record.dataUrl,
      };
    }
  }
  return { schemaVersion: CONSOLE_SCHEMA_VERSION, profile, samples };
}

function createDefaultSlot(index, defaults) {
  const number = index + 1;
  const id = `slot-${number}`;
  return {
    id,
    label: defaults.label,
    enabled: true,
    gain: 0.86,
    fallbackVoice: defaults.voice,
    soundName: "",
    colorHex: defaults.color,
    colorRule: {
      id: `${id}-color`,
      instrument: id,
      label: defaults.label,
      enabled: true,
      hueCenter: defaults.hue,
      hueRange: defaults.hueRange ?? 20,
      saturationCenter: defaults.saturationCenter ?? hexToHsv(defaults.color).s,
      valueCenter: defaults.valueCenter ?? hexToHsv(defaults.color).v,
      minSaturation: defaults.minSaturation ?? 0.35,
      maxSaturation: defaults.maxSaturation ?? 1,
      minValue: defaults.minValue ?? 0.18,
      maxValue: defaults.maxValue ?? 1,
    },
  };
}

function normalizeSlot(value, defaults, index) {
  const source = isRecord(value) ? value : {};
  const id = cleanId(source.id, defaults.id || `slot-${index + 1}`);
  const label = cleanText(source.label, defaults.label, 48);
  const hasSourceRule = isRecord(source.colorRule);
  const sourceRule = hasSourceRule ? source.colorRule : {};
  const colorHex = normalizeHex(source.colorHex, defaults.colorHex);
  const sourceHsv = hexToHsv(colorHex);
  const fallbackVoice = FALLBACK_VOICES.has(source.fallbackVoice)
    ? source.fallbackVoice
    : defaults.fallbackVoice;

  return {
    id,
    label,
    enabled: source.enabled !== false,
    gain: clampNumber(source.gain, 0, 1, defaults.gain),
    fallbackVoice,
    soundName: cleanText(source.soundName, "", 120),
    colorHex,
    colorRule: {
      id: cleanId(sourceRule.id, `${id}-color`),
      instrument: id,
      label,
      enabled: source.enabled !== false,
      hueCenter: normalizeHue(numberOr(sourceRule.hueCenter, defaults.colorRule.hueCenter)),
      hueRange: clampNumber(sourceRule.hueRange, 0, 180, defaults.colorRule.hueRange),
      saturationCenter: clampNumber(
        sourceRule.saturationCenter,
        0,
        1,
        hasSourceRule ? sourceHsv.s : defaults.colorRule.saturationCenter,
      ),
      valueCenter: clampNumber(
        sourceRule.valueCenter,
        0,
        1,
        hasSourceRule ? sourceHsv.v : defaults.colorRule.valueCenter,
      ),
      minSaturation: clampNumber(sourceRule.minSaturation, 0, 1, defaults.colorRule.minSaturation),
      maxSaturation: clampNumber(
        sourceRule.maxSaturation,
        0,
        1,
        hasSourceRule ? 1 : defaults.colorRule.maxSaturation,
      ),
      minValue: clampNumber(sourceRule.minValue, 0, 1, defaults.colorRule.minValue),
      maxValue: clampNumber(sourceRule.maxValue, 0, 1, defaults.colorRule.maxValue),
    },
  };
}

function hexToHsv(hex) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  return {
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function cleanId(value, fallback) {
  const text = cleanText(value, fallback, 64).replace(/[^a-zA-Z0-9_-]/g, "-");
  return text || fallback;
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const text = value.trim().slice(0, maxLength);
  return text || fallback;
}

function normalizeHex(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function normalizeHue(value) {
  return ((Math.round(value) % 360) + 360) % 360;
}

function normalizeMappingMode(value) {
  if (value === MAPPING_MODES.SAME_COLOR_RANDOM) return MAPPING_MODES.SAME_COLOR_RANDOM;
  if (value === MAPPING_MODES.TEN_COLOR || value === MAPPING_MODES.SIX_COLOR) {
    return MAPPING_MODES.TEN_COLOR;
  }
  return MAPPING_MODES.TEN_COLOR;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dataUrlMime(dataUrl) {
  return dataUrl.match(/^data:([^;,]+)/)?.[1] || "audio/mpeg";
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
