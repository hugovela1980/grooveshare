import type {
  RecordedTakeDraft,
  RecordedTakeDraftPort,
} from "@hugovela/frontend-core";

const DATABASE_NAME = "grooveshare-recording-drafts";
const DATABASE_VERSION = 1;
const STORE_NAME = "pending-takes";
const RECORD_VERSION = 1;

type StoredRecordedTakeDraft = RecordedTakeDraft & {
  scopeId: string;
  recordVersion: number;
};

export type BrowserRecordedTakeDraftPortOptions = {
  indexedDb?: IDBFactory | null;
};

function getDefaultIndexedDb(): IDBFactory | null {
  return typeof globalThis.indexedDB === "undefined"
    ? null
    : globalThis.indexedDB;
}

function cloneDraft(draft: RecordedTakeDraft): RecordedTakeDraft {
  return {
    capture: {
      bytes: new Uint8Array(draft.capture.bytes),
      mimeType: draft.capture.mimeType,
    },
    timing: {
      transport: { ...draft.timing.transport },
      musicalStart: { ...draft.timing.musicalStart },
      musicalStop: { ...draft.timing.musicalStop },
      musicalSpanBeats: draft.timing.musicalSpanBeats,
      mediaLeadInSeconds: draft.timing.mediaLeadInSeconds,
    },
    alignmentCompensationMilliseconds:
      draft.alignmentCompensationMilliseconds,
  };
}

function openDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "scopeId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(
      request.error ?? new Error("Could not open local recording draft storage."),
    );
  });
}

async function withObjectStore<T>(
  indexedDb: IDBFactory,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase(indexedDb);

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));

      request.onerror = () => reject(
        request.error ?? new Error("Local recording draft operation failed."),
      );
      transaction.onabort = () => reject(
        transaction.error ?? new Error("Local recording draft transaction was aborted."),
      );
      transaction.onerror = () => reject(
        transaction.error ?? new Error("Local recording draft transaction failed."),
      );
      // A write request can report success before IndexedDB has committed its
      // transaction. Waiting for oncomplete makes Stop/Keep/Discard durability
      // semantics match the promise exposed through the browser port.
      transaction.oncomplete = () => resolve(request.result);
    });
  } finally {
    database.close();
  }
}

/**
 * IndexedDB implementation for a pending microphone take. Uint8Array data is
 * stored through IndexedDB structured cloning, avoiding localStorage size limits
 * and keeping Blob/IndexedDB mechanics outside frontend-core.
 */
export function createBrowserRecordedTakeDraftPort({
  indexedDb = getDefaultIndexedDb(),
}: BrowserRecordedTakeDraftPortOptions = {}): RecordedTakeDraftPort | null {
  if (!indexedDb) {
    return null;
  }

  return {
    async load(scopeId) {
      const stored = await withObjectStore<StoredRecordedTakeDraft | undefined>(
        indexedDb,
        "readonly",
        (store) => store.get(scopeId),
      );

      if (!stored || stored.recordVersion !== RECORD_VERSION) {
        return null;
      }

      return cloneDraft(stored);
    },

    async save(scopeId, draft) {
      const stored: StoredRecordedTakeDraft = {
        scopeId,
        recordVersion: RECORD_VERSION,
        ...cloneDraft(draft),
      };
      await withObjectStore<IDBValidKey>(
        indexedDb,
        "readwrite",
        (store) => store.put(stored),
      );
    },

    async remove(scopeId) {
      await withObjectStore<undefined>(
        indexedDb,
        "readwrite",
        (store) => store.delete(scopeId) as IDBRequest<undefined>,
      );
    },
  };
}
