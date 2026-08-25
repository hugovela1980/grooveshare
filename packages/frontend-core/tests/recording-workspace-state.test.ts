import {
  createRecordingWorkspaceState,
  getRecordingWorkspaceAnchorStorageKey,
  type StorageProvider,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

function createMemoryStorage(): StorageProvider & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
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

tester.describe("recording workspace state", () => {
  tester.it("keeps a Go anchor per project and restores it after reload", () => {
    const storage = createMemoryStorage();
    const first = createRecordingWorkspaceState({
      projectId: "project-a",
      storageProvider: storage,
    });

    first.setAnchor({ bar: 16, beat: 1 });

    tester.expect(first.getAnchor()).toEqual({ bar: 16, beat: 1 });
    tester.expect(
      storage.values.get(getRecordingWorkspaceAnchorStorageKey("project-a")),
    ).toBe('{"bar":16,"beat":1}');

    const restored = createRecordingWorkspaceState({
      projectId: "project-a",
      storageProvider: storage,
    });
    tester.expect(restored.getAnchor()).toEqual({ bar: 16, beat: 1 });
  });


  tester.it("isolates authenticated workspace anchors between users on the same project", () => {
    const storage = createMemoryStorage();
    const firstUser = createRecordingWorkspaceState({
      projectId: "project-a",
      userId: "user-1",
      storageProvider: storage,
    });
    const secondUser = createRecordingWorkspaceState({
      projectId: "project-a",
      userId: "user-2",
      storageProvider: storage,
    });

    firstUser.setAnchor({ bar: 12, beat: 1 });

    tester.expect(firstUser.getAnchor()).toEqual({ bar: 12, beat: 1 });
    tester.expect(secondUser.getAnchor()).toBe(null);
    tester.expect(
      storage.getItem(getRecordingWorkspaceAnchorStorageKey("project-a", "user-1")),
    ).toBe('{"bar":12,"beat":1}');
    tester.expect(
      storage.getItem(getRecordingWorkspaceAnchorStorageKey("project-a", "user-2")),
    ).toBe(null);
  });

  tester.it("clears the sticky anchor only when explicitly reset", () => {
    const storage = createMemoryStorage();
    const state = createRecordingWorkspaceState({
      projectId: "project-a",
      storageProvider: storage,
    });

    state.setAnchor({ bar: 8, beat: 2.5 });
    tester.expect(state.getAnchor()).toEqual({ bar: 8, beat: 2.5 });

    state.clearAnchor();
    tester.expect(state.getAnchor()).toBe(null);
    tester.expect(
      storage.getItem(getRecordingWorkspaceAnchorStorageKey("project-a")),
    ).toBe(null);
  });

  tester.it("isolates anchors between projects and discards corrupt storage", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      getRecordingWorkspaceAnchorStorageKey("project-a"),
      "not-json",
    );
    storage.setItem(
      getRecordingWorkspaceAnchorStorageKey("project-b"),
      JSON.stringify({ bar: 4, beat: 1 }),
    );

    const a = createRecordingWorkspaceState({
      projectId: "project-a",
      storageProvider: storage,
    });
    const b = createRecordingWorkspaceState({
      projectId: "project-b",
      storageProvider: storage,
    });

    tester.expect(a.getAnchor()).toBe(null);
    tester.expect(b.getAnchor()).toEqual({ bar: 4, beat: 1 });
  });
});
