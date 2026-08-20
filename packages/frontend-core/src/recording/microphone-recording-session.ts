import type { ProjectRole } from "../domain/types.js";
import { canRecord } from "../permissions/project-permissions.js";
import {
  MicrophoneRecordingError,
  type MicrophoneRecordingFailure,
  type MicrophoneRecordingPort,
  type RecordedAudioCapture,
  toMicrophoneRecordingFailure,
} from "../platform/microphone-recording-port.js";

export type MicrophoneRecordingStatus =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "recording"
  | "stopped"
  | "failed";

export type MicrophoneRecordingSnapshot = {
  status: MicrophoneRecordingStatus;
  capture: RecordedAudioCapture | null;
  failure: MicrophoneRecordingFailure | null;
};

export type MicrophoneRecordingStateListener = (
  snapshot: MicrophoneRecordingSnapshot,
) => void;

export interface MicrophoneRecordingSession {
  arm(): Promise<MicrophoneRecordingSnapshot>;
  start(): Promise<MicrophoneRecordingSnapshot>;
  stop(): Promise<MicrophoneRecordingSnapshot>;
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

/**
 * Shared microphone-recording state machine.
 *
 * This layer owns authorization and workflow state, but it knows nothing about
 * navigator.mediaDevices, MediaRecorder, MediaStream, Blob, or any other
 * browser primitive. Those details belong to the injected recording port.
 */
export function createMicrophoneRecordingSession({
  role,
  recordingPort,
}: {
  role: ProjectRole | null | undefined;
  recordingPort: MicrophoneRecordingPort;
}): MicrophoneRecordingSession {
  let status: MicrophoneRecordingStatus = "idle";
  let capture: RecordedAudioCapture | null = null;
  let failure: MicrophoneRecordingFailure | null = null;
  let destroyed = false;
  const listeners = new Set<MicrophoneRecordingStateListener>();

  function getSnapshot(): MicrophoneRecordingSnapshot {
    return {
      status,
      capture: cloneCapture(capture),
      failure: failure ? { ...failure } : null,
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

  function setFailure(error: unknown): MicrophoneRecordingSnapshot {
    failure = toMicrophoneRecordingFailure(error);
    capture = null;
    status = "failed";
    return notify();
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

    capture = null;
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

    capture = null;
    failure = null;

    try {
      await recordingPort.start({
        onFailure(nextFailure) {
          if (destroyed || status !== "recording") {
            return;
          }

          failure = { ...nextFailure };
          capture = null;
          status = "failed";
          notify();
        },
      });
      status = "recording";
      return notify();
    } catch (error) {
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

    try {
      capture = await recordingPort.stop();
      failure = null;
      status = "stopped";
      return notify();
    } catch (error) {
      return setFailure(error);
    }
  }

  async function reset(): Promise<MicrophoneRecordingSnapshot> {
    ensureActive();

    try {
      await recordingPort.release();
    } catch (error) {
      return setFailure(error);
    }

    capture = null;
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

  async function destroy(): Promise<void> {
    if (destroyed) {
      return;
    }

    destroyed = true;
    listeners.clear();

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
    reset,
    getSnapshot,
    subscribe,
    destroy,
  };
}
