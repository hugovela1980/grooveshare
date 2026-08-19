import {
  clearPendingMixSettings,
  getPendingMixStorageKey,
  getViewerMixStorageKey,
  loadPendingMixSettings,
  loadViewerMixSettings,
  savePendingMixSettings,
  saveViewerMixSettings,
  type MixSettings,
  type StorageProvider,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

function createStorage() {
  const values = new Map<string, string>();
  const storage: StorageProvider = {
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

  return { values, storage };
}

const mixSettings: MixSettings = {
  channels: [
    {
      channelNumber: 1,
      trackId: "track-1",
      enabled: true,
      volume: 0.64,
    },
  ],
};

tester.describe("frontend-core mix storage", () => {
  tester.it("stores Viewer mix settings under a project-scoped key", () => {
    const { storage } = createStorage();

    tester.expect(getViewerMixStorageKey("project-1")).toBe(
      "grooveshare:viewer-mix:project-1",
    );

    saveViewerMixSettings("project-1", mixSettings, storage);
    tester.expect(loadViewerMixSettings("project-1", storage)).toEqual(
      mixSettings,
    );
  });

  tester.it("stores pending server mix settings under user and project", () => {
    const { storage, values } = createStorage();
    const key = getPendingMixStorageKey("user-1", "project-1");

    tester.expect(key).toBe("grooveshare:pending-mix:user-1:project-1");

    savePendingMixSettings("user-1", "project-1", mixSettings, storage);
    tester.expect(
      loadPendingMixSettings("user-1", "project-1", storage),
    ).toEqual(mixSettings);

    clearPendingMixSettings("user-1", "project-1", storage);
    tester.expect(values.has(key)).toBe(false);
  });

  tester.it("ignores malformed Viewer and pending storage values", () => {
    const { storage, values } = createStorage();
    values.set("grooveshare:viewer-mix:project-1", "not json");
    values.set("grooveshare:pending-mix:user-1:project-1", "not json");

    tester.expect(loadViewerMixSettings("project-1", storage)).toBe(null);
    tester.expect(
      loadPendingMixSettings("user-1", "project-1", storage),
    ).toBe(null);
  });
});
