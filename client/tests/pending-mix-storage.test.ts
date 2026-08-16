import {
  clearPendingMixSettings,
  getPendingMixStorageKey,
  loadPendingMixSettings,
  savePendingMixSettings,
} from "../src/storage/pending-mix-storage.js";
import { tester } from "./test-runner/tester.js";

function createStorage() {
  const values = new Map<string, string>();

  return {
    values,
    storage: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
    },
  };
}

tester.describe("Pending mix storage", () => {
  tester.it("scopes pending mix settings to both the user and project", () => {
    tester.expect(
      getPendingMixStorageKey("user-1", "project-1"),
    ).toBe("grooveshare:pending-mix:user-1:project-1");
  });

  tester.it("saves, restores, and clears a pending server mix", () => {
    const { storage, values } = createStorage();
    const mixSettings = {
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: true,
          volume: 0.64,
        },
      ],
    };

    savePendingMixSettings("user-1", "project-1", mixSettings, storage);

    tester.expect(
      loadPendingMixSettings("user-1", "project-1", storage),
    ).toEqual(mixSettings);

    clearPendingMixSettings("user-1", "project-1", storage);

    tester.expect(
      values.has("grooveshare:pending-mix:user-1:project-1"),
    ).toBe(false);
  });

  tester.it("ignores malformed pending values", () => {
    const { storage, values } = createStorage();
    values.set(
      "grooveshare:pending-mix:user-1:project-1",
      "not json",
    );

    tester.expect(
      loadPendingMixSettings("user-1", "project-1", storage),
    ).toBe(null);
  });
});
