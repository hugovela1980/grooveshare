import {
  createBrowserRecordedTakeDraftPort,
} from "../src/index.js";
import type { RecordedTakeDraft } from "@hugovela/frontend-core";
import { tester } from "./test-runner/tester.js";

type MutableRequest<T> = {
  result: T;
  error: DOMException | null;
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onupgradeneeded?: ((event: IDBVersionChangeEvent) => void) | null;
};

function makeRequest<T>(initial: T): MutableRequest<T> {
  return {
    result: initial,
    error: null,
    onsuccess: null,
    onerror: null,
  };
}

function createFakeIndexedDb(): IDBFactory {
  const values = new Map<string, unknown>();
  let storeCreated = false;

  const objectStore = {
    get(key: IDBValidKey) {
      const request = makeRequest(values.get(String(key)));
      queueMicrotask(() => request.onsuccess?.(new Event("success")));
      return request as unknown as IDBRequest;
    },
    put(value: { scopeId: string }) {
      values.set(value.scopeId, structuredClone(value));
      const request = makeRequest<IDBValidKey>(value.scopeId);
      queueMicrotask(() => request.onsuccess?.(new Event("success")));
      return request as unknown as IDBRequest;
    },
    delete(key: IDBValidKey) {
      values.delete(String(key));
      const request = makeRequest<undefined>(undefined);
      queueMicrotask(() => request.onsuccess?.(new Event("success")));
      return request as unknown as IDBRequest;
    },
  };

  const database = {
    objectStoreNames: {
      contains() {
        return storeCreated;
      },
    },
    createObjectStore() {
      storeCreated = true;
      return objectStore;
    },
    transaction() {
      const transaction = {
        error: null,
        onabort: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        oncomplete: null as ((event: Event) => void) | null,
        objectStore() {
          return objectStore;
        },
      };
      queueMicrotask(() => {
        // Object-store requests enqueue their success callback after the
        // transaction is created. Complete one microtask later so the fake
        // mirrors IndexedDB's request-success -> transaction-commit order.
        queueMicrotask(() => transaction.oncomplete?.(new Event("complete")));
      });
      return transaction;
    },
    close() {},
  };

  return {
    open() {
      const request = makeRequest(database);
      request.onupgradeneeded = null;
      queueMicrotask(() => {
        if (!storeCreated) {
          request.onupgradeneeded?.({} as IDBVersionChangeEvent);
        }
        request.onsuccess?.(new Event("success"));
      });
      return request as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;
}

function createDraft(): RecordedTakeDraft {
  return {
    capture: {
      bytes: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/webm",
    },
    timing: {
      transport: {
        startProjectPositionSeconds: 30,
        stopProjectPositionSeconds: 34,
        startAudioContextTimeSeconds: 100,
        stopAudioContextTimeSeconds: 104,
        durationSeconds: 4,
        timelineOffsetSeconds: 30,
      },
      musicalStart: { bar: 16, beat: 1 },
      musicalStop: { bar: 18, beat: 1 },
      musicalSpanBeats: 8,
      mediaLeadInSeconds: 2.43,
    },
    alignmentCompensationMilliseconds: 260,
  };
}

tester.describe("browser recorded take draft port", () => {
  tester.it("stores one recoverable take per user/project scope in IndexedDB", async () => {
    const port = createBrowserRecordedTakeDraftPort({
      indexedDb: createFakeIndexedDb(),
    });
    if (!port) throw new Error("Expected IndexedDB draft port.");

    await port.save("user-1:project-1", createDraft());
    const restored = await port.load("user-1:project-1");

    tester.expect(restored?.timing.musicalStart).toEqual({ bar: 16, beat: 1 });
    tester.expect(restored?.alignmentCompensationMilliseconds).toBe(260);
    tester.expect(Array.from(restored?.capture.bytes ?? [])).toEqual([1, 2, 3, 4]);

    if (restored) restored.capture.bytes[0] = 99;
    const restoredAgain = await port.load("user-1:project-1");
    tester.expect(Array.from(restoredAgain?.capture.bytes ?? [])).toEqual([1, 2, 3, 4]);

    await port.remove("user-1:project-1");
    tester.expect(await port.load("user-1:project-1")).toBe(null);
  });

  tester.it("reports unavailable when IndexedDB is unavailable", () => {
    tester.expect(createBrowserRecordedTakeDraftPort({ indexedDb: null })).toBe(null);
  });
});
