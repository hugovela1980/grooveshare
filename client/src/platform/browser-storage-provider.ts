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
 * where browser storage is unavailable. The app composition root injects this
 * provider so persistence behavior never reaches for globalThis.localStorage
 * directly.
 */
export function getBrowserStorageProvider(): StorageProvider | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  return createBrowserStorageProvider(globalThis.localStorage);
}
