import type { StorageProvider } from "@hugovela/frontend-core";

type BrowserStorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function createBrowserStorageProvider(
  storage: BrowserStorageLike,
): StorageProvider {
  return {
    getItem(key) {
      return storage.getItem(key);
    },
    setItem(key, value) {
      storage.setItem(key, value);
    },
    removeItem(key) {
      storage.removeItem(key);
    },
  };
}

/**
 * Returns the browser localStorage adapter when storage is available.
 *
 * Returning null preserves the existing graceful behavior in environments
 * where browser storage is unavailable. Checkpoint 2 will inject this provider
 * into shared persistence behavior instead of letting that behavior reach for
 * globalThis.localStorage itself.
 */
export function getBrowserStorageProvider(): StorageProvider | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  return createBrowserStorageProvider(globalThis.localStorage);
}
