import {
  MicrophoneRecordingError,
  type MicrophoneRecordingFailure,
  type MicrophoneRecordingPort,
  type RecordedAudioCapture,
  type RecordingAlignmentDiagnosticsPort,
} from "@hugovela/frontend-core";
import {
  createBrowserMicrophonePcmAlignmentMonitor,
  type BrowserMicrophonePcmAlignmentMonitor,
  type BrowserMicrophonePcmAlignmentMonitorOptions,
} from "./browser-microphone-pcm-alignment-monitor.js";

const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

type MediaDevicesLike = {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  getSupportedConstraints?: () => MediaTrackSupportedConstraints;
};

type MediaRecorderLike = {
  readonly mimeType: string;
  readonly state: RecordingState;
  ondataavailable: ((event: BlobEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
  onstop: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
};

type MediaRecorderConstructorLike = {
  new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorderLike;
  isTypeSupported?: (mimeType: string) => boolean;
};

export type BrowserMicrophonePcmAlignmentMonitorFactory = (
  options: BrowserMicrophonePcmAlignmentMonitorOptions,
) => Promise<BrowserMicrophonePcmAlignmentMonitor | null>;

export type BrowserMicrophoneRecordingAdapterOptions = {
  mediaDevices?: MediaDevicesLike | null;
  MediaRecorderConstructor?: MediaRecorderConstructorLike | null;
  recordingAlignmentDiagnostics?: RecordingAlignmentDiagnosticsPort;
  /** Enable the temporary AudioWorklet PCM tap for this acquired stream. */
  getPcmAlignmentDiagnosticsEnabled?: () => boolean;
  createPcmAlignmentMonitor?: BrowserMicrophonePcmAlignmentMonitorFactory;
  /**
   * Resolve browser microphone constraints at prepare-time. This is kept in
   * frontend-browser so diagnostic capture choices never leak into the shared
   * recording port.
   */
  getAudioConstraints?: () => boolean | MediaTrackConstraints;
};

function getDefaultMediaDevices(): MediaDevicesLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator.mediaDevices ?? null;
}

function getDefaultMediaRecorderConstructor(): MediaRecorderConstructorLike | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  return MediaRecorder as unknown as MediaRecorderConstructorLike;
}

function classifyBrowserMicrophoneError(error: unknown): MicrophoneRecordingError {
  if (error instanceof MicrophoneRecordingError) {
    return error;
  }

  const name = typeof error === "object" && error !== null && "name" in error
    ? String((error as { name?: unknown }).name ?? "")
    : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return new MicrophoneRecordingError(
      "permission-denied",
      "Microphone permission was denied.",
    );
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return new MicrophoneRecordingError(
      "microphone-unavailable",
      "No microphone input device is available.",
    );
  }

  const message = error instanceof Error && error.message.trim()
    ? error.message
    : "Browser microphone recording failed.";

  return new MicrophoneRecordingError("recording-failed", message);
}

function selectMimeType(
  MediaRecorderConstructor: MediaRecorderConstructorLike,
): string | undefined {
  if (!MediaRecorderConstructor.isTypeSupported) {
    return undefined;
  }

  return PREFERRED_AUDIO_MIME_TYPES.find((mimeType) =>
    MediaRecorderConstructor.isTypeSupported?.(mimeType),
  );
}

function readRangeMinimumMilliseconds(
  range: { min?: number } | undefined,
): number | null {
  return typeof range?.min === "number" && Number.isFinite(range.min)
    ? range.min * 1000
    : null;
}

function readRangeMaximumMilliseconds(
  range: { max?: number } | undefined,
): number | null {
  return typeof range?.max === "number" && Number.isFinite(range.max)
    ? range.max * 1000
    : null;
}

function readRangeMinimum(
  range: { min?: number } | undefined,
): number | null {
  return typeof range?.min === "number" && Number.isFinite(range.min)
    ? range.min
    : null;
}

function readRangeMaximum(
  range: { max?: number } | undefined,
): number | null {
  return typeof range?.max === "number" && Number.isFinite(range.max)
    ? range.max
    : null;
}

function createUnsupportedError(): MicrophoneRecordingError {
  return new MicrophoneRecordingError(
    "unsupported",
    "This browser does not support microphone recording.",
  );
}

/**
 * Browser implementation of the shared microphone recording port.
 *
 * navigator.mediaDevices and MediaRecorder are intentionally contained here;
 * frontend-core only sees a browser-neutral recording contract.
 */
