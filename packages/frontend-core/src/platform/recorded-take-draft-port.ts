import type { MusicalPosition } from "../domain/types.js";
import type { RecordedAudioCapture } from "./microphone-recording-port.js";
import type { RecordingPositionMetadata } from "../playback/recording-timeline.js";

export type RecordedTakeDraft = {
  capture: RecordedAudioCapture;
  timing: {
    transport: RecordingPositionMetadata;
    musicalStart: MusicalPosition;
    musicalStop: MusicalPosition;
    musicalSpanBeats: number;
    mediaLeadInSeconds: number;
  };
  alignmentCompensationMilliseconds: number;
};

/**
 * Durable local storage boundary for one not-yet-kept microphone take.
 * Browser implementations may use IndexedDB, while frontend-core remains free
 * of Blob/IndexedDB dependencies.
 */
export interface RecordedTakeDraftPort {
  load(scopeId: string): Promise<RecordedTakeDraft | null>;
  save(scopeId: string, draft: RecordedTakeDraft): Promise<void>;
  remove(scopeId: string): Promise<void>;
}
