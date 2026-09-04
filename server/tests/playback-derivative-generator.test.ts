import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  createPlaybackDerivativeGenerator,
  type MediaProcessRunner,
  type PlaybackDerivativeFileSystem,
} from "../src/playback-derivative-generator.js";
import {
  CURRENT_PLAYBACK_DERIVATIVE_VERSION,
  createPendingPlaybackDerivative,
} from "../src/playback-derivative.js";
import type { PlaybackDerivative, Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

const TEST_ROOT = path.join(
  process.cwd(),
  "tests/.tmp/playback-derivative-generator",
);

function createTrack(
  originalPath: string,
  derivative: PlaybackDerivative = createPendingPlaybackDerivative(),
): Track {
  return {
    id: "track-1",
    projectId: "project-1",
    name: "Guitar",
    originalFilename: "guitar.wav",
    filePath: originalPath,
    mimeType: "audio/wav",
    fileSize: 14,
    playbackDerivative: derivative,
    uploadedByUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function createLifecycleStore(
  initialTrack: Track,
  options: { failStatuses?: PlaybackDerivative["status"][] } = {},
) {
  let track = initialTrack;
  const statuses: PlaybackDerivative["status"][] = [];
  const failStatuses = new Set(options.failStatuses ?? []);

  return {
    statuses,
    get track() {
      return track;
    },
    async updatePlaybackDerivative(
      projectId: string,
      trackId: string,
      derivative: PlaybackDerivative,
    ) {
      statuses.push(derivative.status);
      if (failStatuses.delete(derivative.status)) {
        throw new Error(`Could not persist ${derivative.status}.`);
      }
      if (projectId !== track.projectId || trackId !== track.id) {
        return { ok: false as const, reason: "track-not-found" as const };
      }

      track = { ...track, playbackDerivative: derivative };
      return { ok: true as const, updatedTrack: track };
    },
  };
}

function validProbeOutput(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    streams: [{
      codec_name: "opus",
      sample_rate: "48000",
      duration: "1.0065",
      ...overrides,
    }],
    format: { duration: "1.0065" },
  });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

tester.describe("playback derivative generator", () => {
  tester.beforeEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
    await mkdir(TEST_ROOT, { recursive: true });
  });

  tester.it("generates, validates, finalizes, and persists a ready derivative", async () => {
    const originalPath = path.join(TEST_ROOT, "original.wav");
    const originalBytes = Buffer.from("original audio");
    await writeFile(originalPath, originalBytes);
    const track = createTrack(originalPath);
    const store = createLifecycleStore(track);
    const events: string[] = [];
    const processCalls: Array<{ executable: string; arguments_: string[] }> = [];
    const processRunner: MediaProcessRunner = async (executable, arguments_) => {
      processCalls.push({ executable, arguments_ });
      if (executable === "custom-ffmpeg") {
        events.push("ffmpeg");
        await writeFile(arguments_.at(-1) ?? "", "valid opus bytes");
        return { stdout: "", stderr: "" };
      }

      events.push("ffprobe");
      return { stdout: validProbeOutput(), stderr: "" };
    };
    const fileSystem: PlaybackDerivativeFileSystem = {
      mkdir,
      rm,
      stat,
      async rename(from, to) {
        events.push("rename");
        await rename(from, to);
      },
    };
    const lifecycleStore = {
      async updatePlaybackDerivative(
        projectId: string,
        trackId: string,
        derivative: PlaybackDerivative,
      ) {
        events.push(`state:${derivative.status}`);
        return store.updatePlaybackDerivative(projectId, trackId, derivative);
      },
    };
    const generator = createPlaybackDerivativeGenerator({
      tracksStore: lifecycleStore,
      ffmpegPath: "custom-ffmpeg",
      ffprobePath: "custom-ffprobe",
      processRunner,
      fileSystem,
      logger: { error() {} },
    });

    const result = await generator.generate(track);

    tester.expect(result.ok).toBe(true);
    tester.expect(events).toEqual([
      "state:processing",
      "ffmpeg",
      "ffprobe",
      "rename",
      "state:ready",
    ]);
    tester.expect(processCalls.map((call) => call.executable)).toEqual([
      "custom-ffmpeg",
      "custom-ffprobe",
    ]);
    const ffmpegArguments = processCalls[0]?.arguments_ ?? [];
    const temporaryPath = ffmpegArguments.at(-1) ?? "";
    tester.expect(ffmpegArguments).toEqual([
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
      "libopus",
      "-b:a",
      "256k",
      "-vbr",
      "on",
      "-application",
      "audio",
      "-ar",
      "48000",
      "-f",
      "ogg",
      temporaryPath,
    ]);
    const finalPath = path.join(
      TEST_ROOT,
      "playback-derivatives",
      `track-1-${CURRENT_PLAYBACK_DERIVATIVE_VERSION}.opus`,
    );
    tester.expect(store.track.playbackDerivative).toEqual({
      status: "ready",
      version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
      filePath: finalPath,
      mimeType: "audio/ogg",
      fileSize: 16,
    });
    tester.expect((await readFile(finalPath)).toString()).toBe("valid opus bytes");
    tester.expect(await readFile(originalPath)).toEqual(originalBytes);
  });

  tester.it("marks failure, removes partial output, and preserves the original", async () => {
    const originalPath = path.join(TEST_ROOT, "original.wav");
    const originalBytes = Buffer.from("original audio");
    await writeFile(originalPath, originalBytes);
    const track = createTrack(originalPath);
    const store = createLifecycleStore(track);
    const processRunner: MediaProcessRunner = async (_executable, arguments_) => {
      await writeFile(arguments_.at(-1) ?? "", "partial output");
      throw new Error("FFmpeg exited 1 for malformed source media.");
    };
    const generator = createPlaybackDerivativeGenerator({
      tracksStore: store,
      processRunner,
      logger: { error() {} },
    });

    const result = await generator.generate(track);

    tester.expect(result.ok).toBe(false);
    tester.expect(store.statuses).toEqual(["processing", "failed"]);
    tester.expect(store.track.playbackDerivative.status).toBe("failed");
    tester.expect(await readFile(originalPath)).toEqual(originalBytes);
    const derivativeDirectory = path.join(TEST_ROOT, "playback-derivatives");
    tester.expect(await readdir(derivativeDirectory)).toEqual([]);
  });

  tester.it("marks failure when the FFmpeg executable is unavailable", async () => {
    const originalPath = path.join(TEST_ROOT, "original.wav");
    await writeFile(originalPath, "original audio");
    const track = createTrack(originalPath);
    const store = createLifecycleStore(track);
    const generator = createPlaybackDerivativeGenerator({
      tracksStore: store,
      processRunner: async () => {
        throw new Error("spawn ffmpeg ENOENT");
      },
      logger: { error() {} },
    });

    const result = await generator.generate(track);

    tester.expect(result.ok).toBe(false);
    tester.expect(store.statuses).toEqual(["processing", "failed"]);
    tester.expect(await readFile(originalPath, "utf-8")).toBe("original audio");
  });

  tester.it("rejects missing, empty, and invalid generated artifacts", async () => {
    const scenarios = [
      { name: "missing-output" },
      { name: "empty-output" },
      { name: "ffprobe-unavailable" },
      { name: "ffprobe-nonzero" },
      { name: "no-audio", probe: JSON.stringify({ streams: [] }) },
      { name: "wrong-codec", probe: validProbeOutput({ codec_name: "aac" }) },
      { name: "wrong-rate", probe: validProbeOutput({ sample_rate: "44100" }) },
      {
        name: "invalid-duration",
        probe: JSON.stringify({
          streams: [{ codec_name: "opus", sample_rate: "48000" }],
          format: { duration: "0" },
        }),
      },
    ];

    for (const scenario of scenarios) {
      const scenarioRoot = path.join(TEST_ROOT, scenario.name);
      await mkdir(scenarioRoot, { recursive: true });
      const originalPath = path.join(scenarioRoot, "original.wav");
      await writeFile(originalPath, "original audio");
      const track = createTrack(originalPath);
      const store = createLifecycleStore(track);
      let invocation = 0;
      const processRunner: MediaProcessRunner = async (_executable, arguments_) => {
        invocation += 1;
        if (invocation === 1) {
          if (scenario.name === "missing-output") {
            return { stdout: "", stderr: "" };
          }
          await writeFile(
            arguments_.at(-1) ?? "",
            scenario.name === "empty-output" ? "" : "generated bytes",
          );
          return { stdout: "", stderr: "" };
        }
        if (
          scenario.name === "ffprobe-unavailable" ||
          scenario.name === "ffprobe-nonzero"
        ) {
          throw new Error(`${scenario.name} failure`);
        }
        return { stdout: scenario.probe ?? validProbeOutput(), stderr: "" };
      };
      const generator = createPlaybackDerivativeGenerator({
        tracksStore: store,
        processRunner,
        logger: { error() {} },
      });

      const result = await generator.generate(track);

      tester.expect(result.ok).toBe(false);
      tester.expect(store.track.playbackDerivative.status).toBe("failed");
      tester.expect(await readFile(originalPath, "utf-8")).toBe("original audio");
    }
  });

  tester.it("fails safely when finalization or lifecycle persistence fails", async () => {
    for (const failure of ["rename", "processing", "ready"] as const) {
      const scenarioRoot = path.join(TEST_ROOT, failure);
      await mkdir(scenarioRoot, { recursive: true });
      const originalPath = path.join(scenarioRoot, "original.wav");
      await writeFile(originalPath, "original audio");
      const track = createTrack(originalPath);
      const store = createLifecycleStore(track, {
        failStatuses: failure === "rename" ? [] : [failure],
      });
      const processRunner: MediaProcessRunner = async (executable, arguments_) => {
        if (executable === "ffmpeg") {
          await writeFile(arguments_.at(-1) ?? "", "generated bytes");
          return { stdout: "", stderr: "" };
        }
        return { stdout: validProbeOutput(), stderr: "" };
      };
      const fileSystem: PlaybackDerivativeFileSystem = {
        mkdir,
        rm,
        stat,
        async rename(from, to) {
          if (failure === "rename") {
            throw new Error("Finalization failed.");
          }
          await rename(from, to);
        },
      };
      const generator = createPlaybackDerivativeGenerator({
        tracksStore: store,
        processRunner,
        fileSystem,
        logger: { error() {} },
      });

      const result = await generator.generate(track);

      tester.expect(result.ok).toBe(false);
      tester.expect(store.statuses.at(-1)).toBe("failed");
      tester.expect(await readFile(originalPath, "utf-8")).toBe("original audio");
      const finalPath = path.join(
        scenarioRoot,
        "playback-derivatives",
        `track-1-${CURRENT_PLAYBACK_DERIVATIVE_VERSION}.opus`,
      );
      tester.expect(await exists(finalPath)).toBe(false);
    }
  });

  tester.it("regenerates by replacing the derivative and cleaning the obsolete path", async () => {
    const originalPath = path.join(TEST_ROOT, "original.wav");
    const obsoletePath = path.join(TEST_ROOT, "old-profile.opus");
    await writeFile(originalPath, "original audio");
    await writeFile(obsoletePath, "old derivative");
    const track = createTrack(originalPath, {
      status: "ready",
      version: "older-profile",
      filePath: obsoletePath,
      mimeType: "audio/ogg",
      fileSize: 14,
    });
    const store = createLifecycleStore(track);
    const processRunner: MediaProcessRunner = async (executable, arguments_) => {
      if (executable === "ffmpeg") {
        await writeFile(arguments_.at(-1) ?? "", "replacement derivative");
        return { stdout: "", stderr: "" };
      }
      return { stdout: validProbeOutput(), stderr: "" };
    };
    const generator = createPlaybackDerivativeGenerator({
      tracksStore: store,
      processRunner,
      logger: { error() {} },
    });

    const result = await generator.generate(track);

    tester.expect(result.ok).toBe(true);
    tester.expect(store.statuses).toEqual(["processing", "ready"]);
    tester.expect(await exists(obsoletePath)).toBe(false);
    tester.expect(await readFile(originalPath, "utf-8")).toBe("original audio");
    if (!result.ok || result.track.playbackDerivative.status !== "ready") {
      throw new Error("Expected regeneration to produce a ready derivative.");
    }
    tester.expect(
      await readFile(result.track.playbackDerivative.filePath, "utf-8"),
    ).toBe("replacement derivative");

    const secondResult = await generator.generate(result.track);
    tester.expect(secondResult.ok).toBe(true);
    tester.expect(store.statuses).toEqual([
      "processing",
      "ready",
      "processing",
      "ready",
    ]);
  });
});
