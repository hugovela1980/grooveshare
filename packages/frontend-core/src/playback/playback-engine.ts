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
  /** Signed source-to-project alignment correction in seconds. */
  alignmentOffsetSeconds?: number;
  /** Encoded media before the declared musical origin (for example, count-in capture). */
  mediaLeadInSeconds?: number;
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

export type SynchronizedRecordingPlaybackStart = {
  marker: RecordingStartMarker;
  /** Encoded capture time before marker/project playback begins. */
  mediaLeadInSeconds: number;
  countIn: {
    bars: number;
    beats: number;
    durationSeconds: number;
  };
};

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
  setMetronomeEnabled?(enabled: boolean): void;
  setChannelVolume(channelNumber: number, volume: number): boolean;
  setChannelEnabled(channelNumber: number, enabled: boolean): boolean;
  getSnapshot(): PlaybackSnapshot;
  subscribe(listener: PlaybackStateListener): () => void;
  /**
   * Available on recording-capable engines backed by an authoritative audio
   * clock. The HTML fallback intentionally leaves these undefined.
   */
  /**
   * Start project playback for a new stopped-transport recording pass and
   * return the exact scheduled project/audio-clock marker. Recording sessions
   * use this only after microphone capture has actually entered its recording
   * state so the first project transient cannot outrun MediaRecorder startup.
   */
  startSynchronizedRecordingPlayback?(options?: { countInBars?: number }): Promise<SynchronizedRecordingPlaybackStart>;
  markRecordingStart?(): RecordingStartMarker;
  markRecordingStop?(start: RecordingStartMarker): RecordingTimelineResult;
  destroy?(): void;
}
