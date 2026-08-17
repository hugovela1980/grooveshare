import type { StorageProvider } from "@hugovela/frontend-core";
import type { MixSettings } from "../types.js";

const VIEWER_MIX_STORAGE_PREFIX = "grooveshare:viewer-mix:";

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

export function getViewerMixStorageKey(projectId: string): string {
  return `${VIEWER_MIX_STORAGE_PREFIX}${projectId}`;
}

export function loadViewerMixSettings(
  projectId: string,
  storage: StorageProvider | null,
): MixSettings | null {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(getViewerMixStorageKey(projectId));

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    return isMixSettings(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function saveViewerMixSettings(
  projectId: string,
  mixSettings: MixSettings,
  storage: StorageProvider | null,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      getViewerMixStorageKey(projectId),
      JSON.stringify(mixSettings),
    );
  } catch {
    // Client storage can be unavailable or full. Local persistence is a
    // convenience for Viewers, so playback should continue if storage fails.
  }
}
