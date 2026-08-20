import type {
  MusicalPosition,
  MusicalTimeline,
  Track,
  TrackMusicalPlacement,
} from "../domain/types.js";
import {
  musicalPositionToTransportSeconds,
  transportSecondsToMusicalPosition,
  getSecondsPerMusicalBeat,
  normalizeMusicalTimeline,
} from "./musical-timeline.js";

export const DEFAULT_TRACK_MUSICAL_START_POSITION: MusicalPosition = {
  bar: 1,
  beat: 1,
};

export const DEFAULT_TRACK_MUSICAL_PLACEMENT: TrackMusicalPlacement = {
  start: DEFAULT_TRACK_MUSICAL_START_POSITION,
  spanBeats: null,
};

export function isValidTrackMusicalPlacement(
  timeline: MusicalTimeline,
  placement: TrackMusicalPlacement,
): boolean {
  const normalizedTimeline = normalizeMusicalTimeline(timeline);
  const { start, spanBeats } = placement;

  return (
    Number.isInteger(start.bar) &&
    start.bar >= 1 &&
    Number.isFinite(start.beat) &&
    start.beat >= 1 &&
    start.beat < normalizedTimeline.timeSignature.numerator + 1 &&
    (spanBeats === null ||
      (Number.isFinite(spanBeats) && spanBeats > 0))
  );
}

export function normalizeTrackMusicalPlacement(
  timeline: MusicalTimeline,
  placement: TrackMusicalPlacement | null | undefined,
): TrackMusicalPlacement {
  if (!placement || !isValidTrackMusicalPlacement(timeline, placement)) {
    return {
      start: { ...DEFAULT_TRACK_MUSICAL_START_POSITION },
      spanBeats: null,
    };
  }

  return {
    start: { ...placement.start },
    spanBeats: placement.spanBeats,
  };
}

export function getTrackMusicalPlacement(
  timeline: MusicalTimeline,
  track: Pick<Track, "musicalPlacement">,
): TrackMusicalPlacement {
  return normalizeTrackMusicalPlacement(timeline, track.musicalPlacement);
}

export function getTrackMusicalStartSeconds(
  timeline: MusicalTimeline,
  track: Pick<Track, "musicalPlacement">,
): number {
  return musicalPositionToTransportSeconds(
    timeline,
    getTrackMusicalPlacement(timeline, track).start,
  );
}

export function getTrackMusicalSpanSeconds(
  timeline: MusicalTimeline,
  track: Pick<Track, "musicalPlacement">,
): number | null {
  const spanBeats = getTrackMusicalPlacement(timeline, track).spanBeats;

  if (spanBeats === null) {
    return null;
  }

  return spanBeats * getSecondsPerMusicalBeat(timeline);
}

export function getTrackMusicalEndPosition(
  timeline: MusicalTimeline,
  track: Pick<Track, "musicalPlacement">,
): MusicalPosition | null {
  const placement = getTrackMusicalPlacement(timeline, track);

  if (placement.spanBeats === null) {
    return null;
  }

  const startSeconds = musicalPositionToTransportSeconds(
    timeline,
    placement.start,
  );
  const spanSeconds = placement.spanBeats * getSecondsPerMusicalBeat(timeline);

  return transportSecondsToMusicalPosition(timeline, startSeconds + spanSeconds);
}

export function musicalSpanBeatsToBars(
  timeline: MusicalTimeline,
  spanBeats: number,
): number {
  if (!Number.isFinite(spanBeats) || spanBeats < 0) {
    throw new RangeError("Musical span must be a non-negative finite value.");
  }

  return spanBeats / normalizeMusicalTimeline(timeline).timeSignature.numerator;
}

export function musicalSpanBarsToBeats(
  timeline: MusicalTimeline,
  spanBars: number,
): number {
  if (!Number.isFinite(spanBars) || spanBars <= 0) {
    throw new RangeError("Musical span in bars must be a positive finite value.");
  }

  return spanBars * normalizeMusicalTimeline(timeline).timeSignature.numerator;
}
