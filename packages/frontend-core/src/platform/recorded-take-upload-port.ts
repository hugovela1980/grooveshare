import type {
  Track,
  TrackMusicalPlacement,
} from "../domain/types.js";
import type { RecordedAudioCapture } from "./microphone-recording-port.js";

export type RecordedTakeUploadInput = {
  projectId: string;
  trackName: string;
  capture: RecordedAudioCapture;
  musicalPlacement: TrackMusicalPlacement;
  alignmentOffsetSeconds: number;
  mediaLeadInSeconds: number;
};

export type RecordedTakeUploadFailure = {
  message: string;
};

/**
 * Platform/application boundary for turning one reviewed temporary recording
 * into a normal GrooveShare project track.
 *
 * The shared recording workflow owns the decision to keep a take and the
 * musical placement that must be preserved. Browser-specific File/Blob and
 * multipart behavior stay behind implementations of this port.
 */
export interface RecordedTakeUploadPort {
  upload(input: RecordedTakeUploadInput): Promise<Track>;
}
