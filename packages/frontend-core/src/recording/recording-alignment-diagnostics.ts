import type { MusicalPosition, MusicalTimeline } from "../domain/types.js";
import type { TransportPlaybackState } from "../playback/transport.js";

export type RecordingAlignmentDiagnosticStage =
  | "attempt-started"
  | "project-playback-start-requested"
  | "project-playback-already-running"
  | "project-playback-scheduled"
  | "project-output-clock-sample"
  | "microphone-prepared"
  | "microphone-pcm-clock-anchor"
  | "microphone-pcm-transient-detected"
  | "microphone-capture-start-requested"
  | "media-recorder-start-called"
  | "media-recorder-start-event"
  | "microphone-capture-start-returned"
  | "recording-start-marker-captured"
  | "recording-stop-requested"
  | "recording-stop-marker-captured"
  | "media-recorder-stop-called"
  | "media-recorder-stop-event"
  | "recorded-capture-ready"
  | "take-placement-created"
  | "attempt-completed"
  | "attempt-failed"
  | "attempt-aborted";

export type RecordingAlignmentDiagnosticSource =
  | "recording-session"
  | "playback-engine"
  | "microphone-adapter"
  | "microphone-pcm-monitor";

export type RecordingAlignmentAttemptContext = {
  projectId?: string;
  musicalTimeline?: MusicalTimeline;
};

export type RecordingAlignmentDiagnosticObservation = {
  stage: RecordingAlignmentDiagnosticStage;
  source: RecordingAlignmentDiagnosticSource;
  audioContextTimeSeconds?: number;
  scheduledAudioContextTimeSeconds?: number;
  projectPositionSeconds?: number;
  musicalPosition?: MusicalPosition;
  playbackState?: TransportPlaybackState;
  detail?: Record<string, string | number | boolean | null>;
};

export type RecordingAlignmentDiagnosticEvent =
  RecordingAlignmentDiagnosticObservation & {
    attemptId: string;
    sequence: number;
    observedAtMilliseconds: number;
  };

export type RecordingAlignmentAttemptOutcome =
  | "completed"
  | "failed"
  | "aborted";

export type RecordingAlignmentDiagnosticTrace = {
  attemptId: string;
  context: RecordingAlignmentAttemptContext;
  startedAtMilliseconds: number;
  completedAtMilliseconds: number | null;
  outcome: RecordingAlignmentAttemptOutcome | null;
  events: RecordingAlignmentDiagnosticEvent[];
};

export type RecordingAlignmentAnalysis = {
  playbackScheduleLeadMilliseconds: number | null;
  markerRelativeToScheduledPlaybackMilliseconds: number | null;
  mediaRecorderStartSignalDelayMilliseconds: number | null;
  markerRelativeToMediaRecorderStartEventMilliseconds: number | null;
  mediaRecorderStopSignalDelayMilliseconds: number | null;
  placementDeltaFromStartMarkerMilliseconds: number | null;
  /**
   * Estimated delay from the scheduled project-playback start to the first
   * transient observed in the live microphone PCM stream. This uses a
   * diagnostic clock anchor to bridge the microphone monitor's audio clock
   * to the monotonic browser observation clock. It is intentionally a
   * diagnostic estimate, not an automatic latency-compensation value.
   */
  firstPcmTransientRelativeToScheduledPlaybackMilliseconds: number | null;
  /** Estimated delay from MediaRecorder's start event to that PCM transient. */
  firstPcmTransientRelativeToMediaRecorderStartEventMilliseconds: number | null;
  /**
   * Browser estimate of when the scheduled project start reached the output
   * device, using AudioContext.getOutputTimestamp() when available.
   */
  estimatedScheduledOutputDevicePerformanceTimeMilliseconds: number | null;
  /** Difference between the output-device estimate and the simpler currentTime/observation mapping. */
  estimatedOutputDeviceRenderRelativeToScheduledPlaybackMilliseconds: number | null;
  /**
   * Estimated delay from the browser's output-device render timestamp to the
   * first transient seen in live microphone PCM. This is the most useful
   * browser-observable approximation of the platform input/capture path.
   */
  firstPcmTransientRelativeToEstimatedOutputDeviceRenderMilliseconds: number | null;
  /** Browser-reported output latency at playback scheduling time. */
  reportedOutputLatencyMilliseconds: number | null;
  /** Browser-reported microphone input latency at capture preparation time. */
  reportedInputLatencyMilliseconds: number | null;
  /** Sum of the two browser-reported endpoint latency estimates when both exist. */
  reportedEndpointRoundTripLatencyMilliseconds: number | null;
  /**
   * Portion of the measured output-device-to-live-PCM delay not explained by
   * the microphone track's reported input latency. Diagnostic only.
   */
  unaccountedInputPathMilliseconds: number | null;
};

