import {
  createGuestMixStorageProvider,
  getGuestMixStorageKey,
  isInvitationSessionState,
  type StorageProvider,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

function createMemoryStorage(): StorageProvider {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

tester.describe("frontend-core Guest persistence contracts", () => {
  tester.it("maps Viewer coordinator storage to a distinct Guest project key", () => {
    const storage = createMemoryStorage();
    const guestStorage = createGuestMixStorageProvider("project-1", storage);

    if (!guestStorage) {
      throw new Error("Expected Guest storage provider.");
    }

    guestStorage.setItem("grooveshare:viewer-mix:project-1", "mix");

    tester.expect(storage.getItem("grooveshare:viewer-mix:project-1")).toBe(null);
    tester.expect(storage.getItem(getGuestMixStorageKey("project-1"))).toBe("mix");
  });

  tester.it("validates shared invitation session state without browser storage", () => {
    tester.expect(
      isInvitationSessionState({
        projectId: "project-1",
        token: "token",
        pendingContributor: false,
      }),
    ).toBe(true);
    tester.expect(isInvitationSessionState({ projectId: "project-1" })).toBe(false);
  });
});
