import type { StorageProvider } from "@hugovela/frontend-core";

const VIEWER_MIX_STORAGE_PREFIX = "grooveshare:viewer-mix:";
const GUEST_MIX_STORAGE_PREFIX = "grooveshare:guest-mix:";

export function getGuestMixStorageKey(projectId: string): string {
  return `${GUEST_MIX_STORAGE_PREFIX}${projectId}`;
}

/**
 * The shared mix coordinator already has the correct read-only/local behavior
 * for a Viewer. Guest access is intentionally not a Viewer membership, though,
 * so this adapter gives the same coordinator a distinct browser-local key.
 */
export function createGuestMixStorageProvider(
  projectId: string,
  storage: StorageProvider | null,
): StorageProvider | null {
  if (!storage) {
    return null;
  }

  const viewerKey = `${VIEWER_MIX_STORAGE_PREFIX}${projectId}`;
  const guestKey = getGuestMixStorageKey(projectId);

  function mapKey(key: string): string {
    return key === viewerKey ? guestKey : key;
  }

  return {
    getItem(key) {
      return storage.getItem(mapKey(key));
    },
    setItem(key, value) {
      storage.setItem(mapKey(key), value);
    },
    removeItem(key) {
      storage.removeItem(mapKey(key));
    },
  };
}
