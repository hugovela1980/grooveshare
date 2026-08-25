import type {
  MusicalPosition,
  MusicalTimeline,
  ProjectRole,
  Track,
} from "../domain/types.js";
import { canRecord } from "../permissions/project-permissions.js";
import {
  MicrophoneRecordingError,
  type MicrophoneRecordingFailure,
  type MicrophoneRecordingPort,
  type RecordedAudioCapture,
  toMicrophoneRecordingFailure,
} from "../platform/microphone-recording-port.js";
import type {
  RecordedTakePlaybackFailure,
  RecordedTakePlaybackPort,
} from "../platform/recorded-take-playback-port.js";
import type {
  RecordedTakeUploadFailure,
  RecordedTakeUploadPort,
} from "../platform/recorded-take-upload-port.js";
import type {
  RecordedTakeDraft,
  RecordedTakeDraftPort,
} from "../platform/recorded-take-draft-port.js";
import type {
  RecordingAlignmentDiagnosticObservation,
  RecordingAlignmentDiagnosticsPort,
} from "./recording-alignment-diagnostics.js";
import type { PlaybackEngine } from "../playback/playback-engine.js";
import type {
  RecordingPositionMetadata,
  RecordingStartMarker,
} from "../playback/recording-timeline.js";
import {
  getSecondsPerMusicalBeat,
  normalizeMusicalTimeline,
} from "../timeline/musical-timeline.js";
import {
  normalizeRecordingAlignmentCompensationMilliseconds,
  recordingAlignmentCompensationMillisecondsToSeconds,
} from "./recording-alignment-compensation.js";

export type MicrophoneRecordingStatus =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "recording"
  | "stopped"
  | "failed";

export type MicrophoneTakeReviewStatus = "idle" | "auditioning";
export type MicrophoneTakeSaveStatus = "idle" | "saving";

/**
 * Authoritative project position observed immediately after microphone capture
 * starts. The musical position is derived from the same project-time marker.
 */
export type MicrophoneRecordingStartPosition = {
  transport: RecordingStartMarker;
  musical: MusicalPosition;
};

/**
 * One stopped in-memory take. The audio bytes remain browser-neutral while the
 * timing data is based on the authoritative project transport rather than the
 * encoded file's eventual duration.
 */
export type MicrophoneRecordedTake = {
  capture: RecordedAudioCapture;
  /** Signed alignment chosen while reviewing this specific take. */
  alignmentCompensationMilliseconds: number;
  timing: {
    transport: RecordingPositionMetadata;
    musicalStart: MusicalPosition;
    musicalStop: MusicalPosition;
    musicalSpanBeats: number;
    /** Encoded media before the authoritative project start (count-in/warm-up). */
    mediaLeadInSeconds: number;
  };
};

export type MicrophoneRecordingSnapshot = {
  status: MicrophoneRecordingStatus;
  capture: RecordedAudioCapture | null;
  startPosition: MicrophoneRecordingStartPosition | null;
  take: MicrophoneRecordedTake | null;
  failure: MicrophoneRecordingFailure | null;
  takeReviewStatus: MicrophoneTakeReviewStatus;
  takeReviewFailure: RecordedTakePlaybackFailure | null;
  takeSaveStatus: MicrophoneTakeSaveStatus;
  takeSaveFailure: RecordedTakeUploadFailure | null;
  savedTrack: Track | null;
  /**
   * Signed local capture compensation. Positive values move recorded content
   * earlier; negative values move it later.
   */
  alignmentCompensationMilliseconds: number;
};

export type MicrophoneRecordingStateListener = (
  snapshot: MicrophoneRecordingSnapshot,
) => void;

export interface MicrophoneRecordingSession {
  restorePendingTake(): Promise<MicrophoneRecordingSnapshot>;
  arm(): Promise<MicrophoneRecordingSnapshot>;
  disarm(): Promise<MicrophoneRecordingSnapshot>;
  start(): Promise<MicrophoneRecordingSnapshot>;
  stop(): Promise<MicrophoneRecordingSnapshot>;
  audition(): Promise<MicrophoneRecordingSnapshot>;
  stopAudition(): Promise<MicrophoneRecordingSnapshot>;
  retry(): Promise<MicrophoneRecordingSnapshot>;
  discard(): Promise<MicrophoneRecordingSnapshot>;
  keep(trackName: string): Promise<MicrophoneRecordingSnapshot>;
  setAlignmentCompensationMilliseconds(
    value: number,
  ): MicrophoneRecordingSnapshot;
  adjustAlignmentCompensationMilliseconds(
    delta: number,
  ): MicrophoneRecordingSnapshot;
  resetAlignmentCompensation(): MicrophoneRecordingSnapshot;
  reset(): Promise<MicrophoneRecordingSnapshot>;
  getSnapshot(): MicrophoneRecordingSnapshot;
  subscribe(listener: MicrophoneRecordingStateListener): () => void;
  destroy(): Promise<void>;
}

function cloneCapture(capture: RecordedAudioCapture | null): RecordedAudioCapture | null {
  if (!capture) {
    return null;
  }

  return {
    bytes: new Uint8Array(capture.bytes),
    mimeType: capture.mimeType,
  };
}

