import type { Track } from "../domain/types.js";
import type {
  Transport,
  TransportPlaybackState,
  TransportTimelineMarker,
} from "./transport.js";

/**
 * Exact transport observation captured when recording begins.
 *
 * `audioContextTimeSeconds` is the authoritative Web Audio clock value. The
 * project position is derived from the same clock read, so the two values form
 * one timing relationship rather than two independently sampled clocks.
 */
export type RecordingStartMarker = {
  kind: "recording-start";
  projectPositionSeconds: number;
  audioContextTimeSeconds: number;
  playbackState: TransportPlaybackState;
};

/** Exact transport observation captured when recording stops. */
export type RecordingStopMarker = {
  kind: "recording-stop";
  projectPositionSeconds: number;
  audioContextTimeSeconds: number;
  playbackState: TransportPlaybackState;
};

/**
 * Timing metadata that a future recorded track can persist alongside its audio.
 *
 * `timelineOffsetSeconds` is the project position where the recorded file
 * belongs. Existing uploaded stems omit that value and continue to mean
 * project time zero.
 */
export type RecordingPositionMetadata = {
  startProjectPositionSeconds: number;
  stopProjectPositionSeconds: number;
  startAudioContextTimeSeconds: number;
  stopAudioContextTimeSeconds: number;
  durationSeconds: number;
  timelineOffsetSeconds: number;
};

export type RecordingTimelineResult = {
  start: RecordingStartMarker;
  stop: RecordingStopMarker;
  metadata: RecordingPositionMetadata;
};

export interface RecordingTimeline {
  markStart(): RecordingStartMarker;
  markStop(start: RecordingStartMarker): RecordingTimelineResult;
}

export const DEFAULT_TRACK_TIMELINE_OFFSET_SECONDS = 0;

function normalizeTrackOffset(offsetSeconds: number | undefined): number {
  if (!Number.isFinite(offsetSeconds) || (offsetSeconds ?? 0) < 0) {
    return DEFAULT_TRACK_TIMELINE_OFFSET_SECONDS;
  }

  return offsetSeconds ?? DEFAULT_TRACK_TIMELINE_OFFSET_SECONDS;
}

/**
 * Legacy/uploaded stems currently begin at project time zero. Future recorded
 * tracks can persist `timelineOffsetSeconds` without changing that default.
 */
export function getTrackTimelineOffsetSeconds(
  track: Pick<Track, "timelineOffsetSeconds">,
): number {
  return normalizeTrackOffset(track.timelineOffsetSeconds);
}

function toStartMarker(
  marker: TransportTimelineMarker,
): RecordingStartMarker {
  return {
    kind: "recording-start",
    projectPositionSeconds: marker.projectPositionSeconds,
    audioContextTimeSeconds: marker.clockTimeSeconds,
    playbackState: marker.playbackState,
  };
}

function toStopMarker(
  marker: TransportTimelineMarker,
): RecordingStopMarker {
  return {
    kind: "recording-stop",
    projectPositionSeconds: marker.projectPositionSeconds,
    audioContextTimeSeconds: marker.clockTimeSeconds,
    playbackState: marker.playbackState,
  };
}

/**
 * Presentation-neutral recording timeline primitives backed by one Transport.
 * Microphone capture is intentionally outside this object; it only records the
 * timing relationship that capture will use in the next milestone.
 */
export function createRecordingTimeline(
  transport: Transport,
): RecordingTimeline {
  return {
    markStart() {
      return toStartMarker(transport.markTimelinePosition());
    },
    markStop(start) {
      const stop = toStopMarker(transport.markTimelinePosition());
      const durationSeconds = Math.max(
        0,
        stop.audioContextTimeSeconds - start.audioContextTimeSeconds,
      );

      return {
        start,
        stop,
        metadata: {
          startProjectPositionSeconds: start.projectPositionSeconds,
          stopProjectPositionSeconds: stop.projectPositionSeconds,
          startAudioContextTimeSeconds: start.audioContextTimeSeconds,
          stopAudioContextTimeSeconds: stop.audioContextTimeSeconds,
          durationSeconds,
          timelineOffsetSeconds: start.projectPositionSeconds,
        },
      };
    },
  };
}
