import type { MusicalTimeline, Track } from "../domain/types.js";
import { getTrackMusicalStartSeconds } from "../timeline/track-musical-placement.js";
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
 * `timelineOffsetSeconds` is the transport-time position captured by the
 * recording engine. Checkpoint 2 also models persisted musical placement on
 * Track; later recording work can translate this marker into that shared
 * project musical timeline without discarding the precise clock observation.
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
 * Resolve a track's project-time offset without breaking the recording
 * transport primitive introduced in Milestone 1. When a project musical
 * timeline and persisted musical placement are available, musical placement is
 * authoritative. Otherwise callers retain the legacy seconds-offset behavior.
 */
export function getTrackTimelineOffsetSeconds(
  track: Pick<Track, "timelineOffsetSeconds" | "musicalPlacement">,
  musicalTimeline?: MusicalTimeline,
): number {
  if (musicalTimeline && track.musicalPlacement) {
    return getTrackMusicalStartSeconds(musicalTimeline, track);
  }

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
