import type { MusicalPosition } from "../domain/types.js";
import type { StorageProvider } from "../platform/storage-provider.js";

const RECORDING_WORKSPACE_ANCHOR_STORAGE_PREFIX =
  "grooveshare.recording-workspace-anchor.v1";

export type RecordingWorkspaceState = {
  getAnchor(): MusicalPosition | null;
  setAnchor(position: MusicalPosition): MusicalPosition;
  clearAnchor(): void;
};

export function getRecordingWorkspaceAnchorStorageKey(
  projectId: string,
  userId?: string | null,
): string {
  const scopeId = userId ? `${userId}:${projectId}` : projectId;
  return `${RECORDING_WORKSPACE_ANCHOR_STORAGE_PREFIX}:${scopeId}`;
}

function clonePosition(position: MusicalPosition | null): MusicalPosition | null {
  return position ? { ...position } : null;
}

function isValidAnchor(value: unknown): value is MusicalPosition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<MusicalPosition>;
  return (
    Number.isInteger(candidate.bar) &&
    (candidate.bar ?? 0) >= 1 &&
    typeof candidate.beat === "number" &&
    Number.isFinite(candidate.beat) &&
    candidate.beat >= 1
  );
}

/**
 * Shared owner for the user's sticky project working position.
 *
 * A Go action changes this anchor. Recording/review/save/mix reloads do not.
 * Only another Go action or an explicit Project Player Stop clears/changes it.
 * The optional StorageProvider makes the same rule survive browser reloads
 * without making frontend-core depend on localStorage.
 */
export function createRecordingWorkspaceState({
  projectId,
  storageProvider,
  userId,
}: {
  projectId: string;
  storageProvider?: StorageProvider | null;
  /** Authenticated browser sessions isolate workspace state by user + project. */
  userId?: string | null;
}): RecordingWorkspaceState {
  const storageKey = getRecordingWorkspaceAnchorStorageKey(projectId, userId);
  let anchor: MusicalPosition | null = null;

  if (storageProvider) {
    try {
      const raw = storageProvider.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (isValidAnchor(parsed)) {
          anchor = { ...parsed };
        } else {
          storageProvider.removeItem(storageKey);
        }
      }
    } catch {
      try {
        storageProvider.removeItem(storageKey);
      } catch {
        // Persistence is best effort; in-memory workflow state still works.
      }
    }
  }

  return {
    getAnchor() {
      return clonePosition(anchor);
    },
    setAnchor(position) {
      if (!isValidAnchor(position)) {
        throw new Error("Recording workspace anchor must be a valid musical position.");
      }

      anchor = { ...position };
      try {
        storageProvider?.setItem(storageKey, JSON.stringify(anchor));
      } catch {
        // Persistence failure must not break transport navigation.
      }
      return { ...anchor };
    },
    clearAnchor() {
      anchor = null;
      try {
        storageProvider?.removeItem(storageKey);
      } catch {
        // Persistence failure must not break transport Stop.
      }
    },
  };
}