/**
 * Optional diagnostic seam used to investigate microphone/project alignment.
 * Implementations own the monotonic observation clock and output mechanism so
 * frontend-core never needs browser APIs such as performance.now().
 *
 * The port is deliberately diagnostic-only: recording behavior must not depend
 * on whether a diagnostics implementation is present.
 */
export interface RecordingAlignmentDiagnosticsPort {
  beginAttempt(context?: RecordingAlignmentAttemptContext): string;
  observe(observation: RecordingAlignmentDiagnosticObservation): void;
  completeAttempt(outcome: RecordingAlignmentAttemptOutcome): void;
  getActiveAttemptId(): string | null;
}

function cloneTimeline(
  timeline: MusicalTimeline | undefined,
): MusicalTimeline | undefined {
  if (!timeline) {
    return undefined;
  }

  return {
    bpm: timeline.bpm,
    timeSignature: { ...timeline.timeSignature },
  };
}

export function cloneRecordingAlignmentTrace(
  trace: RecordingAlignmentDiagnosticTrace,
): RecordingAlignmentDiagnosticTrace {
  return {
    attemptId: trace.attemptId,
    context: {
      projectId: trace.context.projectId,
      musicalTimeline: cloneTimeline(trace.context.musicalTimeline),
    },
    startedAtMilliseconds: trace.startedAtMilliseconds,
    completedAtMilliseconds: trace.completedAtMilliseconds,
    outcome: trace.outcome,
    events: trace.events.map((event) => ({
      ...event,
      musicalPosition: event.musicalPosition
        ? { ...event.musicalPosition }
        : undefined,
      detail: event.detail ? { ...event.detail } : undefined,
    })),
  };
}

function findEvent(
  trace: RecordingAlignmentDiagnosticTrace,
  stage: RecordingAlignmentDiagnosticStage,
): RecordingAlignmentDiagnosticEvent | null {
  return trace.events.find((event) => event.stage === stage) ?? null;
}

