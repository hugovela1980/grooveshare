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

export function getBrowserStorageProvider(): StorageProvider | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  return createBrowserStorageProvider(globalThis.localStorage);
}