export function createBrowserMicrophoneRecordingAdapter({
  mediaDevices = getDefaultMediaDevices(),
  MediaRecorderConstructor = getDefaultMediaRecorderConstructor(),
  recordingAlignmentDiagnostics,
  getAudioConstraints = () => true,
  getPcmAlignmentDiagnosticsEnabled = () => false,
  createPcmAlignmentMonitor = createBrowserMicrophonePcmAlignmentMonitor,
}: BrowserMicrophoneRecordingAdapterOptions = {}): MicrophoneRecordingPort {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorderLike | null = null;
  let chunks: Blob[] = [];
  let activeFailureHandler: ((failure: MicrophoneRecordingFailure) => void) | null = null;
  let pendingStop: {
    resolve: (capture: RecordedAudioCapture) => void;
    reject: (error: MicrophoneRecordingError) => void;
  } | null = null;
  let recorderFailure: MicrophoneRecordingError | null = null;
  let preparedDiagnosticDetail: Record<
    string,
    string | number | boolean | null
  > | null = null;
  let pcmAlignmentMonitor: BrowserMicrophonePcmAlignmentMonitor | null = null;

  function requireSupported(): {
    mediaDevices: MediaDevicesLike;
    MediaRecorderConstructor: MediaRecorderConstructorLike;
  } {
    if (!mediaDevices?.getUserMedia || !MediaRecorderConstructor) {
      throw createUnsupportedError();
    }

    return {
      mediaDevices,
      MediaRecorderConstructor,
    };
  }

  function stopStreamTracks(): void {
    if (!stream) {
      return;
    }

    for (const track of stream.getTracks()) {
      track.stop();
    }

    stream = null;
  }

  function detachRecorder(): void {
    if (!recorder) {
      return;
    }

    recorder.ondataavailable = null;
    recorder.onerror = null;
    recorder.onstart = null;
    recorder.onstop = null;
    recorder = null;
    activeFailureHandler = null;
  }

  async function prepare(): Promise<void> {
    const supported = requireSupported();

    if (stream) {
      return;
    }

    try {
      const audioConstraints = getAudioConstraints();
      stream = await supported.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      const audioTrack = stream.getTracks()[0];
      const settings = audioTrack?.getSettings?.() as
        | (MediaTrackSettings & { latency?: number })
        | undefined;
      const capabilities = audioTrack?.getCapabilities?.() as
        | (MediaTrackCapabilities & {
            latency?: { min?: number; max?: number };
            sampleRate?: { min?: number; max?: number };
            channelCount?: { min?: number; max?: number };
          })
        | undefined;
      const appliedTrackConstraints = audioTrack?.getConstraints?.() as
        | (MediaTrackConstraints & { latency?: ConstrainDouble })
        | undefined;
      const supportedConstraints = supported.mediaDevices.getSupportedConstraints?.() as
        | (MediaTrackSupportedConstraints & { latency?: boolean })
        | undefined;
      const requestedConstraints =
        typeof audioConstraints === "object" ? audioConstraints : null;
      const rawDiagnosticRequested = Boolean(
        requestedConstraints &&
        requestedConstraints.echoCancellation === false &&
        requestedConstraints.noiseSuppression === false &&
        requestedConstraints.autoGainControl === false
      );
      const requestedLatencyConstraint = (requestedConstraints as
        | (MediaTrackConstraints & { latency?: ConstrainDouble })
        | null)?.latency;
      const requestedLatencyConstraintValue =
        typeof requestedLatencyConstraint === "number"
          ? requestedLatencyConstraint
          : null;
      const requestedLatencyConstraintIdeal =
        typeof requestedLatencyConstraint === "object" &&
        requestedLatencyConstraint !== null &&
        "ideal" in requestedLatencyConstraint &&
        typeof requestedLatencyConstraint.ideal === "number"
          ? requestedLatencyConstraint.ideal
          : null;
      const requestedLatencyConstraintExact =
        typeof requestedLatencyConstraint === "object" &&
        requestedLatencyConstraint !== null &&
        "exact" in requestedLatencyConstraint &&
        typeof requestedLatencyConstraint.exact === "number"
          ? requestedLatencyConstraint.exact
          : null;
      const appliedLatencyConstraint = appliedTrackConstraints?.latency;
      const appliedLatencyConstraintValue =
        typeof appliedLatencyConstraint === "number"
          ? appliedLatencyConstraint
          : null;
      const appliedLatencyConstraintIdeal =
        typeof appliedLatencyConstraint === "object" &&
        appliedLatencyConstraint !== null &&
        "ideal" in appliedLatencyConstraint &&
        typeof appliedLatencyConstraint.ideal === "number"
          ? appliedLatencyConstraint.ideal
          : null;
      const appliedLatencyConstraintExact =
        typeof appliedLatencyConstraint === "object" &&
        appliedLatencyConstraint !== null &&
        "exact" in appliedLatencyConstraint &&
        typeof appliedLatencyConstraint.exact === "number"
          ? appliedLatencyConstraint.exact
          : null;
      let pcmAlignmentMonitorStatus = "disabled";
      let pcmAlignmentMonitorError: string | null = null;

      if (
        recordingAlignmentDiagnostics &&
        getPcmAlignmentDiagnosticsEnabled()
      ) {
        try {
          pcmAlignmentMonitor = await createPcmAlignmentMonitor({
            stream,
            recordingAlignmentDiagnostics,
          });
          pcmAlignmentMonitorStatus = pcmAlignmentMonitor
            ? "ready"
            : "unsupported";
        } catch (error) {
          pcmAlignmentMonitor = null;
          pcmAlignmentMonitorStatus = "failed";
          pcmAlignmentMonitorError = error instanceof Error
            ? error.message
            : String(error);
        }
      }

      preparedDiagnosticDetail = {
        captureProcessingMode: rawDiagnosticRequested
          ? "raw-diagnostic"
          : "browser-default",
        requestedEchoCancellation:
          typeof requestedConstraints?.echoCancellation === "boolean"
            ? requestedConstraints.echoCancellation
            : null,
        requestedNoiseSuppression:
          typeof requestedConstraints?.noiseSuppression === "boolean"
            ? requestedConstraints.noiseSuppression
            : null,
        requestedAutoGainControl:
          typeof requestedConstraints?.autoGainControl === "boolean"
            ? requestedConstraints.autoGainControl
            : null,
        pcmAlignmentMonitorStatus,
        pcmAlignmentMonitorError,
        inputDeviceLabel:
          typeof audioTrack?.label === "string" && audioTrack.label
            ? audioTrack.label
            : null,
        inputLatencyMilliseconds:
          typeof settings?.latency === "number"
            ? settings.latency * 1000
            : null,
        latencyConstraintSupported:
          typeof supportedConstraints?.latency === "boolean"
            ? supportedConstraints.latency
            : null,
        inputLatencyCapabilityMinimumMilliseconds:
          readRangeMinimumMilliseconds(capabilities?.latency),
        inputLatencyCapabilityMaximumMilliseconds:
          readRangeMaximumMilliseconds(capabilities?.latency),
        requestedLatencyConstraintMilliseconds:
          requestedLatencyConstraintValue !== null
            ? requestedLatencyConstraintValue * 1000
            : null,
        requestedLatencyConstraintIdealMilliseconds:
          requestedLatencyConstraintIdeal !== null
            ? requestedLatencyConstraintIdeal * 1000
            : null,
        requestedLatencyConstraintExactMilliseconds:
          requestedLatencyConstraintExact !== null
            ? requestedLatencyConstraintExact * 1000
            : null,
        appliedLatencyConstraintMilliseconds:
          appliedLatencyConstraintValue !== null
            ? appliedLatencyConstraintValue * 1000
            : null,
        appliedLatencyConstraintIdealMilliseconds:
          appliedLatencyConstraintIdeal !== null
            ? appliedLatencyConstraintIdeal * 1000
            : null,
        appliedLatencyConstraintExactMilliseconds:
          appliedLatencyConstraintExact !== null
            ? appliedLatencyConstraintExact * 1000
            : null,
        sampleRate:
          typeof settings?.sampleRate === "number"
            ? settings.sampleRate
            : null,
        channelCount:
          typeof settings?.channelCount === "number"
            ? settings.channelCount
            : null,
        sampleRateCapabilityMinimum: readRangeMinimum(capabilities?.sampleRate),
        sampleRateCapabilityMaximum: readRangeMaximum(capabilities?.sampleRate),
        channelCountCapabilityMinimum: readRangeMinimum(capabilities?.channelCount),
        channelCountCapabilityMaximum: readRangeMaximum(capabilities?.channelCount),
        echoCancellation:
          typeof settings?.echoCancellation === "boolean"
            ? settings.echoCancellation
            : null,
        noiseSuppression:
          typeof settings?.noiseSuppression === "boolean"
            ? settings.noiseSuppression
            : null,
        autoGainControl:
          typeof settings?.autoGainControl === "boolean"
            ? settings.autoGainControl
            : null,
      };
    } catch (error) {
      throw classifyBrowserMicrophoneError(error);
    }
  }

  async function start({
    onFailure,
  }: {
    onFailure?: (failure: MicrophoneRecordingFailure) => void;
  } = {}): Promise<void> {
    const supported = requireSupported();

    if (!stream) {
      throw new MicrophoneRecordingError(
        "recording-failed",
        "Prepare the microphone before starting a recording.",
      );
    }

    if (recorder?.state === "recording") {
      throw new MicrophoneRecordingError(
        "recording-failed",
        "Microphone recording is already active.",
      );
    }

    chunks = [];
    recorderFailure = null;
    activeFailureHandler = onFailure ?? null;

    recordingAlignmentDiagnostics?.observe({
      stage: "microphone-prepared",
      source: "microphone-adapter",
      detail: preparedDiagnosticDetail
        ? { ...preparedDiagnosticDetail }
        : undefined,
    });
    pcmAlignmentMonitor?.markAttemptClockAnchor();

    try {
      const mimeType = selectMimeType(supported.MediaRecorderConstructor);
      recorder = mimeType
        ? new supported.MediaRecorderConstructor(stream, { mimeType })
        : new supported.MediaRecorderConstructor(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstart = () => {
        recordingAlignmentDiagnostics?.observe({
          stage: "media-recorder-start-event",
          source: "microphone-adapter",
          detail: {
            recorderState: recorder?.state ?? "unknown",
          },
        });
      };

      recorder.onerror = (event) => {
        const eventError = "error" in event
          ? (event as Event & { error?: unknown }).error
          : event;
        recorderFailure = classifyBrowserMicrophoneError(eventError);
        activeFailureHandler?.({
          code: recorderFailure.code,
          message: recorderFailure.message,
        });
      };

      recorder.onstop = async () => {
        recordingAlignmentDiagnostics?.observe({
          stage: "media-recorder-stop-event",
          source: "microphone-adapter",
          detail: {
            chunkCount: chunks.length,
          },
        });
        const activeStop = pendingStop;

        if (!activeStop) {
          detachRecorder();
          chunks = [];
          recorderFailure = null;
          return;
        }

        pendingStop = null;

        if (recorderFailure) {
          const failure = recorderFailure;
          detachRecorder();
          chunks = [];
          recorderFailure = null;
          activeStop.reject(failure);
          return;
        }

        try {
          const blob = new Blob(chunks, {
            type: recorder?.mimeType || chunks[0]?.type || "application/octet-stream",
          });
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const capture: RecordedAudioCapture = {
            bytes,
            mimeType: blob.type || "application/octet-stream",
          };
          recordingAlignmentDiagnostics?.observe({
            stage: "recorded-capture-ready",
            source: "microphone-adapter",
            detail: {
              byteLength: capture.bytes.byteLength,
              mimeType: capture.mimeType,
            },
          });
          detachRecorder();
          chunks = [];
          activeStop.resolve(capture);
        } catch (error) {
          detachRecorder();
          chunks = [];
          activeStop.reject(classifyBrowserMicrophoneError(error));
        }
      };

      recordingAlignmentDiagnostics?.observe({
        stage: "media-recorder-start-called",
        source: "microphone-adapter",
      });
      recorder.start();
    } catch (error) {
      detachRecorder();
      chunks = [];
      recorderFailure = null;
      throw classifyBrowserMicrophoneError(error);
    }
  }

  async function stop(): Promise<RecordedAudioCapture> {
    if (!recorder || recorder.state !== "recording") {
      throw new MicrophoneRecordingError(
        "recording-failed",
        "No microphone recording is currently active.",
      );
    }

    if (pendingStop) {
      throw new MicrophoneRecordingError(
        "recording-failed",
        "Microphone recording is already stopping.",
      );
    }

    return new Promise<RecordedAudioCapture>((resolve, reject) => {
      pendingStop = { resolve, reject };

      try {
        recordingAlignmentDiagnostics?.observe({
          stage: "media-recorder-stop-called",
          source: "microphone-adapter",
        });
        recorder?.stop();
      } catch (error) {
        pendingStop = null;
        reject(classifyBrowserMicrophoneError(error));
      }
    });
  }

  async function release(): Promise<void> {
    pendingStop = null;

    if (recorder?.state === "recording") {
      try {
        recorder.stop();
      } catch {
        // Resource cleanup continues even if MediaRecorder refuses to stop.
      }
    }

    detachRecorder();
    chunks = [];
    recorderFailure = null;
    preparedDiagnosticDetail = null;
    await pcmAlignmentMonitor?.release();
    pcmAlignmentMonitor = null;
    stopStreamTracks();
  }

  return {
    prepare,
    start,
    stop,
    release,
  };
}
