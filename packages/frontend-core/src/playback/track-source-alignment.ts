export type TrackSourceAlignmentWindow = {
  projectStartSeconds: number;
  projectEndSeconds: number;
  sourceOffsetAtProjectStartSeconds: number;
};

export function normalizeTrackAlignmentOffsetSeconds(
  alignmentOffsetSeconds: number | undefined,
): number {
  return Number.isFinite(alignmentOffsetSeconds)
    ? alignmentOffsetSeconds ?? 0
    : 0;
}

export function normalizeTrackMediaLeadInSeconds(
  mediaLeadInSeconds: number | undefined,
): number {
  return Number.isFinite(mediaLeadInSeconds)
    ? Math.max(0, mediaLeadInSeconds ?? 0)
    : 0;
}

/**
 * Resolve how encoded lead-in plus a signed source alignment correction map one
 * audio file onto the authoritative project timeline.
 *
 * mediaLeadInSeconds is structural media before the declared musical origin
 * (for example a captured count-in) and is always skipped. Positive alignment
 * advances the take farther by skipping source audio; negative alignment delays
 * the source while leaving the declared musical placement unchanged.
 */
export function getTrackSourceAlignmentWindow({
  trackStartSeconds,
  sourceDurationSeconds,
  alignmentOffsetSeconds,
  mediaLeadInSeconds,
}: {
  trackStartSeconds: number;
  sourceDurationSeconds: number;
  alignmentOffsetSeconds?: number;
  mediaLeadInSeconds?: number;
}): TrackSourceAlignmentWindow {
  const alignmentOffset = normalizeTrackAlignmentOffsetSeconds(
    alignmentOffsetSeconds,
  );
  const mediaLeadIn = normalizeTrackMediaLeadInSeconds(mediaLeadInSeconds);
  const duration = Number.isFinite(sourceDurationSeconds)
    ? Math.max(0, sourceDurationSeconds)
    : 0;
  const positiveSourceOffset = Math.max(0, alignmentOffset);
  const sourceOffsetAtProjectStartSeconds = Math.min(
    duration,
    mediaLeadIn + positiveSourceOffset,
  );
  const delayedProjectStart = trackStartSeconds + Math.max(0, -alignmentOffset);
  const playableDuration = Math.max(
    0,
    duration - sourceOffsetAtProjectStartSeconds,
  );

  return {
    projectStartSeconds: delayedProjectStart,
    projectEndSeconds: delayedProjectStart + playableDuration,
    sourceOffsetAtProjectStartSeconds,
  };
}

export function getAlignedSourceOffsetSeconds({
  projectTimeSeconds,
  trackStartSeconds,
  alignmentOffsetSeconds,
  mediaLeadInSeconds,
}: {
  projectTimeSeconds: number;
  trackStartSeconds: number;
  alignmentOffsetSeconds?: number;
  mediaLeadInSeconds?: number;
}): number {
  const alignmentOffset = normalizeTrackAlignmentOffsetSeconds(
    alignmentOffsetSeconds,
  );
  const mediaLeadIn = normalizeTrackMediaLeadInSeconds(mediaLeadInSeconds);

  return mediaLeadIn + Math.max(
    0,
    projectTimeSeconds - trackStartSeconds + alignmentOffset,
  );
}
