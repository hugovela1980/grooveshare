import { spawn } from "node:child_process";
import {
    mkdir,
    rename,
    rm,
    stat,
} from "node:fs/promises";
import path from "node:path";
import {
    CURRENT_PLAYBACK_DERIVATIVE_PROFILE,
    CURRENT_PLAYBACK_DERIVATIVE_VERSION,
} from "./playback-derivative.js";
import type { UpdateTrackResult } from "./stores/tracks-store.js";
import type { PlaybackDerivative, Track } from "./types.js";

const MAX_PROCESS_OUTPUT_CHARACTERS = 64 * 1024;
const DERIVATIVE_DIRECTORY_NAME = "playback-derivatives";

export type MediaProcessResult = {
    stdout: string;
    stderr: string;
};

export type MediaProcessRunner = (
    executable: string,
    arguments_: string[],
) => Promise<MediaProcessResult>;

export type PlaybackDerivativeFileSystem = {
    mkdir: typeof mkdir;
    rename: typeof rename;
    rm: typeof rm;
    stat: typeof stat;
};

export type PlaybackDerivativeLifecycleStore = {
    updatePlaybackDerivative: (
        projectId: string,
        trackId: string,
        derivative: PlaybackDerivative,
    ) => Promise<UpdateTrackResult>;
};

export type PlaybackDerivativeGenerationResult =
    | { ok: true; track: Track }
    | { ok: false; track: Track; error: Error };

export type PlaybackDerivativeGenerator = {
    generate: (track: Track) => Promise<PlaybackDerivativeGenerationResult>;
};

type GeneratorLogger = Pick<Console, "error">;

type ProbeOutput = {
    streams?: Array<{
        codec_name?: unknown;
        sample_rate?: unknown;
        duration?: unknown;
    }>;
    format?: {
        duration?: unknown;
    };
};

function appendBounded(current: string, chunk: unknown): string {
    if (current.length >= MAX_PROCESS_OUTPUT_CHARACTERS) {
        return current;
    }

    return (
        current + String(chunk)
    ).slice(0, MAX_PROCESS_OUTPUT_CHARACTERS);
}

export function runMediaProcess(
    executable: string,
    arguments_: string[],
): Promise<MediaProcessResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, arguments_, {
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let settled = false;

        child.stdout.on("data", (chunk) => {
            stdout = appendBounded(stdout, chunk);
        });
        child.stderr.on("data", (chunk) => {
            stderr = appendBounded(stderr, chunk);
        });
        child.once("error", (error) => {
            if (!settled) {
                settled = true;
                reject(error);
            }
        });
        child.once("close", (exitCode, signal) => {
            if (settled) {
                return;
            }

            settled = true;
            if (exitCode === 0) {
                resolve({ stdout, stderr });
                return;
            }

            const exitDescription = signal
                ? `signal ${signal}`
                : `exit code ${exitCode ?? "unknown"}`;
            const detail = stderr.trim()
                ? `: ${stderr.trim()}`
                : "";
            reject(new Error(
                `${path.basename(executable)} failed with ${exitDescription}${detail}`,
            ));
        });
    });
}

function getFinalDerivativePath(track: Track): string {
    return path.join(
        path.dirname(track.filePath),
        DERIVATIVE_DIRECTORY_NAME,
        `${track.id}-${CURRENT_PLAYBACK_DERIVATIVE_VERSION}` +
            CURRENT_PLAYBACK_DERIVATIVE_PROFILE.fileExtension,
    );
}

function getFfmpegArguments(
    originalPath: string,
    temporaryPath: string,
): string[] {
    const profile = CURRENT_PLAYBACK_DERIVATIVE_PROFILE;

    return [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        originalPath,
        "-map",
        "0:a:0",
        "-c:a",
        profile.codec,
        "-b:a",
        profile.targetBitrate,
        "-vbr",
        profile.variableBitrate,
        "-application",
        profile.application,
        "-ar",
        String(profile.sampleRate),
        "-f",
        profile.container,
        temporaryPath,
    ];
}

function getFfprobeArguments(derivativePath: string): string[] {
    return [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_name,sample_rate,duration:format=duration",
        "-of",
        "json",
        derivativePath,
    ];
}

function parsePositiveDuration(...values: unknown[]): number | null {
    for (const value of values) {
        const duration = typeof value === "number"
            ? value
            : typeof value === "string"
                ? Number(value)
                : Number.NaN;

        if (Number.isFinite(duration) && duration > 0) {
            return duration;
        }
    }

    return null;
}

function validateProbeOutput(stdout: string): void {
    let probeOutput: ProbeOutput;

    try {
        probeOutput = JSON.parse(stdout) as ProbeOutput;
    } catch {
        throw new Error("FFprobe returned malformed playback derivative metadata.");
    }

    const stream = probeOutput.streams?.[0];
    if (!stream) {
        throw new Error("Playback derivative does not contain an audio stream.");
    }
    if (stream.codec_name !== CURRENT_PLAYBACK_DERIVATIVE_PROFILE.probeCodecName) {
        throw new Error("Playback derivative audio codec is not Opus.");
    }
    if (Number(stream.sample_rate) !== CURRENT_PLAYBACK_DERIVATIVE_PROFILE.sampleRate) {
        throw new Error("Playback derivative sample rate is not 48 kHz.");
    }
    if (
        parsePositiveDuration(
            stream.duration,
            probeOutput.format?.duration,
        ) === null
    ) {
        throw new Error("Playback derivative duration is not valid.");
    }
}