function cloneStartPosition(
  startPosition: MicrophoneRecordingStartPosition | null,
): MicrophoneRecordingStartPosition | null {
  if (!startPosition) {
    return null;
  }

  return {
    transport: { ...startPosition.transport },
    musical: { ...startPosition.musical },
  };
}

function cloneTake(take: MicrophoneRecordedTake | null): MicrophoneRecordedTake | null {
  if (!take) {
    return null;
  }

  return {
    capture: cloneCapture(take.capture) as RecordedAudioCapture,
    alignmentCompensationMilliseconds: take.alignmentCompensationMilliseconds,
    timing: {
      transport: { ...take.timing.transport },
      musicalStart: { ...take.timing.musicalStart },
      musicalStop: { ...take.timing.musicalStop },
      musicalSpanBeats: take.timing.musicalSpanBeats,
      mediaLeadInSeconds: take.timing.mediaLeadInSeconds,
    },
  };
}

/**
 * Shared microphone-recording and local take-review state machine.
 *
 * Authorization and workflow state live here, while navigator.mediaDevices,
 * MediaRecorder, MediaStream, Blob, object URLs, HTMLAudioElement, and other
 * browser primitives remain behind injected platform ports.
 *
 * Checkpoint 3B owns transport-synchronized capture. Checkpoint 3C adds a
 * temporary local review loop: a stopped take can be auditioned in context
 * with project playback from its stored transport position, rejected for
 * another pass, or discarded without any server persistence. Checkpoint 3D
 * keeps an approved take through the normal project-track upload path while
 * preserving the musical placement captured by the authoritative transport.
 */