function readNumericDetail(
  event: RecordingAlignmentDiagnosticEvent | null,
  key: string,
): number | null {
  const value = event?.detail?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function millisecondsBetween(
  earlier: RecordingAlignmentDiagnosticEvent | null,
  later: RecordingAlignmentDiagnosticEvent | null,
): number | null {
  if (!earlier || !later) {
    return null;
  }

  return later.observedAtMilliseconds - earlier.observedAtMilliseconds;
}

/**
 * Derives software-side timing deltas from one correlated recording attempt.
 * These numbers can identify scheduling/capture-start delays inside GrooveShare,
 * but they intentionally do not claim to measure physical speaker/microphone or
 * Bluetooth round-trip latency. That requires the repeatable transient test.
 */
export function analyzeRecordingAlignmentTrace(
  trace: RecordingAlignmentDiagnosticTrace,
): RecordingAlignmentAnalysis {
  const playbackScheduled = findEvent(trace, "project-playback-scheduled");
  const pcmClockAnchor = findEvent(trace, "microphone-pcm-clock-anchor");
  const firstPcmTransient = findEvent(trace, "microphone-pcm-transient-detected");
  const microphonePrepared = findEvent(trace, "microphone-prepared");
  const captureRequested = findEvent(trace, "microphone-capture-start-requested");
  const mediaRecorderStarted = findEvent(trace, "media-recorder-start-event");
  const startMarker = findEvent(trace, "recording-start-marker-captured");
  const stopCalled = findEvent(trace, "media-recorder-stop-called");
  const stopEvent = findEvent(trace, "media-recorder-stop-event");
  const takePlacement = findEvent(trace, "take-placement-created");

  const playbackScheduleLeadMilliseconds =
    playbackScheduled?.audioContextTimeSeconds !== undefined &&
    playbackScheduled.scheduledAudioContextTimeSeconds !== undefined
      ? (
          playbackScheduled.scheduledAudioContextTimeSeconds -
          playbackScheduled.audioContextTimeSeconds
        ) * 1000
      : null;

  const markerRelativeToScheduledPlaybackMilliseconds =
    playbackScheduled?.scheduledAudioContextTimeSeconds !== undefined &&
    startMarker?.audioContextTimeSeconds !== undefined
      ? (
          startMarker.audioContextTimeSeconds -
          playbackScheduled.scheduledAudioContextTimeSeconds
        ) * 1000
      : null;

  const placementDeltaFromStartMarkerMilliseconds =
    takePlacement?.projectPositionSeconds !== undefined &&
    startMarker?.projectPositionSeconds !== undefined
      ? (
          takePlacement.projectPositionSeconds -
          startMarker.projectPositionSeconds
        ) * 1000
      : null;

  const scheduledPlaybackObservedMilliseconds =
    playbackScheduled?.audioContextTimeSeconds !== undefined &&
    playbackScheduled.scheduledAudioContextTimeSeconds !== undefined
      ? playbackScheduled.observedAtMilliseconds +
        (
          playbackScheduled.scheduledAudioContextTimeSeconds -
          playbackScheduled.audioContextTimeSeconds
        ) * 1000
      : null;

  const firstPcmTransientObservedMilliseconds =
    pcmClockAnchor?.audioContextTimeSeconds !== undefined &&
    firstPcmTransient?.audioContextTimeSeconds !== undefined
      ? pcmClockAnchor.observedAtMilliseconds +
        (
          firstPcmTransient.audioContextTimeSeconds -
          pcmClockAnchor.audioContextTimeSeconds
        ) * 1000
      : null;

  const firstPcmTransientRelativeToScheduledPlaybackMilliseconds =
    scheduledPlaybackObservedMilliseconds !== null &&
    firstPcmTransientObservedMilliseconds !== null
      ? firstPcmTransientObservedMilliseconds -
        scheduledPlaybackObservedMilliseconds
      : null;

  const firstPcmTransientRelativeToMediaRecorderStartEventMilliseconds =
    firstPcmTransientObservedMilliseconds !== null && mediaRecorderStarted
      ? firstPcmTransientObservedMilliseconds -
        mediaRecorderStarted.observedAtMilliseconds
      : null;

  const estimatedScheduledOutputDevicePerformanceTimeMilliseconds =
    readNumericDetail(
      playbackScheduled,
      "estimatedScheduledOutputPerformanceTimeMilliseconds",
    );

  const estimatedOutputDeviceRenderRelativeToScheduledPlaybackMilliseconds =
    estimatedScheduledOutputDevicePerformanceTimeMilliseconds !== null &&
    scheduledPlaybackObservedMilliseconds !== null
      ? estimatedScheduledOutputDevicePerformanceTimeMilliseconds -
        scheduledPlaybackObservedMilliseconds
      : null;

  const firstPcmTransientRelativeToEstimatedOutputDeviceRenderMilliseconds =
    firstPcmTransientObservedMilliseconds !== null &&
    estimatedScheduledOutputDevicePerformanceTimeMilliseconds !== null
      ? firstPcmTransientObservedMilliseconds -
        estimatedScheduledOutputDevicePerformanceTimeMilliseconds
      : null;

  const reportedOutputLatencyMilliseconds = readNumericDetail(
    playbackScheduled,
    "audioContextOutputLatencyMilliseconds",
  );
  const reportedInputLatencyMilliseconds = readNumericDetail(
    microphonePrepared,
    "inputLatencyMilliseconds",
  );
  const reportedEndpointRoundTripLatencyMilliseconds =
    reportedOutputLatencyMilliseconds !== null &&
    reportedInputLatencyMilliseconds !== null
      ? reportedOutputLatencyMilliseconds + reportedInputLatencyMilliseconds
      : null;
  const unaccountedInputPathMilliseconds =
    firstPcmTransientRelativeToEstimatedOutputDeviceRenderMilliseconds !== null &&
    reportedInputLatencyMilliseconds !== null
      ? firstPcmTransientRelativeToEstimatedOutputDeviceRenderMilliseconds -
        reportedInputLatencyMilliseconds
      : null;

  return {
    playbackScheduleLeadMilliseconds,
    markerRelativeToScheduledPlaybackMilliseconds,
    mediaRecorderStartSignalDelayMilliseconds: millisecondsBetween(
      captureRequested,
      mediaRecorderStarted,
    ),
    markerRelativeToMediaRecorderStartEventMilliseconds: millisecondsBetween(
      mediaRecorderStarted,
      startMarker,
    ),
    mediaRecorderStopSignalDelayMilliseconds: millisecondsBetween(
      stopCalled,
      stopEvent,
    ),
    placementDeltaFromStartMarkerMilliseconds,
    firstPcmTransientRelativeToScheduledPlaybackMilliseconds,
    firstPcmTransientRelativeToMediaRecorderStartEventMilliseconds,
    estimatedScheduledOutputDevicePerformanceTimeMilliseconds,
    estimatedOutputDeviceRenderRelativeToScheduledPlaybackMilliseconds,
    firstPcmTransientRelativeToEstimatedOutputDeviceRenderMilliseconds,
    reportedOutputLatencyMilliseconds,
    reportedInputLatencyMilliseconds,
    reportedEndpointRoundTripLatencyMilliseconds,
    unaccountedInputPathMilliseconds,
  };
}
