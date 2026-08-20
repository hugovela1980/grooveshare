export type MicrophoneRecordingErrorCode =
  | "not-authorized"
  | "permission-denied"
  | "microphone-unavailable"
  | "unsupported"
  | "recording-failed";

export type MicrophoneRecordingFailure = {
  code: MicrophoneRecordingErrorCode;
  message: string;
};

export class MicrophoneRecordingError extends Error {
  readonly code: MicrophoneRecordingErrorCode;

  constructor(code: MicrophoneRecordingErrorCode, message: string) {
    super(message);
    this.name = "MicrophoneRecordingError";
    this.code = code;
  }
}

/**
 * Browser-neutral audio captured from one microphone recording pass.
 *
 * The shared layer intentionally stores bytes + MIME type instead of a Blob so
 * that MediaRecorder and other browser-only types do not leak into
 * frontend-core. Later review/upload layers can adapt this payload for their
 * presentation/runtime needs.
 */
export type RecordedAudioCapture = {
  bytes: Uint8Array;
  mimeType: string;
};

export type MicrophoneRecordingFailureHandler = (
  failure: MicrophoneRecordingFailure,
) => void;

/**
 * Platform boundary for microphone capture.
 *
 * prepare() is the permission/device-acquisition step. start()/stop() control
 * one capture pass. release() tears down platform resources such as live media
 * tracks. Browser APIs belong behind an implementation of this contract.
 */
export interface MicrophoneRecordingPort {
  prepare(): Promise<void>;
  start(options?: {
    onFailure?: MicrophoneRecordingFailureHandler;
  }): Promise<void>;
  stop(): Promise<RecordedAudioCapture>;
  release(): Promise<void>;
}

export function toMicrophoneRecordingFailure(
  error: unknown,
  fallbackMessage = "Microphone recording failed.",
): MicrophoneRecordingFailure {
  if (error instanceof MicrophoneRecordingError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error && error.message.trim()) {
    return {
      code: "recording-failed",
      message: error.message,
    };
  }

  return {
    code: "recording-failed",
    message: fallbackMessage,
  };
}
