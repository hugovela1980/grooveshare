import type { StorageProvider } from "@hugovela/frontend-core";
import type { MixSettings } from "../types.js";

const PENDING_MIX_STORAGE_PREFIX = "grooveshare:pending-mix:";

function isMixSettings(value: unknown): value is MixSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (!Array.isArray(candidate.channels)) {
    return false;
  }

  return candidate.channels.every((channel) => {
    if (!channel || typeof channel !== "object") {
      return false;
    }

    const setting = channel as Record<string, unknown>;

    return (
      typeof setting.channelNumber === "number" &&
      typeof setting.trackId === "string" &&
      typeof setting.enabled === "boolean" &&
      typeof setting.volume === "number"
    );
  });
}

export function getPendingMixStorageKey(
  userId: string,
  projectId: string,
): string {
  return `${PENDING_MIX_STORAGE_PREFIX}${userId}:${projectId}`;
}

export function loadPendingMixSettings(
  userId: string,
  projectId: string,
  storage: StorageProvider | null,
): MixSettings | null {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(
      getPendingMixStorageKey(userId, projectId),
    );

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    return isMixSettings(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function savePendingMixSettings(
  userId: string,
  projectId: string,
  mixSettings: MixSettings,
  storage: StorageProvider | null,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      getPendingMixStorageKey(userId, projectId),
      JSON.stringify(mixSettings),
    );
  } catch {
    // This cache protects against interrupted server persistence. If client
    // storage is unavailable, the normal debounced server save still works.
  }
}

export function clearPendingMixSettings(
  userId: string,
  projectId: string,
  storage: StorageProvider | null,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(
      getPendingMixStorageKey(userId, projectId),
    );
  } catch {
    // A stale recovery entry is harmless: a later successful save can retry
    // clearing it, and resubmitting the same mix settings is idempotent.
  }
}