function asError(error: unknown): Error {
    return error instanceof Error
        ? error
        : new Error(String(error));
}

export function createPlaybackDerivativeGenerator({
    tracksStore,
    ffmpegPath = "ffmpeg",
    ffprobePath = "ffprobe",
    processRunner = runMediaProcess,
    fileSystem = { mkdir, rename, rm, stat },
    logger = console,
}: {
    tracksStore: PlaybackDerivativeLifecycleStore;
    ffmpegPath?: string;
    ffprobePath?: string;
    processRunner?: MediaProcessRunner;
    fileSystem?: PlaybackDerivativeFileSystem;
    logger?: GeneratorLogger;
}): PlaybackDerivativeGenerator {
    return {
        async generate(track) {
            const finalPath = getFinalDerivativePath(track);
            const temporaryPath = path.join(
                path.dirname(finalPath),
                `.${track.id}-${crypto.randomUUID()}.tmp` +
                    CURRENT_PLAYBACK_DERIVATIVE_PROFILE.fileExtension,
            );
            const obsoletePath = track.playbackDerivative.status === "ready"
                ? track.playbackDerivative.filePath
                : null;
            let currentTrack = track;
            let processingPersisted = false;
            let finalized = false;

            try {
                const processingResult = await tracksStore.updatePlaybackDerivative(
                    track.projectId,
                    track.id,
                    {
                        status: "processing",
                        version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
                        filePath: null,
                        mimeType: null,
                        fileSize: null,
                    },
                );
                if (!processingResult.ok) {
                    throw new Error(
                        `Could not persist playback derivative processing state: ${processingResult.reason}.`,
                    );
                }
                processingPersisted = true;
                currentTrack = processingResult.updatedTrack;

                await fileSystem.mkdir(path.dirname(finalPath), { recursive: true });
                await processRunner(
                    ffmpegPath,
                    getFfmpegArguments(track.filePath, temporaryPath),
                );

                const temporaryStats = await fileSystem.stat(temporaryPath);
                if (!temporaryStats.isFile() || temporaryStats.size <= 0) {
                    throw new Error("Playback derivative output is missing or empty.");
                }

                const probeResult = await processRunner(
                    ffprobePath,
                    getFfprobeArguments(temporaryPath),
                );
                validateProbeOutput(probeResult.stdout);

                await fileSystem.rename(temporaryPath, finalPath);
                finalized = true;

                const finalStats = await fileSystem.stat(finalPath);
                if (!finalStats.isFile() || finalStats.size <= 0) {
                    throw new Error("Finalized playback derivative is missing or empty.");
                }

                if (obsoletePath && obsoletePath !== finalPath) {
                    await fileSystem.rm(obsoletePath, { force: true });
                }

                const readyResult = await tracksStore.updatePlaybackDerivative(
                    track.projectId,
                    track.id,
                    {
                        status: "ready",
                        version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
                        filePath: finalPath,
                        mimeType: CURRENT_PLAYBACK_DERIVATIVE_PROFILE.mimeType,
                        fileSize: finalStats.size,
                    },
                );
                if (!readyResult.ok) {
                    throw new Error(
                        `Could not persist playback derivative ready state: ${readyResult.reason}.`,
                    );
                }

                return { ok: true, track: readyResult.updatedTrack };
            } catch (generationError) {
                const error = asError(generationError);
                const cleanupPaths = new Set([temporaryPath]);
                if (processingPersisted && obsoletePath) {
                    cleanupPaths.add(obsoletePath);
                }
                if (finalized) {
                    cleanupPaths.add(finalPath);
                }

                await Promise.all(
                    [...cleanupPaths].map(async (filePath) => {
                        try {
                            await fileSystem.rm(filePath, { force: true });
                        } catch (cleanupError) {
                            logger.error(
                                "Could not clean a failed playback derivative artifact.",
                                cleanupError,
                            );
                        }
                    }),
                );

                try {
                    const failedResult = await tracksStore.updatePlaybackDerivative(
                        track.projectId,
                        track.id,
                        {
                            status: "failed",
                            version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
                            filePath: null,
                            mimeType: null,
                            fileSize: null,
                        },
                    );
                    if (failedResult.ok) {
                        currentTrack = failedResult.updatedTrack;
                        if (!processingPersisted && obsoletePath) {
                            try {
                                await fileSystem.rm(obsoletePath, { force: true });
                            } catch (cleanupError) {
                                logger.error(
                                    "Could not clean an obsolete playback derivative artifact.",
                                    cleanupError,
                                );
                            }
                        }
                    } else {
                        logger.error(
                            `Could not persist playback derivative failure state: ${failedResult.reason}.`,
                        );
                    }
                } catch (persistenceError) {
                    logger.error(
                        "Could not persist playback derivative failure state.",
                        persistenceError,
                    );
                }

                logger.error("Playback derivative generation failed.", error);
                return { ok: false, track: currentTrack, error };
            }
        },
    };
}
