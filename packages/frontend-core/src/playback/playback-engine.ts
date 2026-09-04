import type {
  MusicalPosition,
  TrackMusicalPlacement,
} from "../domain/types.js";
import type {
  RecordingStartMarker,
  RecordingTimelineResult,
} from "./recording-timeline.js";
import type { RecordedAudioCapture } from "../platform/microphone-recording-port.js";
import type {
  PlaybackChannelMediaSources,
  PlaybackMediaRepresentation,
} from "./playback-media.js";

export type PlaybackChannel = PlaybackChannelMediaSources & {
  channelNumber: number;
  trackId: string;
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

export type PlaybackPreparationStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "failed";

export type PlaybackChannelPreparationStatus =
  | "unloaded"
  | "fetching"
  | "decoding"
  | "ready"
  | "failed";

export type PlaybackPreparationFailure = {
  channelNumber: number;
  trackId: string;
  message: string;
};

export type PlaybackChannelPreparationSnapshot = {
  channelNumber: number;
  trackId: string;
  required: boolean;
  status: PlaybackChannelPreparationStatus;
  failureMessage: string | null;
  activeSource: Extract<PlaybackMediaRepresentation, "playback-derivative"> | null;
  preparedSources: {
    playbackDerivative: PlaybackChannelPreparationStatus;
    original: PlaybackChannelPreparationStatus;
  };
};

export type PlaybackPreparationSnapshot = {
  status: PlaybackPreparationStatus;
  requiredChannelCount: number;
  readyRequiredChannelCount: number;
  channels: PlaybackChannelPreparationSnapshot[];
  failure: PlaybackPreparationFailure | null;
};

export type PlaybackSnapshot = {
  currentTime: number;
  musicalPosition: MusicalPosition;
  duration: number;
  isPlaying: boolean;
  /**
   * True only when the currently enabled (required) mix is usable. Kept as a
   * compatibility signal for recording consumers; new presentation should use
   * the explicit preparation state below.
   */
  hasLoadedChannels: boolean;
  preparation: PlaybackPreparationSnapshot;
};

export type PlaybackStateListener = (
  snapshot: PlaybackSnapshot,
) => void;


export type RecordedTakeAuditionOptions = {
  capture: RecordedAudioCapture;
  projectStartSeconds: number;
  /** Signed source-to-project correction, using the same semantics as saved tracks. */
  alignmentOffsetSeconds?: number;
  /** Encoded media before the take's declared musical origin. */
  mediaLeadInSeconds?: number;
  onEnded?: () => void;
};

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
 * Authoritative phase of a synchronized recording playback schedule.
 * Values are derived from the playback engine's audio clock; presentation
 * clients must not advance them with their own timers.
 */
export type SynchronizedRecordingPlaybackSnapshot = {
  phase: "count-in" | "recording";
  countIn: {
    bars: number;
    totalBeats: number;
    currentBeat: number;
    durationSeconds: number;
  };
  elapsedRecordingSeconds: number;
};

/**
 * Presentation-independent playback contract used by both GrooveShare clients.
 *
 * The Web Audio implementation delegates project timeline state to the shared
 * Transport abstraction while this contract remains the UI-facing playback seam.
 */
export interface PlaybackEngine {
  loadMix(channels: PlaybackChannel[]): void;
  /** Retry failed preparation for channels that currently block playback. */
  retryPreparation?(): void;
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
  /** Read the active recording schedule against the authoritative audio clock. */
  getSynchronizedRecordingPlaybackSnapshot?(): SynchronizedRecordingPlaybackSnapshot | null;
  /**
   * Audition one temporary recorded take on the same authoritative audio clock
   * and source-alignment path used by saved project tracks. Web Audio engines
   * provide this so review timing cannot differ from post-Keep playback.
   */
  auditionRecordedTake?(options: RecordedTakeAuditionOptions): Promise<void>;
  stopRecordedTakeAudition?(): void;
  /** Page-local temporary-take gain (0–1); never changes project channel volume. */
  setRecordedTakeAuditionVolume?(volume: number): void;
  markRecordingStart?(): RecordingStartMarker;
  markRecordingStop?(start: RecordingStartMarker): RecordingTimelineResult;
  destroy?(): void;
}
