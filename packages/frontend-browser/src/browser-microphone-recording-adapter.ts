import {
  MicrophoneRecordingError,
  type MicrophoneRecordingFailure,
  type MicrophoneRecordingPort,
  type RecordedAudioCapture,
  type RecordingAlignmentDiagnosticsPort,
} from "@hugovela/frontend-core";

const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

type MediaDevicesLike = {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
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

export type BrowserMicrophoneRecordingAdapterOptions = {
  mediaDevices?: MediaDevicesLike | null;
  MediaRecorderConstructor?: MediaRecorderConstructorLike | null;
  recordingAlignmentDiagnostics?: RecordingAlignmentDiagnosticsPort;
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
      const requestedConstraints =
        typeof audioConstraints === "object" ? audioConstraints : null;
      const rawDiagnosticRequested = Boolean(
        requestedConstraints &&
        requestedConstraints.echoCancellation === false &&
        requestedConstraints.noiseSuppression === false &&
        requestedConstraints.autoGainControl === false
      );
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
        inputLatencyMilliseconds:
          typeof settings?.latency === "number"
            ? settings.latency * 1000
            : null,
        sampleRate:
          typeof settings?.sampleRate === "number"
            ? settings.sampleRate
            : null,
        channelCount:
          typeof settings?.channelCount === "number"
            ? settings.channelCount
            : null,
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
    stopStreamTracks();
  }

  return {
    prepare,
    start,
    stop,
    release,
  };
}
