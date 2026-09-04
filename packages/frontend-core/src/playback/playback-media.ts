export type PlaybackMediaPreparationPolicy =
  | "derivative-only"
  | "derivative-plus-original";

/**
 * Shared development/composition default used by both browser clients.
 * Future entitlement code may inject a different policy without changing the
 * playback engine or scheduler.
 */
export const DEFAULT_PLAYBACK_MEDIA_PREPARATION_POLICY:
  PlaybackMediaPreparationPolicy = "derivative-only";

export type PlaybackMediaRepresentation =
  | "playback-derivative"
  | "original";

export type PlaybackChannelMediaSources = {
  playbackDerivativeUrl: string | null;
  originalAudioUrl?: string;
};
