import {
  createMixPersistenceCoordinator,
  getPendingMixStorageKey,
  getViewerMixStorageKey,
  type MixSettings,
  type StorageProvider,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

function createStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

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

  return { storage, values };
}

function createScheduler() {
  let nextId = 1;
  const handlers = new Map<number, () => void>();

  return {
    schedule(handler: () => void) {
      const id = nextId++;
      handlers.set(id, handler);
      return id;
    },
    clear(id: number) {
      handlers.delete(id);
    },
    runLatest() {
      const latestId = Math.max(...handlers.keys());
      const handler = handlers.get(latestId);
      handlers.delete(latestId);
      handler?.();
    },
    get size() {
      return handlers.size;
    },
  };
}

function mix(volume: number): MixSettings {
  return {
    channels: [
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume,
      },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

tester.describe("MixPersistenceCoordinator", () => {
  tester.it("keeps Viewer mix persistence local", () => {
    const { storage, values } = createStorage();
    const scheduler = createScheduler();
    const coordinator = createMixPersistenceCoordinator({
      projectId: "project-1",
      projectRole: "viewer",
      currentUserId: "viewer-1",
      storageProvider: storage,
      persistenceDelayMs: 2000,
      scheduleTimeout: (handler) => scheduler.schedule(handler),
      clearScheduledTimeout: (id) => scheduler.clear(id),
    });

    coordinator.persist(mix(0.55));

    tester.expect(
      JSON.parse(values.get(getViewerMixStorageKey("project-1")) ?? "null"),
    ).toEqual(mix(0.55));
    tester.expect(scheduler.size).toBe(0);
  });

  tester.it("restores a pending server mix and exposes it as current state", () => {
    const pending = mix(0.42);
    const key = getPendingMixStorageKey("owner-1", "project-1");
    const { storage } = createStorage({ [key]: JSON.stringify(pending) });
    const scheduler = createScheduler();
    const coordinator = createMixPersistenceCoordinator({
      projectId: "project-1",
      projectRole: "owner",
      currentUserId: "owner-1",
      initialMixSettings: mix(1),
      storageProvider: storage,
      saveServerMixSettings: async (settings) => settings,
      persistenceDelayMs: 2000,
      scheduleTimeout: (handler) => scheduler.schedule(handler),
      clearScheduledTimeout: (id) => scheduler.clear(id),
    });

    tester.expect(coordinator.hasRecoveredPendingMix()).toBe(true);
    tester.expect(coordinator.getCurrentMixSettings()).toEqual(pending);
  });

  tester.it("debounces repeated committed changes into one scheduled save", async () => {
    const { storage } = createStorage();
    const scheduler = createScheduler();
    const saved: MixSettings[] = [];
    const coordinator = createMixPersistenceCoordinator({
      projectId: "project-1",
      projectRole: "owner",
      currentUserId: "owner-1",
      storageProvider: storage,
      saveServerMixSettings: async (settings) => {
        saved.push(settings);
        return settings;
      },
      persistenceDelayMs: 2000,
      scheduleTimeout: (handler) => scheduler.schedule(handler),
      clearScheduledTimeout: (id) => scheduler.clear(id),
    });

    coordinator.persist(mix(0.8));
    coordinator.persist(mix(0.7));
    coordinator.persist(mix(0.6));

    tester.expect(scheduler.size).toBe(1);
    tester.expect(saved.length).toBe(0);

    scheduler.runLatest();
    await flushMicrotasks();

    tester.expect(saved).toEqual([mix(0.6)]);
  });

  tester.it("clears the recovery copy only after a successful server save", async () => {
    const { storage, values } = createStorage();
    const scheduler = createScheduler();
    const coordinator = createMixPersistenceCoordinator({
      projectId: "project-1",
      projectRole: "owner",
      currentUserId: "owner-1",
      storageProvider: storage,
      saveServerMixSettings: async (settings) => settings,
      persistenceDelayMs: 2000,
      scheduleTimeout: (handler) => scheduler.schedule(handler),
      clearScheduledTimeout: (id) => scheduler.clear(id),
    });

    coordinator.persist(mix(0.66));
    const key = getPendingMixStorageKey("owner-1", "project-1");
    tester.expect(values.has(key)).toBe(true);

    const didSave = await coordinator.flush();

    tester.expect(didSave).toBe(true);
    tester.expect(values.has(key)).toBe(false);
  });

  tester.it("keeps the recovery copy when server persistence fails", async () => {
    const { storage, values } = createStorage();
    const scheduler = createScheduler();
    let errorCount = 0;
    const coordinator = createMixPersistenceCoordinator({
      projectId: "project-1",
      projectRole: "owner",
      currentUserId: "owner-1",
      storageProvider: storage,
      saveServerMixSettings: async () => {
        throw new Error("offline");
      },
      persistenceDelayMs: 2000,
      scheduleTimeout: (handler) => scheduler.schedule(handler),
      clearScheduledTimeout: (id) => scheduler.clear(id),
      onPersistenceError: () => {
        errorCount += 1;
      },
    });

    coordinator.persist(mix(0.4));
    const didSave = await coordinator.flush();

    tester.expect(didSave).toBe(false);
    tester.expect(errorCount).toBe(1);
    tester.expect(
      values.has(getPendingMixStorageKey("owner-1", "project-1")),
    ).toBe(true);
  });

  tester.it("flush cancels the debounce and waits for the server save", async () => {
    const { storage } = createStorage();
    const scheduler = createScheduler();
    const save = deferred<MixSettings>();
    let saveCallCount = 0;
    const coordinator = createMixPersistenceCoordinator({
      projectId: "project-1",
      projectRole: "owner",
      currentUserId: "owner-1",
      storageProvider: storage,
      saveServerMixSettings: async (settings) => {
        saveCallCount += 1;
        await save.promise;
        return settings;
      },
      persistenceDelayMs: 2000,
      scheduleTimeout: (handler) => scheduler.schedule(handler),
      clearScheduledTimeout: (id) => scheduler.clear(id),
    });

    coordinator.persist(mix(0.5));
    tester.expect(scheduler.size).toBe(1);

    let flushFinished = false;
    const pendingFlush = coordinator.flush().then(() => {
      flushFinished = true;
    });
    await flushMicrotasks();

    tester.expect(scheduler.size).toBe(0);
    tester.expect(saveCallCount).toBe(1);
    tester.expect(flushFinished).toBe(false);

    save.resolve(mix(0.5));
    await pendingFlush;
    tester.expect(flushFinished).toBe(true);
  });

  tester.it("does not let an older overlapping save clear a newer recovery revision", async () => {
    const { storage, values } = createStorage();
    const scheduler = createScheduler();
    const firstSave = deferred<MixSettings>();
    const saved: MixSettings[] = [];
    let callCount = 0;

    const coordinator = createMixPersistenceCoordinator({
      projectId: "project-1",
      projectRole: "owner",
      currentUserId: "owner-1",
      storageProvider: storage,
      saveServerMixSettings: async (settings) => {
        callCount += 1;
        saved.push(settings);
        if (callCount === 1) {
          await firstSave.promise;
        }
        return settings;
      },
      persistenceDelayMs: 2000,
      scheduleTimeout: (handler) => scheduler.schedule(handler),
      clearScheduledTimeout: (id) => scheduler.clear(id),
    });

    coordinator.persist(mix(0.8));
    const firstFlush = coordinator.flush();
    await flushMicrotasks();

    coordinator.persist(mix(0.3));
    const key = getPendingMixStorageKey("owner-1", "project-1");
    tester.expect(JSON.parse(values.get(key) ?? "null")).toEqual(mix(0.3));

    firstSave.resolve(mix(0.8));
    await firstFlush;
    await flushMicrotasks();

    tester.expect(JSON.parse(values.get(key) ?? "null")).toEqual(mix(0.3));

    await coordinator.flush();
    tester.expect(saved).toEqual([mix(0.8), mix(0.3)]);
    tester.expect(values.has(key)).toBe(false);
  });
});
