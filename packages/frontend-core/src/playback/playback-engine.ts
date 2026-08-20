export type PlaybackChannel = {
  channelNumber: number;
  trackId: string;
  audioUrl: string;
  volume: number;
  enabled: boolean;
};

export type PlaybackSnapshot = {
  currentTime: number;
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
  setLoopEnabled(enabled: boolean): void;
  setChannelVolume(channelNumber: number, volume: number): boolean;
  setChannelEnabled(channelNumber: number, enabled: boolean): boolean;
  getSnapshot(): PlaybackSnapshot;
  subscribe(listener: PlaybackStateListener): () => void;
  destroy?(): void;
}
