import type {
  MusicalPosition,
  MusicalTimeline,
  ProjectRole,
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
import type { PlaybackEngine } from "../playback/playback-engine.js";
import type {
  RecordingPositionMetadata,
  RecordingStartMarker,
} from "../playback/recording-timeline.js";
import {
  getSecondsPerMusicalBeat,
  normalizeMusicalTimeline,
  transportSecondsToMusicalPosition,
} from "../timeline/musical-timeline.js";

export type MicrophoneRecordingStatus =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "recording"
  | "stopped"
  | "failed";

export type MicrophoneTakeReviewStatus = "idle" | "auditioning";

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
  timing: {
    transport: RecordingPositionMetadata;
    musicalStart: MusicalPosition;
    musicalStop: MusicalPosition;
    musicalSpanBeats: number;
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
};

export type MicrophoneRecordingStateListener = (
  snapshot: MicrophoneRecordingSnapshot,
) => void;

export interface MicrophoneRecordingSession {
  arm(): Promise<MicrophoneRecordingSnapshot>;
  start(): Promise<MicrophoneRecordingSnapshot>;
  stop(): Promise<MicrophoneRecordingSnapshot>;
  audition(): Promise<MicrophoneRecordingSnapshot>;
  stopAudition(): Promise<MicrophoneRecordingSnapshot>;
  retry(): Promise<MicrophoneRecordingSnapshot>;
  discard(): Promise<MicrophoneRecordingSnapshot>;
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
    timing: {
      transport: { ...take.timing.transport },
      musicalStart: { ...take.timing.musicalStart },
      musicalStop: { ...take.timing.musicalStop },
      musicalSpanBeats: take.timing.musicalSpanBeats,
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
 * another pass, or discarded without any server persistence.
 */
export function createMicrophoneRecordingSession({
  role,
  recordingPort,
  takePlaybackPort,
  playbackEngine,
  musicalTimeline,
}: {
  role: ProjectRole | null | undefined;
  recordingPort: MicrophoneRecordingPort;
  takePlaybackPort?: RecordedTakePlaybackPort;
  playbackEngine?: PlaybackEngine;
  musicalTimeline?: MusicalTimeline;
}): MicrophoneRecordingSession {
  let status: MicrophoneRecordingStatus = "idle";
  let capture: RecordedAudioCapture | null = null;
  let startPosition: MicrophoneRecordingStartPosition | null = null;
  let take: MicrophoneRecordedTake | null = null;
  let failure: MicrophoneRecordingFailure | null = null;
  let takeReviewStatus: MicrophoneTakeReviewStatus = "idle";
  let takeReviewFailure: RecordedTakePlaybackFailure | null = null;
  let takeReviewGeneration = 0;
  let destroyed = false;
  let captureActive = false;
  let stopInProgress = false;
  const listeners = new Set<MicrophoneRecordingStateListener>();
  const synchronizationRequested = Boolean(playbackEngine || musicalTimeline);
  const normalizedMusicalTimeline = musicalTimeline
    ? normalizeMusicalTimeline(musicalTimeline)
    : null;

  function getSnapshot(): MicrophoneRecordingSnapshot {
    return {
      status,
      capture: cloneCapture(capture),
      startPosition: cloneStartPosition(startPosition),
      take: cloneTake(take),
      failure: failure ? { ...failure } : null,
      takeReviewStatus,
      takeReviewFailure: takeReviewFailure ? { ...takeReviewFailure } : null,
    };
  }

  function notify(): MicrophoneRecordingSnapshot {
    const snapshot = getSnapshot();

    for (const listener of listeners) {
      listener(snapshot);
    }

    return snapshot;
  }

  function ensureActive(): void {
    if (destroyed) {
      throw new Error("Microphone recording session has been destroyed.");
    }
  }

  function clearTakeState(): void {
    capture = null;
    startPosition = null;
    take = null;
    takeReviewStatus = "idle";
    takeReviewFailure = null;
  }

  function stopSynchronizedPlayback(): void {
    if (synchronizationRequested) {
      playbackEngine?.stop();
    }
  }

  function stopProjectPlaybackForAudition(): void {
    playbackEngine?.stop();
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
    clearTakeState();
    status = "failed";
    return notify();
  }

  function failActiveRecording(error: unknown): MicrophoneRecordingSnapshot {
    captureActive = false;
    stopSynchronizedPlayback();
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
      status = "ready";
      return notify();
    } catch (error) {
      return setFailure(error);
    }
  }

  async function start(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    if (!ensureAuthorized()) {
      return getSnapshot();
    }

    if (status !== "ready") {
      return setFailure(
        new MicrophoneRecordingError(
          "recording-failed",
          "Prepare the microphone before starting a recording.",
        ),
      );
    }

    clearTakeState();
    failure = null;

    let synchronization: ReturnType<typeof getSynchronizationDependencies>;

    try {
      synchronization = getSynchronizationDependencies();

      if (synchronization) {
        const beforePlayback = synchronization.engine.getSnapshot();

        if (!beforePlayback.hasLoadedChannels) {
          return setFailure(
            new MicrophoneRecordingError(
              "recording-failed",
              "Load at least one project track before starting a synchronized recording.",
            ),
          );
        }

        if (!beforePlayback.isPlaying) {
          await synchronization.engine.play();
        }

        if (!synchronization.engine.getSnapshot().isPlaying) {
          return setFailure(
            new MicrophoneRecordingError(
              "recording-failed",
              "Project playback could not start for synchronized recording.",
            ),
          );
        }
      }

      let startFailureReported = false;
      captureActive = true;
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
          notify();
        },
      });

      if (startFailureReported) {
        return getSnapshot();
      }

      if (synchronization) {
        const marker = synchronization.engine.markRecordingStart?.();

        if (!marker || marker.playbackState !== "playing") {
          try {
            await recordingPort.stop();
          } catch {
            // The synchronization failure remains the actionable error.
          }

          captureActive = false;
          stopSynchronizedPlayback();
          return setFailure(
            new MicrophoneRecordingError(
              "recording-failed",
              "The project transport stopped before microphone capture could be synchronized.",
            ),
          );
        }

        startPosition = {
          transport: marker,
          musical: transportSecondsToMusicalPosition(
            synchronization.timeline,
            marker.projectPositionSeconds,
          ),
        };
      }

      status = "recording";
      return notify();
    } catch (error) {
      const shouldStopPlayback = captureActive;
      captureActive = false;
      if (shouldStopPlayback) {
        stopSynchronizedPlayback();
      }
      return setFailure(error);
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

    try {
      const synchronization = getSynchronizationDependencies();
      const timingResult = synchronization && startPosition
        ? synchronization.engine.markRecordingStop?.(startPosition.transport) ?? null
        : null;
      const capturePromise = recordingPort.stop();

      if (synchronization) {
        synchronization.engine.stop();
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
        const musicalStop = transportSecondsToMusicalPosition(
          synchronization.timeline,
          timingResult.stop.projectPositionSeconds,
        );

        take = {
          capture: cloneCapture(capture) as RecordedAudioCapture,
          timing: {
            transport: { ...timingResult.metadata },
            musicalStart: { ...startPosition.musical },
            musicalStop,
            musicalSpanBeats: timingResult.metadata.durationSeconds / secondsPerBeat,
          },
        };
      }

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

    if (!takePlaybackPort) {
      takeReviewFailure = {
        message: "Take audition is unavailable in this environment.",
      };
      return notify();
    }

    const generation = ++takeReviewGeneration;

    try {
      await startProjectPlaybackForAudition(take);
      takeReviewStatus = "auditioning";
      takeReviewFailure = null;
      notify();

      await takePlaybackPort.play(take.capture, {
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

    clearTakeState();
    failure = null;
    status = "ready";
    return notify();
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
    } catch (error) {
      return setFailure(error);
    }

    captureActive = false;
    clearTakeState();
    failure = null;
    status = "idle";
    return notify();
  }

  async function reset(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    const wasRecording = status === "recording";
    if (wasRecording) {
      stopInProgress = true;
      stopSynchronizedPlayback();
    }

    captureActive = false;

    try {
      await releaseTakePlayback();
      await recordingPort.release();
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
  }

  return {
    arm,
    start,
    stop,
    audition,
    stopAudition,
    retry,
    discard,
    reset,
    getSnapshot,
    subscribe,
    destroy,
  };
}