export function createMicrophoneRecordingSession({
  role,
  recordingPort,
  takePlaybackPort,
  takeUploadPort,
  takeDraftPort,
  takeDraftScopeId,
  projectId,
  playbackEngine,
  musicalTimeline,
  recordingAlignmentDiagnostics,
  initialAlignmentCompensationMilliseconds = 0,
  onAlignmentCompensationChanged,
}: {
  role: ProjectRole | null | undefined;
  recordingPort: MicrophoneRecordingPort;
  takePlaybackPort?: RecordedTakePlaybackPort;
  takeUploadPort?: RecordedTakeUploadPort;
  takeDraftPort?: RecordedTakeDraftPort;
  /** User/project-scoped key for durable local draft recovery. */
  takeDraftScopeId?: string;
  projectId?: string;
  playbackEngine?: PlaybackEngine;
  musicalTimeline?: MusicalTimeline;
  recordingAlignmentDiagnostics?: RecordingAlignmentDiagnosticsPort;
  initialAlignmentCompensationMilliseconds?: number;
  onAlignmentCompensationChanged?: (value: number) => void;
}): MicrophoneRecordingSession {
  let status: MicrophoneRecordingStatus = "idle";
  let capture: RecordedAudioCapture | null = null;
  let startPosition: MicrophoneRecordingStartPosition | null = null;
  let take: MicrophoneRecordedTake | null = null;
  let failure: MicrophoneRecordingFailure | null = null;
  let takeReviewStatus: MicrophoneTakeReviewStatus = "idle";
  let takeReviewFailure: RecordedTakePlaybackFailure | null = null;
  let takeSaveStatus: MicrophoneTakeSaveStatus = "idle";
  let takeSaveFailure: RecordedTakeUploadFailure | null = null;
  let savedTrack: Track | null = null;
  let alignmentCompensationMilliseconds =
    normalizeRecordingAlignmentCompensationMilliseconds(
      initialAlignmentCompensationMilliseconds,
    );
  let takeReviewGeneration = 0;
  let destroyed = false;
  let captureActive = false;
  let microphonePrepared = false;
  let stopInProgress = false;
  let recordingMediaLeadInSeconds = 0;
  let draftPersistenceQueue: Promise<void> = Promise.resolve();
  const listeners = new Set<MicrophoneRecordingStateListener>();
  const synchronizationRequested = Boolean(playbackEngine || musicalTimeline);
  const normalizedMusicalTimeline = musicalTimeline
    ? normalizeMusicalTimeline(musicalTimeline)
    : null;
  const resolvedTakeDraftScopeId = takeDraftScopeId ?? projectId ?? null;

  function enqueueDraftPersistence(action: () => Promise<void>): Promise<void> {
    const operation = draftPersistenceQueue.then(action, action);
    draftPersistenceQueue = operation.catch(() => {
      // Durable draft storage is best-effort. A browser storage failure must
      // not make an otherwise usable in-memory recording session fail.
    });
    return draftPersistenceQueue;
  }

  function createCurrentDraft(): RecordedTakeDraft | null {
    if (!take) {
      return null;
    }

    return {
      capture: cloneCapture(take.capture) as RecordedAudioCapture,
      timing: {
        transport: { ...take.timing.transport },
        musicalStart: { ...take.timing.musicalStart },
        musicalStop: { ...take.timing.musicalStop },
        musicalSpanBeats: take.timing.musicalSpanBeats,
        mediaLeadInSeconds: take.timing.mediaLeadInSeconds,
      },
      alignmentCompensationMilliseconds:
        take.alignmentCompensationMilliseconds,
    };
  }

  function persistCurrentTakeDraft(): Promise<void> {
    const draft = createCurrentDraft();
    if (!takeDraftPort || !resolvedTakeDraftScopeId || !draft) {
      return Promise.resolve();
    }

    return enqueueDraftPersistence(() =>
      takeDraftPort.save(resolvedTakeDraftScopeId, draft)
    );
  }

  function removePendingTakeDraft(): Promise<void> {
    if (!takeDraftPort || !resolvedTakeDraftScopeId) {
      return Promise.resolve();
    }

    return enqueueDraftPersistence(() =>
      takeDraftPort.remove(resolvedTakeDraftScopeId)
    );
  }

  function isFiniteMusicalPosition(position: MusicalPosition): boolean {
    return Number.isInteger(position.bar) &&
      position.bar >= 1 &&
      Number.isFinite(position.beat) &&
      position.beat >= 1;
  }

  function isUsableDraft(draft: RecordedTakeDraft): boolean {
    const { timing } = draft;
    return draft.capture.bytes instanceof Uint8Array &&
      typeof draft.capture.mimeType === "string" &&
      draft.capture.bytes.byteLength > 0 &&
      isFiniteMusicalPosition(timing.musicalStart) &&
      isFiniteMusicalPosition(timing.musicalStop) &&
      Number.isFinite(timing.musicalSpanBeats) &&
      timing.musicalSpanBeats >= 0 &&
      Number.isFinite(timing.mediaLeadInSeconds) &&
      timing.mediaLeadInSeconds >= 0 &&
      Number.isFinite(timing.transport.startProjectPositionSeconds) &&
      Number.isFinite(timing.transport.stopProjectPositionSeconds) &&
      Number.isFinite(timing.transport.startAudioContextTimeSeconds) &&
      Number.isFinite(timing.transport.stopAudioContextTimeSeconds) &&
      Number.isFinite(timing.transport.durationSeconds) &&
      Number.isFinite(timing.transport.timelineOffsetSeconds) &&
      Number.isFinite(draft.alignmentCompensationMilliseconds);
  }

  function observeRecordingAlignment(
    observation: RecordingAlignmentDiagnosticObservation,
  ): void {
    recordingAlignmentDiagnostics?.observe(observation);
  }

  function completeRecordingAlignment(
    outcome: "completed" | "failed" | "aborted",
  ): void {
    recordingAlignmentDiagnostics?.completeAttempt(outcome);
  }

  function getSnapshot(): MicrophoneRecordingSnapshot {
    return {
      status,
      capture: cloneCapture(capture),
      startPosition: cloneStartPosition(startPosition),
      take: cloneTake(take),
      failure: failure ? { ...failure } : null,
      takeReviewStatus,
      takeReviewFailure: takeReviewFailure ? { ...takeReviewFailure } : null,
      takeSaveStatus,
      takeSaveFailure: takeSaveFailure ? { ...takeSaveFailure } : null,
      savedTrack: savedTrack
        ? {
            ...savedTrack,
            musicalPlacement: savedTrack.musicalPlacement
              ? {
                  start: { ...savedTrack.musicalPlacement.start },
                  spanBeats: savedTrack.musicalPlacement.spanBeats,
                }
              : undefined,
            alignmentOffsetSeconds: savedTrack.alignmentOffsetSeconds,
            mediaLeadInSeconds: savedTrack.mediaLeadInSeconds,
          }
        : null,
      alignmentCompensationMilliseconds,
    };
  }

  function notify(): MicrophoneRecordingSnapshot {
    const snapshot = getSnapshot();

    for (const listener of listeners) {
      listener(snapshot);
    }

    return snapshot;
  }

  function setAlignmentCompensationMilliseconds(
    value: number,
  ): MicrophoneRecordingSnapshot {
    ensureActive();

    if (status === "recording" || takeSaveStatus === "saving") {
      return getSnapshot();
    }

    const nextValue =
      normalizeRecordingAlignmentCompensationMilliseconds(value);

    if (nextValue === alignmentCompensationMilliseconds) {
      return getSnapshot();
    }

    alignmentCompensationMilliseconds = nextValue;
    if (take) {
      take.alignmentCompensationMilliseconds = nextValue;
      void persistCurrentTakeDraft();
    }
    takeReviewFailure = null;

    try {
      onAlignmentCompensationChanged?.(alignmentCompensationMilliseconds);
    } catch {
      // Persistence/UI callbacks must not make recording unusable.
    }

    return notify();
  }

  function adjustAlignmentCompensationMilliseconds(
    delta: number,
  ): MicrophoneRecordingSnapshot {
    return setAlignmentCompensationMilliseconds(
      alignmentCompensationMilliseconds + delta,
    );
  }

  function resetAlignmentCompensation(): MicrophoneRecordingSnapshot {
    return setAlignmentCompensationMilliseconds(0);
  }

  function ensureActive(): void {
    if (destroyed) {
      throw new Error("Microphone recording session has been destroyed.");
    }
  }

  function clearTakeState(): void {
    capture = null;
    startPosition = null;
    recordingMediaLeadInSeconds = 0;
    take = null;
    takeReviewStatus = "idle";
    takeReviewFailure = null;
    takeSaveStatus = "idle";
    takeSaveFailure = null;
    savedTrack = null;
  }

  function stopSynchronizedPlayback(): void {
    if (synchronizationRequested) {
      playbackEngine?.stop();
    }
  }

  function stopProjectPlaybackForAudition(): void {
    if (!playbackEngine) {
      return;
    }

    const returnPositionSeconds =
      take?.timing.transport.startProjectPositionSeconds;

    playbackEngine.stop();

    if (
      typeof returnPositionSeconds === "number" &&
      Number.isFinite(returnPositionSeconds)
    ) {
      playbackEngine.seek(returnPositionSeconds);
    }
  }

  async function startProjectPlaybackForAudition(
    recordedTake: MicrophoneRecordedTake,
  ): Promise<void> {
    if (!playbackEngine) {
      throw new Error(
        "Project playback is unavailable for synchronized take audition.",
      );
    }

    const playbackSnapshot = playbackEngine.getSnapshot();

    if (!playbackSnapshot.hasLoadedChannels) {
      throw new Error(
        "Load at least one project track before auditioning a recorded take.",
      );
    }

    if (playbackSnapshot.isPlaying) {
      playbackEngine.pause();
    }

    playbackEngine.seek(
      recordedTake.timing.transport.startProjectPositionSeconds,
    );
    await playbackEngine.play();

    if (!playbackEngine.getSnapshot().isPlaying) {
      throw new Error(
        "Project playback could not start for synchronized take audition.",
      );
    }
  }

  function setFailure(error: unknown): MicrophoneRecordingSnapshot {
    failure = toMicrophoneRecordingFailure(error);
    observeRecordingAlignment({
      stage: "attempt-failed",
      source: "recording-session",
      detail: {
        failureCode: failure.code,
        failureMessage: failure.message,
      },
    });
    completeRecordingAlignment("failed");
    clearTakeState();
    status = "failed";
    return notify();
  }

  async function failActiveRecording(
    error: unknown,
  ): Promise<MicrophoneRecordingSnapshot> {
    captureActive = false;
    stopSynchronizedPlayback();

    try {
      await recordingPort.release();
    } catch {
      // Preserve the recording failure as the actionable error.
    }
    microphonePrepared = false;

    return setFailure(error);
  }

  async function failPreparedRecording(
    error: unknown,
    { stopPlayback = false }: { stopPlayback?: boolean } = {},
  ): Promise<MicrophoneRecordingSnapshot> {
    captureActive = false;
    if (stopPlayback) {
      stopSynchronizedPlayback();
    }

    try {
      await recordingPort.release();
    } catch {
      // Preserve the failure that made the prepared capture path unusable.
    }
    microphonePrepared = false;

    return setFailure(error);
  }

  function ensureAuthorized(): boolean {
    if (role && canRecord(role)) {
      return true;
    }

    setFailure(
      new MicrophoneRecordingError(
        "not-authorized",
        "Only project Contributors and Owners can record microphone takes.",
      ),
    );
    return false;
  }

  function getSynchronizationDependencies(): {
    engine: PlaybackEngine;
    timeline: MusicalTimeline;
  } | null {
    if (!synchronizationRequested) {
      return null;
    }

    if (!playbackEngine || !normalizedMusicalTimeline) {
      throw new MicrophoneRecordingError(
        "recording-failed",
        "Recording synchronization requires both project playback and musical timeline information.",
      );
    }

    if (!playbackEngine.markRecordingStart || !playbackEngine.markRecordingStop) {
      throw new MicrophoneRecordingError(
        "unsupported",
        "This playback engine cannot synchronize microphone recording to the project transport.",
      );
    }

    return {
      engine: playbackEngine,
      timeline: normalizedMusicalTimeline,
    };
  }

  async function releaseTakePlayback(): Promise<void> {
    takeReviewGeneration += 1;
    if (takeReviewStatus === "auditioning") {
      stopProjectPlaybackForAudition();
    }
    takeReviewStatus = "idle";
    takeReviewFailure = null;
    await takePlaybackPort?.release();
  }

  async function restorePendingTake(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!takeDraftPort || !resolvedTakeDraftScopeId || status !== "idle" || take) {
      return getSnapshot();
    }

    let draft: RecordedTakeDraft | null = null;
    try {
      draft = await takeDraftPort.load(resolvedTakeDraftScopeId);
    } catch {
      return getSnapshot();
    }

    // Loading IndexedDB is asynchronous. If the user has already armed or
    // otherwise changed the recording session while recovery was in flight,
    // the stale draft must not overwrite the newer workflow state.
    if (destroyed || status !== "idle" || take) {
      return getSnapshot();
    }

    if (!draft) {
      return getSnapshot();
    }

    if (!isUsableDraft(draft)) {
      await removePendingTakeDraft();
      return getSnapshot();
    }

    const restoredAlignment =
      normalizeRecordingAlignmentCompensationMilliseconds(
        draft.alignmentCompensationMilliseconds,
      );
    const restoredTake: MicrophoneRecordedTake = {
      capture: cloneCapture(draft.capture) as RecordedAudioCapture,
      alignmentCompensationMilliseconds: restoredAlignment,
      timing: {
        transport: { ...draft.timing.transport },
        musicalStart: { ...draft.timing.musicalStart },
        musicalStop: { ...draft.timing.musicalStop },
        musicalSpanBeats: draft.timing.musicalSpanBeats,
        mediaLeadInSeconds: draft.timing.mediaLeadInSeconds,
      },
    };

    take = restoredTake;
    capture = cloneCapture(restoredTake.capture);
    alignmentCompensationMilliseconds = restoredAlignment;
    recordingMediaLeadInSeconds = restoredTake.timing.mediaLeadInSeconds;
    startPosition = {
      transport: {
        kind: "recording-start",
        projectPositionSeconds:
          restoredTake.timing.transport.startProjectPositionSeconds,
        musicalPosition: { ...restoredTake.timing.musicalStart },
        audioContextTimeSeconds:
          restoredTake.timing.transport.startAudioContextTimeSeconds,
        playbackState: "playing",
      },
      musical: { ...restoredTake.timing.musicalStart },
    };
    microphonePrepared = false;
    failure = null;
    takeReviewStatus = "idle";
    takeReviewFailure = null;
    takeSaveStatus = "idle";
    takeSaveFailure = null;
    savedTrack = null;
    status = "stopped";

    try {
      onAlignmentCompensationChanged?.(alignmentCompensationMilliseconds);
    } catch {
      // Restored take remains usable even if preference persistence fails.
    }

    return notify();
  }

  async function arm(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (status === "ready") {
      return getSnapshot();
    }

    if (status === "recording") {
      return setFailure(
        new MicrophoneRecordingError(
          "recording-failed",
          "Cannot prepare the microphone while recording is already active.",
        ),
      );
    }

    if (status === "failed") {
      try {
        await recordingPort.release();
      } catch {
        // Re-arm should still attempt a fresh device acquisition.
      }
      microphonePrepared = false;
    }

    if (take || takeReviewStatus === "auditioning" || takeReviewFailure) {
      try {
        await releaseTakePlayback();
      } catch (error) {
        return setFailure(error);
      }
    }

    clearTakeState();
    failure = null;
    status = "requesting-permission";
    notify();

    try {
      await recordingPort.prepare();
      microphonePrepared = true;
      status = "ready";
      return notify();
    } catch (error) {
      return setFailure(error);
    }
  }

  async function disarm(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (status !== "ready") {
      return getSnapshot();
    }

    captureActive = false;

    try {
      await recordingPort.release();
      microphonePrepared = false;
    } catch (error) {
      return setFailure(error);
    }

    clearTakeState();
    failure = null;
    status = "idle";
    return notify();
  }

  async function start(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (status !== "ready" || !microphonePrepared) {
      return setFailure(
        new MicrophoneRecordingError(
          "recording-failed",
          "Prepare the microphone before starting a recording.",
        ),
      );
    }

    clearTakeState();
    failure = null;

    recordingAlignmentDiagnostics?.beginAttempt({
      projectId,
      musicalTimeline: normalizedMusicalTimeline ?? undefined,
    });

    let synchronization: ReturnType<typeof getSynchronizationDependencies>;
    let playbackWasAlreadyRunning = false;

    try {
      synchronization = getSynchronizationDependencies();

      if (synchronization) {
        const beforePlayback = synchronization.engine.getSnapshot();
        playbackWasAlreadyRunning = beforePlayback.isPlaying;
        observeRecordingAlignment({
          stage: "project-playback-start-requested",
          source: "recording-session",
          projectPositionSeconds: beforePlayback.currentTime,
          musicalPosition: { ...beforePlayback.musicalPosition },
          playbackState: beforePlayback.isPlaying ? "playing" : "stopped",
          detail: {
            alreadyPlaying: beforePlayback.isPlaying,
          },
        });

        if (!beforePlayback.hasLoadedChannels) {
          return failPreparedRecording(
            new MicrophoneRecordingError(
              "recording-failed",
              "Load at least one project track before starting a synchronized recording.",
            ),
          );
        }

        if (
          !beforePlayback.isPlaying &&
          !synchronization.engine.startSynchronizedRecordingPlayback
        ) {
          return failPreparedRecording(
            new MicrophoneRecordingError(
              "unsupported",
              "This playback engine cannot start capture-safe synchronized recording playback.",
            ),
          );
        }

        if (beforePlayback.isPlaying) {
          observeRecordingAlignment({
            stage: "project-playback-already-running",
            source: "recording-session",
            projectPositionSeconds: beforePlayback.currentTime,
            musicalPosition: { ...beforePlayback.musicalPosition },
            playbackState: "playing",
          });
        }
      }

      let startFailureReported = false;
      captureActive = true;
      observeRecordingAlignment({
        stage: "microphone-capture-start-requested",
        source: "recording-session",
      });
      await recordingPort.start({
        onFailure(nextFailure) {
          if (destroyed || !captureActive) {
            return;
          }

          startFailureReported = true;
          captureActive = false;
          failure = { ...nextFailure };
          clearTakeState();
          status = "failed";
          stopSynchronizedPlayback();
          observeRecordingAlignment({
            stage: "attempt-failed",
            source: "recording-session",
            detail: {
              failureCode: nextFailure.code,
              failureMessage: nextFailure.message,
            },
          });
          completeRecordingAlignment("failed");
          microphonePrepared = false;
          notify();
          void recordingPort.release().catch(() => {
            // The recorder/device failure is already surfaced to the user.
          });
        },
      });
      observeRecordingAlignment({
        stage: "microphone-capture-start-returned",
        source: "recording-session",
      });

      if (startFailureReported) {
        return getSnapshot();
      }

      if (synchronization) {
        const synchronizedStart = playbackWasAlreadyRunning
          ? null
          : await synchronization.engine.startSynchronizedRecordingPlayback?.({
              countInBars: 1,
            }) ?? null;
        const marker = playbackWasAlreadyRunning
          ? synchronization.engine.markRecordingStart?.() ?? null
          : synchronizedStart?.marker ?? null;

        recordingMediaLeadInSeconds = synchronizedStart?.mediaLeadInSeconds ?? 0;

        if (
          !marker ||
          marker.playbackState !== "playing" ||
          !synchronization.engine.getSnapshot().isPlaying
        ) {
          try {
            await recordingPort.stop();
          } catch {
            // The synchronization failure remains the actionable error.
          }

          captureActive = false;
          stopSynchronizedPlayback();
          try {
            await recordingPort.release();
          } catch {
            // Preserve the synchronization failure as the actionable error.
          }
          microphonePrepared = false;
          return setFailure(
            new MicrophoneRecordingError(
              "recording-failed",
              "Project playback could not be synchronized after microphone capture became active.",
            ),
          );
        }

        observeRecordingAlignment({
          stage: "recording-start-marker-captured",
          source: "recording-session",
          audioContextTimeSeconds: marker.audioContextTimeSeconds,
          projectPositionSeconds: marker.projectPositionSeconds,
          musicalPosition: { ...marker.musicalPosition },
          playbackState: marker.playbackState,
          detail: {
            mediaLeadInMilliseconds: recordingMediaLeadInSeconds * 1000,
            countInBars: synchronizedStart?.countIn.bars ?? 0,
            countInBeats: synchronizedStart?.countIn.beats ?? 0,
          },
        });

        startPosition = {
          transport: marker,
          musical: { ...marker.musicalPosition },
        };
      }

      status = "recording";
      return notify();
    } catch (error) {
      const shouldStopPlayback = captureActive;
      if (captureActive) {
        try {
          await recordingPort.stop();
        } catch {
          // Keep the original startup failure as the actionable error.
        }
      }
      return failPreparedRecording(error, {
        stopPlayback: shouldStopPlayback,
      });
    }
  }

  async function stop(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (status !== "recording") {
      return setFailure(
        new MicrophoneRecordingError(
          "recording-failed",
          "No microphone recording is currently active.",
        ),
      );
    }

    if (stopInProgress) {
      return getSnapshot();
    }

    stopInProgress = true;

    const beforeStop = playbackEngine?.getSnapshot();
    const shouldRestoreRecordingStart = beforeStop?.isPlaying === true;
    observeRecordingAlignment({
      stage: "recording-stop-requested",
      source: "recording-session",
      projectPositionSeconds: beforeStop?.currentTime,
      musicalPosition: beforeStop?.musicalPosition
        ? { ...beforeStop.musicalPosition }
        : undefined,
      playbackState: beforeStop?.isPlaying ? "playing" : undefined,
    });

    try {
      const synchronization = getSynchronizationDependencies();
      const timingResult = synchronization && startPosition
        ? synchronization.engine.markRecordingStop?.(startPosition.transport) ?? null
        : null;

      if (timingResult) {
        observeRecordingAlignment({
          stage: "recording-stop-marker-captured",
          source: "recording-session",
          audioContextTimeSeconds: timingResult.stop.audioContextTimeSeconds,
          projectPositionSeconds: timingResult.stop.projectPositionSeconds,
          musicalPosition: { ...timingResult.stop.musicalPosition },
          playbackState: timingResult.stop.playbackState,
          detail: {
            transportDurationMilliseconds:
              timingResult.metadata.durationSeconds * 1000,
          },
        });
      }

      const capturePromise = recordingPort.stop();

      if (synchronization) {
        const returnPositionSeconds =
          startPosition?.transport.projectPositionSeconds;

        synchronization.engine.stop();

        if (
          shouldRestoreRecordingStart &&
          typeof returnPositionSeconds === "number" &&
          Number.isFinite(returnPositionSeconds)
        ) {
          synchronization.engine.seek(returnPositionSeconds);
        }
      }

      capture = await capturePromise;
      captureActive = false;
      failure = null;
      takeReviewStatus = "idle";
      takeReviewFailure = null;

      if (synchronization) {
        if (!timingResult || !startPosition) {
          return setFailure(
            new MicrophoneRecordingError(
              "recording-failed",
              "Recording stopped without authoritative project timing metadata.",
            ),
          );
        }

        const secondsPerBeat = getSecondsPerMusicalBeat(
          synchronization.timeline,
        );
        take = {
          capture: cloneCapture(capture) as RecordedAudioCapture,
          alignmentCompensationMilliseconds,
          timing: {
            transport: { ...timingResult.metadata },
            musicalStart: { ...startPosition.musical },
            musicalStop: { ...timingResult.stop.musicalPosition },
            musicalSpanBeats: timingResult.metadata.durationSeconds / secondsPerBeat,
            mediaLeadInSeconds: recordingMediaLeadInSeconds,
          },
        };
        observeRecordingAlignment({
          stage: "take-placement-created",
          source: "recording-session",
          audioContextTimeSeconds:
            timingResult.metadata.startAudioContextTimeSeconds,
          projectPositionSeconds:
            timingResult.metadata.startProjectPositionSeconds,
          musicalPosition: { ...startPosition.musical },
          detail: {
            musicalSpanBeats: take.timing.musicalSpanBeats,
            timelineOffsetSeconds:
              timingResult.metadata.timelineOffsetSeconds,
            mediaLeadInMilliseconds: recordingMediaLeadInSeconds * 1000,
          },
        });
        await persistCurrentTakeDraft();
      }

      completeRecordingAlignment("completed");
      status = "stopped";
      return notify();
    } catch (error) {
      return failActiveRecording(error);
    } finally {
      stopInProgress = false;
    }
  }

  async function audition(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (status !== "stopped" || !take) {
      takeReviewFailure = { message: "Record a take before auditioning it." };
      return notify();
    }

    if (takeReviewStatus === "auditioning") {
      return getSnapshot();
    }

    const sampleAccurateAudition = playbackEngine?.auditionRecordedTake;
    if (!sampleAccurateAudition && !takePlaybackPort) {
      takeReviewFailure = {
        message: "Take audition is unavailable in this environment.",
      };
      return notify();
    }

    const generation = ++takeReviewGeneration;
    const alignmentOffsetSeconds =
      recordingAlignmentCompensationMillisecondsToSeconds(
        take.alignmentCompensationMilliseconds,
      );

    try {
      if (sampleAccurateAudition && playbackEngine) {
        await sampleAccurateAudition.call(playbackEngine, {
          capture: cloneCapture(take.capture) as RecordedAudioCapture,
          projectStartSeconds:
            take.timing.transport.startProjectPositionSeconds,
          alignmentOffsetSeconds,
          mediaLeadInSeconds: take.timing.mediaLeadInSeconds,
          onEnded() {
            if (destroyed || generation !== takeReviewGeneration) {
              return;
            }
            stopProjectPlaybackForAudition();
            takeReviewStatus = "idle";
            takeReviewFailure = null;
            notify();
          },
        });
        takeReviewStatus = "auditioning";
        takeReviewFailure = null;
        return notify();
      }

      await startProjectPlaybackForAudition(take);
      takeReviewStatus = "auditioning";
      takeReviewFailure = null;
      notify();

      await takePlaybackPort!.play(take.capture, {
        alignmentOffsetSeconds,
        mediaLeadInSeconds: take.timing.mediaLeadInSeconds,
        onEnded() {
          if (destroyed || generation !== takeReviewGeneration) {
            return;
          }
          stopProjectPlaybackForAudition();
          takeReviewStatus = "idle";
          takeReviewFailure = null;
          notify();
        },
        onFailure(nextFailure) {
          if (destroyed || generation !== takeReviewGeneration) {
            return;
          }
          stopProjectPlaybackForAudition();
          takeReviewStatus = "idle";
          takeReviewFailure = { ...nextFailure };
          notify();
        },
      });
      return getSnapshot();
    } catch (error) {
      if (generation === takeReviewGeneration) {
        stopProjectPlaybackForAudition();
        takeReviewStatus = "idle";
        takeReviewFailure = {
          message: error instanceof Error && error.message.trim()
            ? error.message
            : "Take audition failed.",
        };
        return notify();
      }
      return getSnapshot();
    }
  }

  async function stopAudition(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (takeReviewStatus !== "auditioning") {
      return getSnapshot();
    }

    takeReviewGeneration += 1;
    stopProjectPlaybackForAudition();
    takeReviewStatus = "idle";
    takeReviewFailure = null;

    try {
      await takePlaybackPort?.stop();
      return notify();
    } catch (error) {
      takeReviewFailure = {
        message: error instanceof Error && error.message.trim()
          ? error.message
          : "Take audition could not be stopped cleanly.",
      };
      return notify();
    }
  }

  async function retry(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (status !== "stopped" || !take) {
      takeReviewFailure = { message: "There is no stopped take to retry." };
      return notify();
    }

    try {
      await releaseTakePlayback();
    } catch (error) {
      takeReviewFailure = {
        message: error instanceof Error && error.message.trim()
          ? error.message
          : "Temporary take playback could not be cleaned up.",
      };
      return notify();
    }

    await removePendingTakeDraft();
    clearTakeState();
    failure = null;

    if (microphonePrepared) {
      status = "ready";
      return notify();
    }

    status = "requesting-permission";
    notify();
    try {
      await recordingPort.prepare();
      microphonePrepared = true;
      status = "ready";
      return notify();
    } catch (error) {
      microphonePrepared = false;
      return setFailure(error);
    }
  }

  async function discard(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (status !== "stopped" || !take) {
      takeReviewFailure = { message: "There is no stopped take to discard." };
      return notify();
    }

    try {
      await releaseTakePlayback();
      await recordingPort.release();
      microphonePrepared = false;
      await removePendingTakeDraft();
    } catch (error) {
      return setFailure(error);
    }

    captureActive = false;
    clearTakeState();
    failure = null;
    status = "idle";
    return notify();
  }

  async function keep(trackName: string): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (status !== "stopped" || !take) {
      takeSaveFailure = { message: "There is no stopped take to keep." };
      return notify();
    }

    if (takeSaveStatus === "saving") {
      return getSnapshot();
    }

    const normalizedTrackName = trackName.trim().replace(/\s+/g, " ");

    if (!normalizedTrackName) {
      takeSaveFailure = { message: "Enter a track name before keeping this take." };
      return notify();
    }

    if (!takeUploadPort || !projectId) {
      takeSaveFailure = {
        message: "Saving recorded takes is unavailable in this environment.",
      };
      return notify();
    }

    const takeToKeep = cloneTake(take) as MicrophoneRecordedTake;
    takeSaveStatus = "saving";
    takeSaveFailure = null;
    notify();

    try {
      await releaseTakePlayback();

      const uploadedTrack = await takeUploadPort.upload({
        projectId,
        trackName: normalizedTrackName,
        capture: cloneCapture(takeToKeep.capture) as RecordedAudioCapture,
        musicalPlacement: {
          start: { ...takeToKeep.timing.musicalStart },
          spanBeats: takeToKeep.timing.musicalSpanBeats,
        },
        alignmentOffsetSeconds:
          recordingAlignmentCompensationMillisecondsToSeconds(
            takeToKeep.alignmentCompensationMilliseconds,
          ),
        mediaLeadInSeconds: takeToKeep.timing.mediaLeadInSeconds,
      });

      try {
        await recordingPort.release();
      } catch {
        // The track is already persisted. Treat post-upload microphone cleanup
        // as best effort rather than reporting a false upload failure.
      }
      microphonePrepared = false;
      await removePendingTakeDraft();

      captureActive = false;
      clearTakeState();
      savedTrack = {
        ...uploadedTrack,
        musicalPlacement: uploadedTrack.musicalPlacement
          ? {
              start: { ...uploadedTrack.musicalPlacement.start },
              spanBeats: uploadedTrack.musicalPlacement.spanBeats,
            }
          : undefined,
        alignmentOffsetSeconds: uploadedTrack.alignmentOffsetSeconds,
        mediaLeadInSeconds: uploadedTrack.mediaLeadInSeconds,
      };
      status = "idle";
      return notify();
    } catch (error) {
      takeSaveStatus = "idle";
      takeSaveFailure = {
        message: error instanceof Error && error.message.trim()
          ? error.message
          : "Recorded take could not be saved.",
      };
      return notify();
    }
  }

  async function reset(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    const wasRecording = status === "recording";
    if (recordingAlignmentDiagnostics?.getActiveAttemptId()) {
      completeRecordingAlignment("aborted");
    }
    if (wasRecording) {
      stopInProgress = true;
      stopSynchronizedPlayback();
    }

    captureActive = false;

    try {
      await releaseTakePlayback();
      await recordingPort.release();
      microphonePrepared = false;
      await removePendingTakeDraft();
    } catch (error) {
      return setFailure(error);
    } finally {
      if (wasRecording) {
        stopInProgress = false;
      }
    }

    clearTakeState();
    failure = null;
    status = "idle";
    return notify();
  }

  function subscribe(listener: MicrophoneRecordingStateListener): () => void {
    if (destroyed) {
      listener(getSnapshot());
      return () => {};
    }

    listeners.add(listener);
    listener(getSnapshot());

    return () => {
      listeners.delete(listener);
    };
  }

  const unsubscribePlayback = playbackEngine?.subscribe((snapshot) => {
    if (
      destroyed ||
      !synchronizationRequested ||
      status !== "recording" ||
      stopInProgress ||
      snapshot.isPlaying
    ) {
      return;
    }

    void stop();
  });

  async function destroy(): Promise<void> {
    if (destroyed) {
      return;
    }

    const wasRecording = status === "recording";
    const wasAuditioning = takeReviewStatus === "auditioning";
    if (recordingAlignmentDiagnostics?.getActiveAttemptId()) {
      completeRecordingAlignment("aborted");
    }
    captureActive = false;
    destroyed = true;
    unsubscribePlayback?.();
    listeners.clear();
    takeReviewGeneration += 1;

    if (wasRecording) {
      stopSynchronizedPlayback();
    } else if (wasAuditioning) {
      stopProjectPlaybackForAudition();
    }

    try {
      await takePlaybackPort?.release();
    } catch {
      // Destruction is best-effort cleanup. Continue releasing the microphone.
    }

    try {
      await recordingPort.release();
    } catch {
      // Destruction is best-effort cleanup. The session is already unusable.
    }
    microphonePrepared = false;
  }

  return {
    restorePendingTake,
    arm,
    disarm,
    start,
    stop,
    audition,
    stopAudition,
    retry,
    discard,
    keep,
    setAlignmentCompensationMilliseconds,
    adjustAlignmentCompensationMilliseconds,
    resetAlignmentCompensation,
    reset,
    getSnapshot,
    subscribe,
    destroy,
  };
}
