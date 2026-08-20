import type { MusicalTimeline } from "./types.js";

export const DEFAULT_PROJECT_MUSICAL_TIMELINE: MusicalTimeline = {
    bpm: 120,
    timeSignature: {
        numerator: 4,
        denominator: 4,
    },
};

const VALID_TIME_SIGNATURE_DENOMINATORS = new Set([1, 2, 4, 8, 16, 32]);

export function isValidMusicalTimeline(
    timeline: MusicalTimeline,
): boolean {
    return (
        Number.isFinite(timeline.bpm) &&
        timeline.bpm > 0 &&
        timeline.bpm <= 999 &&
        Number.isInteger(timeline.timeSignature.numerator) &&
        timeline.timeSignature.numerator >= 1 &&
        timeline.timeSignature.numerator <= 32 &&
        Number.isInteger(timeline.timeSignature.denominator) &&
        VALID_TIME_SIGNATURE_DENOMINATORS.has(
            timeline.timeSignature.denominator,
        )
    );
}

export function normalizeMusicalTimeline(
    timeline: MusicalTimeline | null | undefined,
): MusicalTimeline {
    if (!timeline || !isValidMusicalTimeline(timeline)) {
        return {
            bpm: DEFAULT_PROJECT_MUSICAL_TIMELINE.bpm,
            timeSignature: {
                ...DEFAULT_PROJECT_MUSICAL_TIMELINE.timeSignature,
            },
        };
    }

    return {
        bpm: timeline.bpm,
        timeSignature: { ...timeline.timeSignature },
    };
}
