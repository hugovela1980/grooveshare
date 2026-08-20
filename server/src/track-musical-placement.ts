import type {
    MusicalTimeline,
    TrackMusicalPlacement,
} from "./types.js";

export const DEFAULT_TRACK_MUSICAL_PLACEMENT: TrackMusicalPlacement = {
    start: {
        bar: 1,
        beat: 1,
    },
    spanBeats: null,
};

export function isValidTrackMusicalPlacement(
    timeline: MusicalTimeline,
    placement: TrackMusicalPlacement,
): boolean {
    return (
        Number.isInteger(placement.start.bar) &&
        placement.start.bar >= 1 &&
        Number.isFinite(placement.start.beat) &&
        placement.start.beat >= 1 &&
        placement.start.beat < timeline.timeSignature.numerator + 1 &&
        (placement.spanBeats === null ||
            (Number.isFinite(placement.spanBeats) &&
                placement.spanBeats > 0))
    );
}

export function normalizeTrackMusicalPlacement(
    timeline: MusicalTimeline,
    placement: TrackMusicalPlacement | null | undefined,
): TrackMusicalPlacement {
    if (!placement || !isValidTrackMusicalPlacement(timeline, placement)) {
        return {
            start: { ...DEFAULT_TRACK_MUSICAL_PLACEMENT.start },
            spanBeats: null,
        };
    }

    return {
        start: { ...placement.start },
        spanBeats: placement.spanBeats,
    };
}
