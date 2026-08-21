import type {
  MusicalPosition,
  MusicalTimeline,
  Project,
  TimeSignature,
} from "../domain/types.js";

export const DEFAULT_PROJECT_BPM = 120;
export const DEFAULT_TIME_SIGNATURE: TimeSignature = {
  numerator: 4,
  denominator: 4,
};
export const DEFAULT_PROJECT_MUSICAL_TIMELINE: MusicalTimeline = {
  bpm: DEFAULT_PROJECT_BPM,
  timeSignature: DEFAULT_TIME_SIGNATURE,
};

export const PROJECT_MUSICAL_ORIGIN: MusicalPosition = {
  bar: 1,
  beat: 1,
};

export const PROJECT_MUSICAL_ORIGIN_TRANSPORT_SECONDS = 0;

const MAX_BPM = 999;
const MAX_TIME_SIGNATURE_VALUE = 32;
const VALID_TIME_SIGNATURE_DENOMINATORS = new Set([1, 2, 4, 8, 16, 32]);
const MUSICAL_BOUNDARY_EPSILON_BEATS = 1e-9;

export function isValidMusicalTimeline(
  timeline: MusicalTimeline,
): boolean {
  const { bpm, timeSignature } = timeline;

  return (
    Number.isFinite(bpm) &&
    bpm > 0 &&
    bpm <= MAX_BPM &&
    Number.isInteger(timeSignature.numerator) &&
    timeSignature.numerator >= 1 &&
    timeSignature.numerator <= MAX_TIME_SIGNATURE_VALUE &&
    Number.isInteger(timeSignature.denominator) &&
    VALID_TIME_SIGNATURE_DENOMINATORS.has(timeSignature.denominator)
  );
}

export function normalizeMusicalTimeline(
  timeline: MusicalTimeline | null | undefined,
): MusicalTimeline {
  if (!timeline || !isValidMusicalTimeline(timeline)) {
    return {
      bpm: DEFAULT_PROJECT_MUSICAL_TIMELINE.bpm,
      timeSignature: { ...DEFAULT_TIME_SIGNATURE },
    };
  }

  return {
    bpm: timeline.bpm,
    timeSignature: { ...timeline.timeSignature },
  };
}

export function getProjectMusicalTimeline(
  project: Pick<Project, "musicalTimeline">,
): MusicalTimeline {
  return normalizeMusicalTimeline(project.musicalTimeline);
}

/** Seconds occupied by one time-signature beat unit at the project tempo. */
export function getSecondsPerMusicalBeat(timeline: MusicalTimeline): number {
  const normalized = normalizeMusicalTimeline(timeline);
  const quarterNoteSeconds = 60 / normalized.bpm;
  const quarterNotesPerBeatUnit = 4 / normalized.timeSignature.denominator;

  return quarterNoteSeconds * quarterNotesPerBeatUnit;
}

export function getSecondsPerBar(timeline: MusicalTimeline): number {
  const normalized = normalizeMusicalTimeline(timeline);
  return (
    getSecondsPerMusicalBeat(normalized) *
    normalized.timeSignature.numerator
  );
}

/**
 * Convert one-based musical position to project transport time.
 * Bar 1, beat 1 is always project time 0 for Milestone 2.
 */
export function musicalPositionToTransportSeconds(
  timeline: MusicalTimeline,
  position: MusicalPosition,
): number {
  const normalized = normalizeMusicalTimeline(timeline);

  if (
    !Number.isInteger(position.bar) ||
    position.bar < 1 ||
    !Number.isFinite(position.beat) ||
    position.beat < 1 ||
    position.beat >= normalized.timeSignature.numerator + 1
  ) {
    throw new RangeError("Musical position is outside the project timeline.");
  }

  const beatsBeforePosition =
    (position.bar - 1) * normalized.timeSignature.numerator +
    (position.beat - 1);

  return beatsBeforePosition * getSecondsPerMusicalBeat(normalized);
}

/**
 * Convert non-negative project transport time to a one-based bar/beat position.
 * Fractional beats intentionally survive the conversion for future grid work.
 */
export function transportSecondsToMusicalPosition(
  timeline: MusicalTimeline,
  transportSeconds: number,
): MusicalPosition {
  if (!Number.isFinite(transportSeconds) || transportSeconds < 0) {
    throw new RangeError("Transport time must be a non-negative finite value.");
  }

  const normalized = normalizeMusicalTimeline(timeline);
  const rawTotalBeats = transportSeconds / getSecondsPerMusicalBeat(normalized);
  const nearestWholeBeat = Math.round(rawTotalBeats);
  const totalBeats =
    Math.abs(rawTotalBeats - nearestWholeBeat) <= MUSICAL_BOUNDARY_EPSILON_BEATS
      ? nearestWholeBeat
      : rawTotalBeats;
  const zeroBasedBar = Math.floor(
    totalBeats / normalized.timeSignature.numerator,
  );
  const beatWithinBar =
    totalBeats - zeroBasedBar * normalized.timeSignature.numerator;

  return {
    bar: zeroBasedBar + 1,
    beat: beatWithinBar + 1,
  };
}
