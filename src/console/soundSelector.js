import { MAPPING_MODES, normalizeProfile } from "./profile.js";

export function selectSoundSlot({ profile: profileValue, pad, random = Math.random } = {}) {
  const profile = normalizeProfile(profileValue);
  const enabledSlots = profile.slots.filter((slot) => slot.enabled);
  if (enabledSlots.length === 0) return null;

  if (profile.mappingMode === MAPPING_MODES.SAME_COLOR_RANDOM) {
    const sample = clampRandom(random());
    return enabledSlots[Math.min(enabledSlots.length - 1, Math.floor(sample * enabledSlots.length))];
  }

  const ruleId = pad?.ruleId;
  const instrument = pad?.instrument;
  return enabledSlots.find((slot) => (
    slot.colorRule.id === ruleId || slot.id === instrument
  )) || null;
}

function clampRandom(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(0.999999999, number));
}
