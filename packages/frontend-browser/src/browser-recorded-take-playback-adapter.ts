import type {
  RecordedAudioCapture,
  RecordedTakePlaybackFailure,
  RecordedTakePlaybackPort,
} from "@hugovela/frontend-core";

type AudioElementLike = {
  src: string;
  currentTime: number;
  onended: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  play(): Promise<void> | void;
  pause(): void;
  load?: () => void;
  removeAttribute?: (name: string) => void;
};

type ObjectUrlApiLike = {
  createObjectURL(value: Blob): string;
  revokeObjectURL(url: string): void;
};

export type BrowserRecordedTakePlaybackAdapterOptions = {
  createAudioElement?: (() => AudioElementLike) | null;
  objectUrlApi?: ObjectUrlApiLike | null;
  scheduleTimeout?: (handler: () => void, milliseconds: number) => unknown;
  clearScheduledTimeout?: (handle: unknown) => void;
};

function getDefaultAudioElementFactory(): (() => AudioElementLike) | null {
  if (typeof Audio === "undefined") {
    return null;
  }

  return () => new Audio();
}

function getDefaultObjectUrlApi(): ObjectUrlApiLike | null {
  if (typeof URL === "undefined" || !URL.createObjectURL || !URL.revokeObjectURL) {
    return null;
  }

  return URL;
}

function toPlaybackFailure(error: unknown): RecordedTakePlaybackFailure {
  if (error instanceof Error && error.message.trim()) {
    return { message: error.message };
  }

  return { message: "Take audition failed." };
}

/**
 * Browser implementation for auditioning an in-memory microphone take.
 *
 * Blob, object URL, and HTMLAudioElement lifetime all remain here so shared
 * recording/review state never depends on browser-only primitives.
 */
export function createBrowserRecordedTakePlaybackAdapter({
  createAudioElement = getDefaultAudioElementFactory(),
  objectUrlApi = getDefaultObjectUrlApi(),
  scheduleTimeout = (handler, milliseconds) =>
    globalThis.setTimeout(handler, milliseconds),
  clearScheduledTimeout = (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
}: BrowserRecordedTakePlaybackAdapterOptions = {}): RecordedTakePlaybackPort {
  let audioElement: AudioElementLike | null = null;
  let objectUrl: string | null = null;
  let delayedPlayHandle: unknown = null;

  function requireSupported(): {
    createAudioElement: () => AudioElementLike;
    objectUrlApi: ObjectUrlApiLike;
  } {
    if (!createAudioElement || !objectUrlApi) {
      throw new Error("This browser cannot audition temporary microphone takes.");
    }

    return { createAudioElement, objectUrlApi };
  }

  function cleanupCurrentPlayback(): void {
    if (delayedPlayHandle !== null) {
      clearScheduledTimeout(delayedPlayHandle);
      delayedPlayHandle = null;
    }

    const currentAudioElement = audioElement;
    const currentObjectUrl = objectUrl;

    audioElement = null;
    objectUrl = null;

    if (currentAudioElement) {
      currentAudioElement.onended = null;
      currentAudioElement.onerror = null;
      try {
        currentAudioElement.pause();
      } catch {
        // Continue cleanup even if the browser refuses to pause.
      }
      try {
        currentAudioElement.currentTime = 0;
      } catch {
        // Some media implementations disallow seeking before metadata loads.
      }
      currentAudioElement.removeAttribute?.("src");
      currentAudioElement.load?.();
    }

    if (currentObjectUrl) {
      objectUrlApi?.revokeObjectURL(currentObjectUrl);
    }
  }

  async function play(
    capture: RecordedAudioCapture,
    {
      alignmentOffsetSeconds = 0,
      mediaLeadInSeconds = 0,
      onEnded,
      onFailure,
    }: {
      alignmentOffsetSeconds?: number;
      mediaLeadInSeconds?: number;
      onEnded?: () => void;
      onFailure?: (failure: RecordedTakePlaybackFailure) => void;
    } = {},
  ): Promise<void> {
    const supported = requireSupported();
    cleanupCurrentPlayback();

    // TypeScript 6 models Uint8Array as possibly backed by SharedArrayBuffer,
    // while BlobPart requires an ArrayBuffer-backed view. Copy the recorded
    // bytes into a fresh ArrayBuffer-backed Uint8Array before creating the Blob.
    const blobBytes = new Uint8Array(capture.bytes.byteLength);
    blobBytes.set(capture.bytes);
    const blob = new Blob([blobBytes.buffer], {
      type: capture.mimeType || "application/octet-stream",
    });
    const nextObjectUrl = supported.objectUrlApi.createObjectURL(blob);
    const nextAudioElement = supported.createAudioElement();

    objectUrl = nextObjectUrl;
    audioElement = nextAudioElement;
    nextAudioElement.src = nextObjectUrl;

    nextAudioElement.onended = () => {
      if (audioElement !== nextAudioElement) {
        return;
      }
      cleanupCurrentPlayback();
      onEnded?.();
    };

    nextAudioElement.onerror = (event) => {
      if (audioElement !== nextAudioElement) {
        return;
      }
      const eventError = "error" in event
        ? (event as Event & { error?: unknown }).error
        : event;
      const failure = toPlaybackFailure(eventError);
      cleanupCurrentPlayback();
      onFailure?.(failure);
    };

    const normalizedAlignmentOffset = Number.isFinite(alignmentOffsetSeconds)
      ? alignmentOffsetSeconds
      : 0;
    const normalizedMediaLeadIn = Number.isFinite(mediaLeadInSeconds)
      ? Math.max(0, mediaLeadInSeconds)
      : 0;
    const sourceOffsetSeconds =
      normalizedMediaLeadIn + Math.max(0, normalizedAlignmentOffset);
    const delayMilliseconds = Math.max(0, -normalizedAlignmentOffset * 1000);

    if (sourceOffsetSeconds > 0) {
      try {
        nextAudioElement.currentTime = sourceOffsetSeconds;
      } catch {
        // Browsers may defer a seek until media metadata is available. The
        // audition remains usable; persisted Web Audio playback is authoritative.
      }
    }

    const startPlayback = async (): Promise<void> => {
      try {
        await nextAudioElement.play();
      } catch (error) {
        if (audioElement === nextAudioElement) {
          const failure = toPlaybackFailure(error);
          cleanupCurrentPlayback();
          onFailure?.(failure);
        }
      }
    };

    if (delayMilliseconds > 0) {
      delayedPlayHandle = scheduleTimeout(() => {
        delayedPlayHandle = null;
        if (audioElement !== nextAudioElement) {
          return;
        }
        void startPlayback();
      }, delayMilliseconds);
      return;
    }

    try {
      await nextAudioElement.play();
    } catch (error) {
      if (audioElement === nextAudioElement) {
        cleanupCurrentPlayback();
      }
      throw new Error(toPlaybackFailure(error).message);
    }
  }

  async function stop(): Promise<void> {
    cleanupCurrentPlayback();
  }

  async function release(): Promise<void> {
    cleanupCurrentPlayback();
  }

  return {
    play,
    stop,
    release,
  };
}
