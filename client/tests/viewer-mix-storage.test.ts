import {
  getViewerMixStorageKey,
  loadViewerMixSettings,
  saveViewerMixSettings,
} from "../src/storage/viewer-mix-storage.js";
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
    },
  };
}

tester.describe("Viewer mix storage", () => {
  tester.it("scopes Viewer mix settings to the project", () => {
    tester.expect(getViewerMixStorageKey("project-1")).toBe(
      "grooveshare:viewer-mix:project-1",
    );
  });

  tester.it("saves and restores Viewer mix settings", () => {
    const { storage } = createStorage();
    const mixSettings = {
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: false,
          volume: 0.42,
        },
      ],
    };

    saveViewerMixSettings("project-1", mixSettings, storage);

    tester.expect(
      loadViewerMixSettings("project-1", storage),
    ).toEqual(mixSettings);
  });

  tester.it("ignores malformed stored values", () => {
    const { storage, values } = createStorage();
    values.set("grooveshare:viewer-mix:project-1", "not json");

    tester.expect(
      loadViewerMixSettings("project-1", storage),
    ).toBe(null);
  });
});
