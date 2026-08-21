import type {
  MusicalPosition,
  TrackMusicalPlacement,
} from "../domain/types.js";
import type {
  RecordingStartMarker,
  RecordingTimelineResult,
} from "./recording-timeline.js";

export type PlaybackChannel = {
  channelNumber: number;
  trackId: string;
  audioUrl: string;
  volume: number;
  enabled: boolean;
  /** Project-time position where this track begins. Omitted tracks begin at 0. */
  timelineOffsetSeconds?: number;
  /** Persisted musical placement. Authoritative when the project timeline is available. */
  musicalPlacement?: TrackMusicalPlacement;
};

export type PlaybackSnapshot = {
  currentTime: number;
  musicalPosition: MusicalPosition;
  duration: number;
  isPlaying: boolean;
  hasLoadedChannels: boolean;
};

export type PlaybackStateListener = (
  snapshot: PlaybackSnapshot,
) => void;

/**
 * Presentation-independent playback contract used by both GrooveShare clients.
 *
 * The Web Audio implementation delegates project timeline state to the shared
 * Transport abstraction while this contract remains the UI-facing playback seam.
 */
export interface PlaybackEngine {
  loadMix(channels: PlaybackChannel[]): void;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  seekBy(seconds: number): void;
  seekToMusicalPosition(position: MusicalPosition): void;
  setLoopEnabled(enabled: boolean): void;
  setChannelVolume(channelNumber: number, volume: number): boolean;
  setChannelEnabled(channelNumber: number, enabled: boolean): boolean;
  getSnapshot(): PlaybackSnapshot;
  subscribe(listener: PlaybackStateListener): () => void;
  /**
   * Available on recording-capable engines backed by an authoritative audio
   * clock. The HTML fallback intentionally leaves these undefined.
   */
  markRecordingStart?(): RecordingStartMarker;
  markRecordingStop?(start: RecordingStartMarker): RecordingTimelineResult;
  destroy?(): void;
}
