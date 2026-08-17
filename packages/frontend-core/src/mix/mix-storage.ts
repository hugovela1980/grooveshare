import type { MixSettings } from "../domain/types.js";
import type { StorageProvider } from "../platform/storage-provider.js";

const VIEWER_MIX_STORAGE_PREFIX = "grooveshare:viewer-mix:";
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

function loadMixSettings(
  key: string,
  storage: StorageProvider | null,
): MixSettings | null {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(key);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    return isMixSettings(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function saveMixSettings(
  key: string,
  mixSettings: MixSettings,
  storage: StorageProvider | null,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(mixSettings));
  } catch {
    // Local persistence is a recovery/convenience layer. The application must
    // remain usable when storage is unavailable, full, or otherwise blocked.
  }
}

function clearMixSettings(
  key: string,
  storage: StorageProvider | null,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // A stale recovery entry can be retried after a later successful save.
  }
}

export function getViewerMixStorageKey(projectId: string): string {
  return `${VIEWER_MIX_STORAGE_PREFIX}${projectId}`;
}

export function loadViewerMixSettings(
  projectId: string,
  storage: StorageProvider | null,
): MixSettings | null {
  return loadMixSettings(getViewerMixStorageKey(projectId), storage);
}

export function saveViewerMixSettings(
  projectId: string,
  mixSettings: MixSettings,
  storage: StorageProvider | null,
): void {
  saveMixSettings(getViewerMixStorageKey(projectId), mixSettings, storage);
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
  return loadMixSettings(
    getPendingMixStorageKey(userId, projectId),
    storage,
  );
}

export function savePendingMixSettings(
  userId: string,
  projectId: string,
  mixSettings: MixSettings,
  storage: StorageProvider | null,
): void {
  saveMixSettings(
    getPendingMixStorageKey(userId, projectId),
    mixSettings,
    storage,
  );
}

export function clearPendingMixSettings(
  userId: string,
  projectId: string,
  storage: StorageProvider | null,
): void {
  clearMixSettings(
    getPendingMixStorageKey(userId, projectId),
    storage,
  );
}
