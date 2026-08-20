import {
  MicrophoneRecordingError,
  type MicrophoneRecordingFailure,
  type MicrophoneRecordingPort,
  type RecordedAudioCapture,
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
      stream = await supported.mediaDevices.getUserMedia({ audio: true });
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
          detachRecorder();
          chunks = [];
          activeStop.resolve(capture);
        } catch (error) {
          detachRecorder();
          chunks = [];
          activeStop.reject(classifyBrowserMicrophoneError(error));
        }
      };

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
    stopStreamTracks();
  }

  return {
    prepare,
    start,
    stop,
    release,
  };
}
