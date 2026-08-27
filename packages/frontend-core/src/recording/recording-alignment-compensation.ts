import type { StorageProvider } from "../platform/storage-provider.js";

export const RECORDING_ALIGNMENT_COMPENSATION_STORAGE_KEY =
  "grooveshare.recording-alignment-compensation-ms.v1";

export const MIN_RECORDING_ALIGNMENT_COMPENSATION_MILLISECONDS = -2000;
export const MAX_RECORDING_ALIGNMENT_COMPENSATION_MILLISECONDS = 2000;

/**
 * Negative compensation advances a recorded source relative to its declared
 * musical start. Positive compensation delays it. The value is deliberately
 * stored as whole milliseconds so the UI can offer predictable 1/10/100 ms
 * nudges without exposing floating-point seconds to musicians.
 */
export function normalizeRecordingAlignmentCompensationMilliseconds(
  value: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    MIN_RECORDING_ALIGNMENT_COMPENSATION_MILLISECONDS,
    Math.min(
      MAX_RECORDING_ALIGNMENT_COMPENSATION_MILLISECONDS,
      Math.round(value),
    ),
  );
}

export function recordingAlignmentCompensationMillisecondsToSeconds(
  value: number,
): number {
  return normalizeRecordingAlignmentCompensationMilliseconds(value) / 1000;
}

export function loadRecordingAlignmentCompensationMilliseconds(
  storage: StorageProvider | null,
): number {
  if (!storage) {
    return 0;
  }

  try {
    const storedValue = storage.getItem(
      RECORDING_ALIGNMENT_COMPENSATION_STORAGE_KEY,
    );

    if (storedValue === null) {
      return 0;
    }

    return normalizeRecordingAlignmentCompensationMilliseconds(
      Number(storedValue),
    );
  } catch {
    return 0;
  }
}

export function saveRecordingAlignmentCompensationMilliseconds(
  value: number,
  storage: StorageProvider | null,
): number {
  const normalizedValue =
    normalizeRecordingAlignmentCompensationMilliseconds(value);

  if (!storage) {
    return normalizedValue;
  }

  try {
    storage.setItem(
      RECORDING_ALIGNMENT_COMPENSATION_STORAGE_KEY,
      String(normalizedValue),
    );
  } catch {
    // Local persistence is a convenience only. Recording must keep working if
    // storage is unavailable, blocked, or full.
  }

  return normalizedValue;
}
