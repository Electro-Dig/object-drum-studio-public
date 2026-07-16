export const CONSOLE_SCHEMA_VERSION = 1;

export const MAPPING_MODES = Object.freeze({
  SIX_COLOR: "six-color",
  SAME_COLOR_RANDOM: "same-color-random",
});

const SLOT_COUNT = 6;
const FALLBACK_VOICES = new Set(["kick", "snare", "hat", "tom", "clap", "bell"]);
const SLOT_DEFAULTS = [
  { label: "红色", color: "#ef5b46", hue: 6, voice: "kick" },
  { label: "黄色", color: "#f4bc43", hue: 44, voice: "snare" },
  { label: "绿色", color: "#58bd68", hue: 126, voice: "hat" },
  { label: "青色", color: "#3dc6c4", hue: 182, voice: "tom" },
  { label: "蓝色", color: "#4f7de8", hue: 224, voice: "clap" },
  { label: "紫色", color: "#a968d4", hue: 284, voice: "bell" },
];

export function createDefaultProfile() {
  return {
    schemaVersion: CONSOLE_SCHEMA_VERSION,
    id: "default-show",
    name: "现场演出配置",
    mappingMode: MAPPING_MODES.SIX_COLOR,
    masterGain: 0.82,
    recognition: {
      minArea: 72,
      confirmFrames: 2,
      missingTtlMs: 460,
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
    mappingMode: Object.values(MAPPING_MODES).includes(source.mappingMode)
      ? source.mappingMode
      : defaults.mappingMode,
    masterGain: clampNumber(source.masterGain, 0, 1, defaults.masterGain),
    recognition: {
      minArea: Math.round(clampNumber(source.recognition?.minArea, 12, 4000, defaults.recognition.minArea)),
      confirmFrames: Math.round(clampNumber(source.recognition?.confirmFrames, 1, 6, defaults.recognition.confirmFrames)),
      missingTtlMs: Math.round(clampNumber(source.recognition?.missingTtlMs, 120, 3000, defaults.recognition.missingTtlMs)),
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
  if (value.schemaVersion !== CONSOLE_SCHEMA_VERSION) {
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
      hueRange: 20,
      minSaturation: 0.35,
      minValue: 0.18,
      maxValue: 1,
    },
  };
}

function normalizeSlot(value, defaults, index) {
  const source = isRecord(value) ? value : {};
  const id = cleanId(source.id, defaults.id || `slot-${index + 1}`);
  const label = cleanText(source.label, defaults.label, 48);
  const sourceRule = isRecord(source.colorRule) ? source.colorRule : {};
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
    colorHex: normalizeHex(source.colorHex, defaults.colorHex),
    colorRule: {
      id: cleanId(sourceRule.id, `${id}-color`),
      instrument: id,
      label,
      enabled: source.enabled !== false,
      hueCenter: normalizeHue(numberOr(sourceRule.hueCenter, defaults.colorRule.hueCenter)),
      hueRange: clampNumber(sourceRule.hueRange, 0, 180, defaults.colorRule.hueRange),
      minSaturation: clampNumber(sourceRule.minSaturation, 0, 1, defaults.colorRule.minSaturation),
      minValue: clampNumber(sourceRule.minValue, 0, 1, defaults.colorRule.minValue),
      maxValue: clampNumber(sourceRule.maxValue, 0, 1, defaults.colorRule.maxValue),
    },
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
