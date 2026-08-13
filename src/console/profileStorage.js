import { createDefaultProfile, normalizeProfile } from "./profile.js";

export const PROFILE_STORAGE_KEY = "object-drum-show-console-profile-v3";

export function loadStoredProfile(storage) {
  try {
    const value = storage?.getItem?.(PROFILE_STORAGE_KEY);
    return value ? normalizeProfile(JSON.parse(value)) : createDefaultProfile();
  } catch {
    return createDefaultProfile();
  }
}

export function saveStoredProfile(storage, profileValue) {
  storage?.setItem?.(PROFILE_STORAGE_KEY, JSON.stringify(normalizeProfile(profileValue)));
}
