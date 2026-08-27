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
       * Signed source-to-project alignment correction. Negative values advance
       * the take by skipping source audio; positive values delay take playback.
       */
      alignmentOffsetSeconds?: number;
      /** Encoded media to skip before the take's musical origin. */
      mediaLeadInSeconds?: number;
      onEnded?: RecordedTakePlaybackEndHandler;
      onFailure?: RecordedTakePlaybackFailureHandler;
    },
  ): Promise<void>;
  stop(): Promise<void>;
  /** Temporary playback gain (0–1), independent of persisted tracks. */
  setVolume?(volume: number): void;
  release(): Promise<void>;
}
