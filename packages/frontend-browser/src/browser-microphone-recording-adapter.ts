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

const MUSIC_RECORDING_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  // Prefer a single captured channel. Browser destinations up-mix mono to both
  // output channels, which avoids interface input 1 appearing only in the left
  // headphone channel while keeping the recorded media genuinely mono.
  channelCount: { ideal: 1 },
};

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

export type BrowserMonoRecordingStream = {
  stream: MediaStream;
  release(): Promise<void>;
};

export type BrowserMonoRecordingStreamFactory = (
  sourceStream: MediaStream,
) => Promise<BrowserMonoRecordingStream | null>;

export type BrowserMicrophoneRecordingAdapterOptions = {
  mediaDevices?: MediaDevicesLike | null;
  MediaRecorderConstructor?: MediaRecorderConstructorLike | null;
  recordingAlignmentDiagnostics?: RecordingAlignmentDiagnosticsPort;
  /** Enable the temporary AudioWorklet PCM tap for this acquired stream. */
  getPcmAlignmentDiagnosticsEnabled?: () => boolean;
  createPcmAlignmentMonitor?: BrowserMicrophonePcmAlignmentMonitorFactory;
  /**
   * Optional browser-only fallback that turns a multichannel capture route
   * into one mono MediaStream before MediaRecorder sees it.
   */
  createMonoRecordingStream?: BrowserMonoRecordingStreamFactory;
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

  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    name === "AbortError"
  ) {
    return new MicrophoneRecordingError(
      "microphone-unavailable",
      "The microphone could not be opened. Check the audio device or route and try again.",
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

async function createDefaultMonoRecordingStream(
  sourceStream: MediaStream,
): Promise<BrowserMonoRecordingStream | null> {
  const browserGlobal = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor =
    browserGlobal.AudioContext ?? browserGlobal.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  const context = new AudioContextConstructor({ latencyHint: "interactive" });
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let downmixNode: GainNode | null = null;
  let destinationNode: MediaStreamAudioDestinationNode | null = null;

  try {
    if (context.state !== "running") {
      await context.resume();
    }

    sourceNode = context.createMediaStreamSource(sourceStream);
    downmixNode = context.createGain();
    destinationNode = context.createMediaStreamDestination();

    // Force the input connection to one channel. Web Audio performs the
    // standard speaker downmix here, so a two-channel interface stream becomes
    // a genuine mono recording instead of a stereo file with signal only left.
    downmixNode.channelCount = 1;
    downmixNode.channelCountMode = "explicit";
    downmixNode.channelInterpretation = "speakers";
    destinationNode.channelCount = 1;
    destinationNode.channelCountMode = "explicit";
    destinationNode.channelInterpretation = "speakers";

    sourceNode.connect(downmixNode);
    downmixNode.connect(destinationNode);

    const normalizedStream = destinationNode.stream;
    if (normalizedStream.getAudioTracks().length === 0) {
      sourceNode.disconnect();
      downmixNode.disconnect();
      await context.close();
      return null;
    }

    return {
      stream: normalizedStream,
      async release() {
        for (const track of normalizedStream.getTracks()) {
          track.stop();
        }
        sourceNode?.disconnect();
        downmixNode?.disconnect();
        await context.close();
      },
    };
  } catch {
    try {
      sourceNode?.disconnect();
      downmixNode?.disconnect();
      await context.close();
    } catch {
      // Fall through to the original stream when normalization is unavailable.
    }
    return null;
  }
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
  getAudioConstraints = () => ({ ...MUSIC_RECORDING_AUDIO_CONSTRAINTS }),
  getPcmAlignmentDiagnosticsEnabled = () => false,
  createPcmAlignmentMonitor = createBrowserMicrophonePcmAlignmentMonitor,
  createMonoRecordingStream = createDefaultMonoRecordingStream,
}: BrowserMicrophoneRecordingAdapterOptions = {}): MicrophoneRecordingPort {
  let stream: MediaStream | null = null;
  let recordingStream: MediaStream | null = null;
  let monoRecordingStream: BrowserMonoRecordingStream | null = null;
  let recorder: MediaRecorderLike | null = null;
  let chunks: Blob[] = [];
  let activeFailureHandler: ((failure: MicrophoneRecordingFailure) => void) | null = null;
  let pendingStart: {
    resolve: () => void;
    reject: (error: MicrophoneRecordingError) => void;
  } | null = null;
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

  function hasUsablePreparedStream(): boolean {
    if (!stream) {
      return false;
    }

    const tracks = stream.getTracks();
    const recordingTracks = recordingStream?.getTracks() ?? tracks;
    return (
      tracks.length > 0 &&
      tracks.some((track) => track.readyState !== "ended") &&
      recordingTracks.length > 0 &&
      recordingTracks.some((track) => track.readyState !== "ended")
    );
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

  async function releasePreparedStream(): Promise<void> {
    const activeMonitor = pcmAlignmentMonitor;
    pcmAlignmentMonitor = null;
    preparedDiagnosticDetail = null;

    const activeMonoRecordingStream = monoRecordingStream;
    monoRecordingStream = null;
    recordingStream = null;

    try {
      await activeMonitor?.release();
    } finally {
      try {
        await activeMonoRecordingStream?.release();
      } finally {
        stopStreamTracks();
      }
    }
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

    if (hasUsablePreparedStream()) {
      return;
    }

    if (stream) {
      // A browser/device route can disappear without the application asking for
      // it (USB unplug, Bluetooth route change, OS device switch). Never reuse
      // an ended stream as though the microphone were still armed.
      try {
        await releasePreparedStream();
      } catch {
        // Re-acquisition is more useful than failing solely because diagnostic
        // cleanup for a stale stream did not complete cleanly.
      }
    }

    try {
      const audioConstraints = getAudioConstraints();
      stream = await supported.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      const audioTrack = stream.getTracks()[0];
      let settings = audioTrack?.getSettings?.() as
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
      let recordingChannelNormalizationMode =
        settings?.channelCount === 1 ? "native-mono" : "not-needed";

      if (audioTrack && typeof settings?.channelCount === "number" && settings.channelCount > 1) {
        try {
          await audioTrack.applyConstraints({
            channelCount: { exact: 1 },
          });
          settings = audioTrack.getSettings?.() as
            | (MediaTrackSettings & { latency?: number })
            | undefined;
          if (settings?.channelCount === 1) {
            recordingChannelNormalizationMode = "track-constraint-mono";
          }
        } catch {
          // Some USB/browser routes report stereo but reject a one-channel
          // track constraint. A Web Audio downmix below is the safe fallback.
        }
      }

      recordingStream = stream;
      if (typeof settings?.channelCount === "number" && settings.channelCount > 1) {
        const normalized = await createMonoRecordingStream?.(stream) ?? null;
        if (normalized) {
          monoRecordingStream = normalized;
          recordingStream = normalized.stream;
          recordingChannelNormalizationMode = "web-audio-downmix";
        } else {
          recordingChannelNormalizationMode = "unresolved-multichannel";
        }
      }

      const requestedConstraints =
        typeof audioConstraints === "object" ? audioConstraints : null;
      const musicCaptureRequested = Boolean(
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
        captureProcessingMode: musicCaptureRequested
          ? "music-unprocessed"
          : "browser-default",
        recordingChannelNormalizationMode,
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
      try {
        await releasePreparedStream();
      } catch {
        // Preserve the original acquisition/configuration failure.
      }
      throw classifyBrowserMicrophoneError(error);
    }
  }

  async function start({
    onFailure,
  }: {
    onFailure?: (failure: MicrophoneRecordingFailure) => void;
  } = {}): Promise<void> {
    const supported = requireSupported();

    if (stream && !hasUsablePreparedStream()) {
      // The route may have ended while the musician was reviewing a take.
      // Reacquire at the last responsible moment so Retry/Record remains
      // reliable without forcing a fresh permission/device request when the
      // existing stream is still healthy.
      await prepare();
    }

    if (!stream) {
      throw new MicrophoneRecordingError(
        "recording-failed",
        "Prepare the microphone before starting a recording.",
      );
    }

    if (recorder?.state === "recording" || pendingStart) {
      throw new MicrophoneRecordingError(
        "recording-failed",
        "Microphone recording is already active.",
      );
    }

    const activeStream = recordingStream ?? stream;

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

    return new Promise<void>((resolve, reject) => {
      pendingStart = { resolve, reject };

      try {
        const mimeType = selectMimeType(supported.MediaRecorderConstructor);
        recorder = mimeType
          ? new supported.MediaRecorderConstructor(activeStream, { mimeType })
          : new supported.MediaRecorderConstructor(activeStream);

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
          const activeStart = pendingStart;
          pendingStart = null;
          activeStart?.resolve();
        };

        recorder.onerror = (event) => {
          const eventError = "error" in event
            ? (event as Event & { error?: unknown }).error
            : event;
          recorderFailure = classifyBrowserMicrophoneError(eventError);

          if (pendingStart) {
            const activeStart = pendingStart;
            pendingStart = null;
            activeStart.reject(recorderFailure);
            return;
          }

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
        const failure = classifyBrowserMicrophoneError(error);
        pendingStart = null;
        detachRecorder();
        chunks = [];
        recorderFailure = null;
        reject(failure);
      }
    });
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
    if (pendingStart) {
      const activeStart = pendingStart;
      pendingStart = null;
      activeStart.reject(
        new MicrophoneRecordingError(
          "recording-failed",
          "Microphone recording was released before capture started.",
        ),
      );
    }

    if (pendingStop) {
      const activeStop = pendingStop;
      pendingStop = null;
      activeStop.reject(
        new MicrophoneRecordingError(
          "recording-failed",
          "Microphone recording was released before capture finished.",
        ),
      );
    }

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
    await releasePreparedStream();
  }

  return {
    prepare,
    start,
    stop,
    release,
  };
}
