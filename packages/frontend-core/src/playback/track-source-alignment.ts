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

/**
 * Resolve how a signed source alignment correction maps one audio file onto
 * the authoritative project timeline.
 *
 * Positive alignment advances captured content by skipping source audio at the
 * declared musical start. Negative alignment delays the source while leaving
 * the declared musical start unchanged.
 */
export function getTrackSourceAlignmentWindow({
  trackStartSeconds,
  sourceDurationSeconds,
  alignmentOffsetSeconds,
}: {
  trackStartSeconds: number;
  sourceDurationSeconds: number;
  alignmentOffsetSeconds?: number;
}): TrackSourceAlignmentWindow {
  const alignmentOffset = normalizeTrackAlignmentOffsetSeconds(
    alignmentOffsetSeconds,
  );
  const duration = Number.isFinite(sourceDurationSeconds)
    ? Math.max(0, sourceDurationSeconds)
    : 0;
  const positiveSourceOffset = Math.max(0, alignmentOffset);
  const delayedProjectStart = trackStartSeconds + Math.max(0, -alignmentOffset);
  const playableDuration = Math.max(0, duration - positiveSourceOffset);

  return {
    projectStartSeconds: delayedProjectStart,
    projectEndSeconds: delayedProjectStart + playableDuration,
    sourceOffsetAtProjectStartSeconds: positiveSourceOffset,
  };
}

export function getAlignedSourceOffsetSeconds({
  projectTimeSeconds,
  trackStartSeconds,
  alignmentOffsetSeconds,
}: {
  projectTimeSeconds: number;
  trackStartSeconds: number;
  alignmentOffsetSeconds?: number;
}): number {
  const alignmentOffset = normalizeTrackAlignmentOffsetSeconds(
    alignmentOffsetSeconds,
  );

  return Math.max(
    0,
    projectTimeSeconds - trackStartSeconds + alignmentOffset,
  );
}
