import type { PlaybackDerivative } from "./types.js";

export const CURRENT_PLAYBACK_DERIVATIVE_VERSION = "opus-playback-v1";

export function createPendingPlaybackDerivative(): PlaybackDerivative {
    return {
        status: "pending",
        version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
        filePath: null,
        mimeType: null,
        fileSize: null,
    };
}

export function validatePlaybackDerivative(
    derivative: PlaybackDerivative,
): PlaybackDerivative {
    if (
        !["pending", "processing", "ready", "failed"].includes(
            derivative.status,
        ) ||
        typeof derivative.version !== "string" ||
        derivative.version.trim().length === 0
    ) {
        throw new Error("Playback derivative status and version must be valid.");
    }

    if (derivative.status === "ready") {
        if (
            derivative.filePath.trim().length === 0 ||
            derivative.mimeType.trim().length === 0 ||
            !Number.isSafeInteger(derivative.fileSize) ||
            derivative.fileSize < 0
        ) {
            throw new Error(
                "A ready playback derivative requires valid artifact metadata.",
            );
        }
    } else if (
        derivative.filePath !== null ||
        derivative.mimeType !== null ||
        derivative.fileSize !== null
    ) {
        throw new Error(
            "A non-ready playback derivative cannot advertise artifact metadata.",
        );
    }

    return { ...derivative };
}

export function normalizePlaybackDerivative(
    derivative: unknown,
): PlaybackDerivative {
    if (!derivative) {
        return createPendingPlaybackDerivative();
    }

    try {
        return validatePlaybackDerivative(derivative as PlaybackDerivative);
    } catch {
        return createPendingPlaybackDerivative();
    }
}
