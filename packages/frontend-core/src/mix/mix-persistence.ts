import type {
  MixSettings,
  ProjectRole,
} from "../domain/types.js";
import { canPersistMix } from "../permissions/project-permissions.js";
import type { StorageProvider } from "../platform/storage-provider.js";
import {
  clearPendingMixSettings,
  loadPendingMixSettings,
  loadViewerMixSettings,
  savePendingMixSettings,
  saveViewerMixSettings,
} from "./mix-storage.js";

export type SaveServerMixSettings = (
  mixSettings: MixSettings,
) => Promise<MixSettings | undefined>;

export type MixPersistenceCoordinator = {
  getCurrentMixSettings(): MixSettings | undefined;
  persist(mixSettings: MixSettings): void;
  flush(): Promise<boolean>;
  schedulePendingPersistence(): void;
  hasRecoveredPendingMix(): boolean;
  clearRecovery(): void;
};

type MixPersistenceCoordinatorOptions<TTimeoutHandle> = {
  projectId: string;
  projectRole: ProjectRole;
  currentUserId: string | null;
  initialMixSettings?: MixSettings;
  storageProvider: StorageProvider | null;
  saveServerMixSettings?: SaveServerMixSettings;
  persistenceDelayMs: number;
  scheduleTimeout: (
    handler: () => void,
    delayMs: number,
  ) => TTimeoutHandle;
  clearScheduledTimeout: (timeoutId: TTimeoutHandle) => void;
  onPersistenceError?: () => void;
  onPersistedMixSettings?: (mixSettings: MixSettings) => void;
};

/**
 * Owns presentation-independent mix persistence behavior:
 * - Viewer-local mix storage.
 * - Owner/Contributor recovery copies.
 * - debounced server saves.
 * - overlap/revision protection.
 * - flush-before-controlled-navigation semantics.
 *
 * The presentation client decides when a user has committed a mixer change;
 * this coordinator decides how that change is persisted safely.
 */
export function createMixPersistenceCoordinator<TTimeoutHandle>({
  projectId,
  projectRole,
  currentUserId,
  initialMixSettings,
  storageProvider,
  saveServerMixSettings,
  persistenceDelayMs,
  scheduleTimeout,
  clearScheduledTimeout,
  onPersistenceError,
  onPersistedMixSettings,
}: MixPersistenceCoordinatorOptions<TTimeoutHandle>): MixPersistenceCoordinator {
  const canUsePendingStorage = Boolean(
    projectRole !== "viewer" &&
    currentUserId &&
    canPersistMix(projectRole),
  );

  const recoveredPendingMix =
    canUsePendingStorage && currentUserId
      ? loadPendingMixSettings(currentUserId, projectId, storageProvider)
      : null;

  let currentMixSettings = projectRole === "viewer"
    ? loadViewerMixSettings(projectId, storageProvider) ?? initialMixSettings
    : recoveredPendingMix ?? initialMixSettings;

  let pendingMixRevision = recoveredPendingMix ? 1 : 0;
  let persistedMixRevision = 0;
  let persistenceTimerId: TTimeoutHandle | null = null;
  let persistenceInFlight: Promise<boolean> | null = null;

  function clearPersistenceTimer(): void {
    if (persistenceTimerId === null) {
      return;
    }

    clearScheduledTimeout(persistenceTimerId);
    persistenceTimerId = null;
  }

  function rememberPendingMixSettings(mixSettings: MixSettings): void {
    currentMixSettings = mixSettings;
    pendingMixRevision += 1;

    if (!canUsePendingStorage || !currentUserId) {
      return;
    }

    savePendingMixSettings(
      currentUserId,
      projectId,
      mixSettings,
      storageProvider,
    );
  }

  async function savePendingMixToServer(): Promise<boolean> {
    if (
      projectRole === "viewer" ||
      !canPersistMix(projectRole) ||
      !saveServerMixSettings ||
      !currentMixSettings
    ) {
      return true;
    }

    if (persistenceInFlight) {
      const didSave = await persistenceInFlight;

      if (!didSave) {
        return false;
      }

      if (pendingMixRevision > persistedMixRevision) {
        return savePendingMixToServer();
      }

      return true;
    }

    if (pendingMixRevision <= persistedMixRevision) {
      return true;
    }

    const revisionToSave = pendingMixRevision;
    const mixSettingsToSave = currentMixSettings;

    persistenceInFlight = (async () => {
      try {
        const persistedMixSettings =
          (await saveServerMixSettings(mixSettingsToSave)) ?? mixSettingsToSave;

        persistedMixRevision = Math.max(
          persistedMixRevision,
          revisionToSave,
        );

        if (pendingMixRevision === revisionToSave) {
          currentMixSettings = persistedMixSettings;

          if (currentUserId) {
            clearPendingMixSettings(
              currentUserId,
              projectId,
              storageProvider,
            );
          }

          onPersistedMixSettings?.(persistedMixSettings);
        }

        return true;
      } catch {
        onPersistenceError?.();
        return false;
      } finally {
        persistenceInFlight = null;
      }
    })();

    return persistenceInFlight;
  }

  function schedulePendingPersistence(): void {
    if (
      projectRole === "viewer" ||
      !canPersistMix(projectRole) ||
      !saveServerMixSettings
    ) {
      return;
    }

    clearPersistenceTimer();

    persistenceTimerId = scheduleTimeout(() => {
      persistenceTimerId = null;
      void savePendingMixToServer();
    }, persistenceDelayMs);
  }

  function persist(mixSettings: MixSettings): void {
    if (projectRole === "viewer") {
      saveViewerMixSettings(projectId, mixSettings, storageProvider);
      currentMixSettings = mixSettings;
      return;
    }

    if (!canPersistMix(projectRole) || !saveServerMixSettings) {
      return;
    }

    rememberPendingMixSettings(mixSettings);
    schedulePendingPersistence();
  }

  async function flush(): Promise<boolean> {
    clearPersistenceTimer();

    if (projectRole === "viewer") {
      return true;
    }

    if (persistenceInFlight) {
      const didSave = await persistenceInFlight;

      if (!didSave) {
        return false;
      }
    }

    if (pendingMixRevision <= persistedMixRevision) {
      return true;
    }

    return savePendingMixToServer();
  }

  function clearRecovery(): void {
    if (!currentUserId) {
      return;
    }

    clearPendingMixSettings(
      currentUserId,
      projectId,
      storageProvider,
    );
  }

  return {
    getCurrentMixSettings() {
      return currentMixSettings;
    },
    persist,
    flush,
    schedulePendingPersistence,
    hasRecoveredPendingMix() {
      return recoveredPendingMix !== null;
    },
    clearRecovery,
  };
}
