import type { StorageProvider } from "../platform/storage-provider.js";

const VIEWER_MIX_STORAGE_PREFIX = "grooveshare:viewer-mix:";
const GUEST_MIX_STORAGE_PREFIX = "grooveshare:guest-mix:";

export function getGuestMixStorageKey(projectId: string): string {
  return `${GUEST_MIX_STORAGE_PREFIX}${projectId}`;
}

/**
 * Guest access is intentionally not Viewer membership, but it uses the same
 * read-only mix coordinator behavior. This adapter remaps only the Viewer's
 * project-local storage key to a distinct Guest key.
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
