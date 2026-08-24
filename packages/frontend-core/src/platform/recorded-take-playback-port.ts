import type { RecordedAudioCapture } from "./microphone-recording-port.js";

export type RecordedTakePlaybackFailure = {
  message: string;
};

export type RecordedTakePlaybackEndHandler = () => void;
export type RecordedTakePlaybackFailureHandler = (
  failure: RecordedTakePlaybackFailure,
) => void;

/**
 * Platform-neutral boundary for auditioning one temporary in-memory take.
 *
 * Browser implementations may use Blob/object URLs and HTMLAudioElement, but
 * those browser primitives must stay outside frontend-core.
 */
export interface RecordedTakePlaybackPort {
  play(
    capture: RecordedAudioCapture,
    options?: {
      /**
       * Signed source-to-project alignment correction. Positive values advance
       * the take by skipping source audio; negative values delay take playback.
       */
      alignmentOffsetSeconds?: number;
      onEnded?: RecordedTakePlaybackEndHandler;
      onFailure?: RecordedTakePlaybackFailureHandler;
    },
  ): Promise<void>;
  stop(): Promise<void>;
  release(): Promise<void>;
}
