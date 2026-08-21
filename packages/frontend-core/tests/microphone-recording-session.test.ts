import {
  MicrophoneRecordingError,
  createMicrophoneRecordingSession,
  createRecordingTimeline,
  createTransport,
  type MicrophoneRecordingFailureHandler,
  type MicrophoneRecordingPort,
  type PlaybackEngine,
  type RecordedAudioCapture,
  type RecordedTakePlaybackPort,
  type RecordedTakeUploadInput,
  type RecordedTakeUploadPort,
  type Track,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

type RecordingPortHarness = {
  port: MicrophoneRecordingPort;
  prepareCalls: number;
  startCalls: number;
  stopCalls: number;
  releaseCalls: number;
  failActiveRecording(error: MicrophoneRecordingError): void;
};

function createRecordingPortHarness({
  prepareError = null,
  startError = null,
  stopError = null,
}: {
  prepareError?: MicrophoneRecordingError | null;
  startError?: MicrophoneRecordingError | null;
  stopError?: MicrophoneRecordingError | null;
} = {}): RecordingPortHarness {
  const harness: RecordingPortHarness = {
    prepareCalls: 0,
    startCalls: 0,
    stopCalls: 0,
    releaseCalls: 0,
    port: null as unknown as MicrophoneRecordingPort,
    failActiveRecording() {},
  };
  let failureHandler: MicrophoneRecordingFailureHandler | undefined;

  harness.port = {
    async prepare() {
      harness.prepareCalls += 1;
      if (prepareError) throw prepareError;
    },
    async start(options) {
      harness.startCalls += 1;
      failureHandler = options?.onFailure;
      if (startError) throw startError;
    },
    async stop(): Promise<RecordedAudioCapture> {
      harness.stopCalls += 1;
      if (stopError) throw stopError;
      return {
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "audio/webm",
      };
    },
    async release() {
      harness.releaseCalls += 1;
      failureHandler = undefined;
    },
  };

  harness.failActiveRecording = (error) => {
    failureHandler?.({ code: error.code, message: error.message });
  };

  return harness;
}

tester.describe("microphone recording session", () => {
  tester.it("lets Contributors arm, start, and stop through the recording port", async () => {
    const harness = createRecordingPortHarness();
    const session = createMicrophoneRecordingSession({
      role: "contributor",
      recordingPort: harness.port,
    });
    const statuses: string[] = [];
    session.subscribe((snapshot) => statuses.push(snapshot.status));

    await session.arm();
    tester.expect(session.getSnapshot().status).toBe("ready");
    tester.expect(harness.prepareCalls).toBe(1);

    await session.start();
    tester.expect(session.getSnapshot().status).toBe("recording");
    tester.expect(harness.startCalls).toBe(1);

    await session.stop();
    const stopped = session.getSnapshot();
    tester.expect(stopped.status).toBe("stopped");
    tester.expect(Array.from(stopped.capture?.bytes ?? [])).toEqual([1, 2, 3]);
    tester.expect(stopped.capture?.mimeType).toBe("audio/webm");
    tester.expect(harness.stopCalls).toBe(1);
    tester.expect(statuses).toEqual([
      "idle",
      "requesting-permission",
      "ready",
      "recording",
      "stopped",
    ]);
  });

  tester.it("allows Owners but blocks Viewers before requesting microphone permission", async () => {
    const ownerHarness = createRecordingPortHarness();
    const ownerSession = createMicrophoneRecordingSession({
      role: "owner",
      recordingPort: ownerHarness.port,
    });
    await ownerSession.arm();
    tester.expect(ownerSession.getSnapshot().status).toBe("ready");
    tester.expect(ownerHarness.prepareCalls).toBe(1);

    const viewerHarness = createRecordingPortHarness();
    const viewerSession = createMicrophoneRecordingSession({
      role: "viewer",
      recordingPort: viewerHarness.port,
    });
    await viewerSession.arm();
    tester.expect(viewerHarness.prepareCalls).toBe(0);
    tester.expect(viewerSession.getSnapshot().status).toBe("failed");
    tester.expect(viewerSession.getSnapshot().failure?.code).toBe("not-authorized");
  });

  tester.it("surfaces microphone permission and device failures as recording state", async () => {
    const permissionHarness = createRecordingPortHarness({
      prepareError: new MicrophoneRecordingError(
        "permission-denied",
        "Microphone permission was denied.",
      ),
    });
    const permissionSession = createMicrophoneRecordingSession({
      role: "contributor",
      recordingPort: permissionHarness.port,
    });
    await permissionSession.arm();
    tester.expect(permissionSession.getSnapshot().status).toBe("failed");
    tester.expect(permissionSession.getSnapshot().failure?.code).toBe("permission-denied");

    const missingDeviceHarness = createRecordingPortHarness({
      prepareError: new MicrophoneRecordingError(
        "microphone-unavailable",
        "No microphone input device is available.",
      ),
    });
    const missingDeviceSession = createMicrophoneRecordingSession({
      role: "owner",
      recordingPort: missingDeviceHarness.port,
    });
    await missingDeviceSession.arm();
    tester.expect(missingDeviceSession.getSnapshot().failure?.code).toBe("microphone-unavailable");
  });

  tester.it("moves an active recording into failed state when the adapter reports an asynchronous error", async () => {
    const harness = createRecordingPortHarness();
    const session = createMicrophoneRecordingSession({
      role: "contributor",
      recordingPort: harness.port,
    });

    await session.arm();
    await session.start();
    harness.failActiveRecording(
      new MicrophoneRecordingError("recording-failed", "Recorder stopped unexpectedly."),
    );

    tester.expect(session.getSnapshot().status).toBe("failed");
    tester.expect(session.getSnapshot().failure?.message).toBe("Recorder stopped unexpectedly.");
  });

  tester.it("releases microphone resources when reset or destroyed", async () => {
    const harness = createRecordingPortHarness();
    const session = createMicrophoneRecordingSession({
      role: "owner",
      recordingPort: harness.port,
    });

    await session.arm();
    await session.reset();
    tester.expect(session.getSnapshot().status).toBe("idle");
    tester.expect(harness.releaseCalls).toBe(1);

    await session.destroy();
    tester.expect(harness.releaseCalls).toBe(2);
  });
});


type PlaybackHarness = {
  engine: PlaybackEngine;
  events: string[];
  seekCalls: number[];
  setClockTime(nextTime: number): void;
  pause(): void;
};

function createPlaybackHarness({
  startPositionSeconds = 0,
  durationSeconds = 60,
  recordingMarkers = true,
}: {
  startPositionSeconds?: number;
  durationSeconds?: number;
  recordingMarkers?: boolean;
} = {}): PlaybackHarness {
  let clockTime = 100;
  const events: string[] = [];
  const seekCalls: number[] = [];
  const transport = createTransport({
    getClockTime: () => clockTime,
    scheduleInterval() {
      return { fakeInterval: true };
    },
    clearScheduledInterval() {},
  });
  const recordingTimeline = createRecordingTimeline(transport);
  transport.setDuration(durationSeconds);
  transport.seek(startPositionSeconds);

  const engine: PlaybackEngine = {
    loadMix() {},
    async play() {
      events.push("playback-start");
      transport.play();
    },
    pause() {
      events.push("playback-pause");
      transport.pause();
    },
    stop() {
      events.push("playback-stop");
      transport.stop();
    },
    seek(seconds) {
      seekCalls.push(seconds);
      transport.seek(seconds);
    },
    seekBy(seconds) {
      transport.seekBy(seconds);
    },
    setLoopEnabled(enabled) {
      transport.setLoopEnabled(enabled);
    },
    setChannelVolume() {
      return false;
    },
    setChannelEnabled() {
      return false;
    },
    getSnapshot() {
      const snapshot = transport.getSnapshot();
      return {
        currentTime: snapshot.positionSeconds,
        duration: snapshot.durationSeconds,
        isPlaying: snapshot.playbackState === "playing",
        hasLoadedChannels: snapshot.durationSeconds > 0,
      };
    },
    subscribe(listener) {
      return transport.subscribe((snapshot) => {
        listener({
          currentTime: snapshot.positionSeconds,
          duration: snapshot.durationSeconds,
          isPlaying: snapshot.playbackState === "playing",
          hasLoadedChannels: snapshot.durationSeconds > 0,
        });
      });
    },
    destroy() {
      transport.destroy();
    },
    ...(recordingMarkers
      ? {
          markRecordingStart() {
            events.push("mark-recording-start");
            return recordingTimeline.markStart();
          },
          markRecordingStop(start) {
            events.push("mark-recording-stop");
            return recordingTimeline.markStop(start);
          },
        }
      : {}),
  };

  return {
    engine,
    events,
    seekCalls,
    setClockTime(nextTime) {
      clockTime = nextTime;
    },
    pause() {
      engine.pause();
    },
  };
}

tester.describe("transport-synchronized microphone recording", () => {
  tester.it("starts project playback, captures authoritative musical start, and preserves stopped-take timing", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({
      startPositionSeconds: 1.25,
    });
    const originalStart = recordingHarness.port.start.bind(recordingHarness.port);
    recordingHarness.port.start = async (options) => {
      playbackHarness.events.push("microphone-start");
      await originalStart(options);
    };

    const session = createMicrophoneRecordingSession({
      role: "contributor",
      recordingPort: recordingHarness.port,
      playbackEngine: playbackHarness.engine,
      musicalTimeline: {
        bpm: 120,
        timeSignature: { numerator: 6, denominator: 8 },
      },
    });

    await session.arm();
    await session.start();

    const recording = session.getSnapshot();
    tester.expect(recording.status).toBe("recording");
    tester.expect(recording.startPosition?.transport.projectPositionSeconds).toBe(1.25);
    tester.expect(recording.startPosition?.musical).toEqual({ bar: 1, beat: 6 });
    tester.expect(playbackHarness.events.slice(0, 3)).toEqual([
      "playback-start",
      "microphone-start",
      "mark-recording-start",
    ]);

    playbackHarness.setClockTime(102);
    await session.stop();

    const stopped = session.getSnapshot();
    tester.expect(stopped.status).toBe("stopped");
    tester.expect(stopped.take?.timing.transport).toEqual({
      startProjectPositionSeconds: 1.25,
      stopProjectPositionSeconds: 3.25,
      startAudioContextTimeSeconds: 100,
      stopAudioContextTimeSeconds: 102,
      durationSeconds: 2,
      timelineOffsetSeconds: 1.25,
    });
    tester.expect(stopped.take?.timing.musicalStart).toEqual({ bar: 1, beat: 6 });
    tester.expect(stopped.take?.timing.musicalStop).toEqual({ bar: 3, beat: 2 });
    tester.expect(stopped.take?.timing.musicalSpanBeats).toBe(8);
    tester.expect(Array.from(stopped.take?.capture.bytes ?? [])).toEqual([1, 2, 3]);
    tester.expect(playbackHarness.events.slice(-2)).toEqual([
      "mark-recording-stop",
      "playback-stop",
    ]);

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });

  tester.it("uses transport-clock elapsed time instead of encoded capture duration for musical span", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({ startPositionSeconds: 4 });
    const session = createMicrophoneRecordingSession({
      role: "owner",
      recordingPort: recordingHarness.port,
      playbackEngine: playbackHarness.engine,
      musicalTimeline: {
        bpm: 60,
        timeSignature: { numerator: 4, denominator: 4 },
      },
    });

    await session.arm();
    await session.start();
    playbackHarness.setClockTime(103.5);
    await session.stop();

    const take = session.getSnapshot().take;
    tester.expect(take?.timing.transport.durationSeconds).toBe(3.5);
    tester.expect(take?.timing.musicalSpanBeats).toBe(3.5);
    tester.expect(take?.capture.bytes.length).toBe(3);

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });

  tester.it("fails before capture when the active playback engine cannot provide authoritative recording markers", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({ recordingMarkers: false });
    const session = createMicrophoneRecordingSession({
      role: "contributor",
      recordingPort: recordingHarness.port,
      playbackEngine: playbackHarness.engine,
      musicalTimeline: {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      },
    });

    await session.arm();
    await session.start();

    tester.expect(session.getSnapshot().status).toBe("failed");
    tester.expect(session.getSnapshot().failure?.code).toBe("unsupported");
    tester.expect(recordingHarness.startCalls).toBe(0);
    tester.expect(playbackHarness.events).toEqual([]);

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });

  tester.it("stops capture deterministically when project playback stops during recording", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({ startPositionSeconds: 10 });
    const session = createMicrophoneRecordingSession({
      role: "owner",
      recordingPort: recordingHarness.port,
      playbackEngine: playbackHarness.engine,
      musicalTimeline: {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      },
    });

    await session.arm();
    await session.start();
    playbackHarness.setClockTime(101.5);
    playbackHarness.pause();
    await Promise.resolve();
    await Promise.resolve();

    tester.expect(recordingHarness.stopCalls).toBe(1);
    tester.expect(session.getSnapshot().status).toBe("stopped");
    tester.expect(session.getSnapshot().take?.timing.transport.durationSeconds).toBe(1.5);

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });
});

type TakePlaybackHarness = {
  port: RecordedTakePlaybackPort;
  playCalls: number;
  stopCalls: number;
  releaseCalls: number;
  lastCapture: RecordedAudioCapture | null;
  end(): void;
  fail(message: string): void;
};

type TakeUploadHarness = {
  port: RecordedTakeUploadPort;
  uploadCalls: RecordedTakeUploadInput[];
  uploadError: Error | null;
};

function createTakeUploadHarness(): TakeUploadHarness {
  const harness: TakeUploadHarness = {
    uploadCalls: [],
    uploadError: null,
    port: null as unknown as RecordedTakeUploadPort,
  };

  harness.port = {
    async upload(input) {
      harness.uploadCalls.push({
        projectId: input.projectId,
        trackName: input.trackName,
        capture: {
          bytes: new Uint8Array(input.capture.bytes),
          mimeType: input.capture.mimeType,
        },
        musicalPlacement: {
          start: { ...input.musicalPlacement.start },
          spanBeats: input.musicalPlacement.spanBeats,
        },
      });

      if (harness.uploadError) {
        throw harness.uploadError;
      }

      const track: Track = {
        id: "recorded-track-1",
        projectId: input.projectId,
        name: input.trackName,
        originalFilename: `${input.trackName}.webm`,
        filePath: `/uploads/${input.trackName}.webm`,
        mimeType: "audio/webm",
        fileSize: input.capture.bytes.byteLength,
        musicalPlacement: {
          start: { ...input.musicalPlacement.start },
          spanBeats: input.musicalPlacement.spanBeats,
        },
        createdAt: "2026-08-21T00:00:00.000Z",
      };

      return track;
    },
  };

  return harness;
}

function createTakePlaybackHarness(): TakePlaybackHarness {
  let onEnded: (() => void) | undefined;
  let onFailure: ((failure: { message: string }) => void) | undefined;
  const harness: TakePlaybackHarness = {
    playCalls: 0,
    stopCalls: 0,
    releaseCalls: 0,
    lastCapture: null,
    port: null as unknown as RecordedTakePlaybackPort,
    end() {
      onEnded?.();
    },
    fail(message) {
      onFailure?.({ message });
    },
  };

  harness.port = {
    async play(capture, options) {
      harness.playCalls += 1;
      harness.lastCapture = {
        bytes: new Uint8Array(capture.bytes),
        mimeType: capture.mimeType,
      };
      onEnded = options?.onEnded;
      onFailure = options?.onFailure;
    },
    async stop() {
      harness.stopCalls += 1;
      onEnded = undefined;
      onFailure = undefined;
    },
    async release() {
      harness.releaseCalls += 1;
      onEnded = undefined;
      onFailure = undefined;
    },
  };

  return harness;
}

async function recordStoppedTakeForReview({
  recordingHarness,
  playbackHarness,
  takePlaybackHarness,
  takeUploadHarness,
}: {
  recordingHarness: RecordingPortHarness;
  playbackHarness: PlaybackHarness;
  takePlaybackHarness: TakePlaybackHarness;
  takeUploadHarness?: TakeUploadHarness;
}) {
  const session = createMicrophoneRecordingSession({
    role: "contributor",
    recordingPort: recordingHarness.port,
    takePlaybackPort: takePlaybackHarness.port,
    ...(takeUploadHarness
      ? {
          takeUploadPort: takeUploadHarness.port,
          projectId: "project-1",
        }
      : {}),
    playbackEngine: playbackHarness.engine,
    musicalTimeline: {
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    },
  });

  await session.arm();
  await session.start();
  playbackHarness.setClockTime(102);
  await session.stop();

  return session;
}

tester.describe("local microphone take review", () => {
  tester.it("auditions a stopped take in context from its stored project position and stops both when the take ends", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({ startPositionSeconds: 2 });
    const takePlaybackHarness = createTakePlaybackHarness();
    const session = await recordStoppedTakeForReview({
      recordingHarness,
      playbackHarness,
      takePlaybackHarness,
    });

    await session.audition();
    tester.expect(session.getSnapshot().status).toBe("stopped");
    tester.expect(session.getSnapshot().takeReviewStatus).toBe("auditioning");
    tester.expect(playbackHarness.seekCalls).toEqual([2]);
    tester.expect(playbackHarness.engine.getSnapshot().isPlaying).toBe(true);
    tester.expect(takePlaybackHarness.playCalls).toBe(1);
    tester.expect(Array.from(takePlaybackHarness.lastCapture?.bytes ?? [])).toEqual([1, 2, 3]);

    takePlaybackHarness.end();
    tester.expect(session.getSnapshot().takeReviewStatus).toBe("idle");
    tester.expect(session.getSnapshot().take).toBeTruthy();
    tester.expect(playbackHarness.engine.getSnapshot().isPlaying).toBe(false);
    tester.expect(playbackHarness.engine.getSnapshot().currentTime).toBe(0);

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });

  tester.it("stops both temporary take playback and project playback when audition is stopped manually", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({ startPositionSeconds: 4 });
    const takePlaybackHarness = createTakePlaybackHarness();
    const session = await recordStoppedTakeForReview({
      recordingHarness,
      playbackHarness,
      takePlaybackHarness,
    });

    await session.audition();
    tester.expect(playbackHarness.seekCalls).toEqual([4]);
    tester.expect(playbackHarness.engine.getSnapshot().isPlaying).toBe(true);

    await session.stopAudition();

    tester.expect(session.getSnapshot().takeReviewStatus).toBe("idle");
    tester.expect(session.getSnapshot().take).toBeTruthy();
    tester.expect(takePlaybackHarness.stopCalls).toBe(1);
    tester.expect(playbackHarness.engine.getSnapshot().isPlaying).toBe(false);
    tester.expect(playbackHarness.engine.getSnapshot().currentTime).toBe(0);

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });

  tester.it("stops in-context project playback when the recording session is destroyed during audition", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({ startPositionSeconds: 5 });
    const takePlaybackHarness = createTakePlaybackHarness();
    const session = await recordStoppedTakeForReview({
      recordingHarness,
      playbackHarness,
      takePlaybackHarness,
    });

    await session.audition();
    tester.expect(playbackHarness.engine.getSnapshot().isPlaying).toBe(true);

    await session.destroy();

    tester.expect(playbackHarness.engine.getSnapshot().isPlaying).toBe(false);
    tester.expect(playbackHarness.engine.getSnapshot().currentTime).toBe(0);
    tester.expect(takePlaybackHarness.releaseCalls).toBe(1);

    playbackHarness.engine.destroy?.();
  });

  tester.it("retries repeatedly without releasing the prepared microphone, then records a replacement take", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({ startPositionSeconds: 1 });
    const takePlaybackHarness = createTakePlaybackHarness();
    const session = await recordStoppedTakeForReview({
      recordingHarness,
      playbackHarness,
      takePlaybackHarness,
    });

    await session.audition();
    await session.retry();

    tester.expect(session.getSnapshot().status).toBe("ready");
    tester.expect(session.getSnapshot().take).toBe(null);
    tester.expect(session.getSnapshot().capture).toBe(null);
    tester.expect(session.getSnapshot().takeReviewStatus).toBe("idle");
    tester.expect(recordingHarness.releaseCalls).toBe(0);
    tester.expect(takePlaybackHarness.releaseCalls).toBe(1);

    playbackHarness.engine.seek(3);
    playbackHarness.setClockTime(103);
    await session.start();
    playbackHarness.setClockTime(104.5);
    await session.stop();

    tester.expect(session.getSnapshot().status).toBe("stopped");
    tester.expect(session.getSnapshot().take?.timing.transport.startProjectPositionSeconds).toBe(3);
    tester.expect(session.getSnapshot().take?.timing.transport.durationSeconds).toBe(1.5);
    tester.expect(recordingHarness.startCalls).toBe(2);
    tester.expect(recordingHarness.stopCalls).toBe(2);

    await session.audition();
    tester.expect(takePlaybackHarness.playCalls).toBe(2);
    takePlaybackHarness.end();
    tester.expect(session.getSnapshot().takeReviewStatus).toBe("idle");

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });

  tester.it("discards a stopped take, releases temporary playback and microphone resources, and returns to idle", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness();
    const takePlaybackHarness = createTakePlaybackHarness();
    const session = await recordStoppedTakeForReview({
      recordingHarness,
      playbackHarness,
      takePlaybackHarness,
    });

    await session.audition();
    await session.discard();

    const discarded = session.getSnapshot();
    tester.expect(discarded.status).toBe("idle");
    tester.expect(discarded.take).toBe(null);
    tester.expect(discarded.capture).toBe(null);
    tester.expect(discarded.startPosition).toBe(null);
    tester.expect(discarded.takeReviewStatus).toBe("idle");
    tester.expect(takePlaybackHarness.releaseCalls).toBe(1);
    tester.expect(recordingHarness.releaseCalls).toBe(1);

    takePlaybackHarness.end();
    tester.expect(session.getSnapshot().status).toBe("idle");

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });

  tester.it("keeps the stopped take available when audition playback fails", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness();
    const takePlaybackHarness = createTakePlaybackHarness();
    const session = await recordStoppedTakeForReview({
      recordingHarness,
      playbackHarness,
      takePlaybackHarness,
    });

    await session.audition();
    takePlaybackHarness.fail("Temporary take could not be decoded.");

    tester.expect(session.getSnapshot().status).toBe("stopped");
    tester.expect(session.getSnapshot().takeReviewStatus).toBe("idle");
    tester.expect(session.getSnapshot().takeReviewFailure?.message).toBe(
      "Temporary take could not be decoded.",
    );
    tester.expect(session.getSnapshot().take).toBeTruthy();
    tester.expect(playbackHarness.engine.getSnapshot().isPlaying).toBe(false);
    tester.expect(playbackHarness.engine.getSnapshot().currentTime).toBe(0);

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });
});

tester.describe("keep reviewed microphone take", () => {
  tester.it("uploads an auditioned take through the normal track boundary with captured musical placement", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({ startPositionSeconds: 3.5 });
    const takePlaybackHarness = createTakePlaybackHarness();
    const takeUploadHarness = createTakeUploadHarness();
    const session = await recordStoppedTakeForReview({
      recordingHarness,
      playbackHarness,
      takePlaybackHarness,
      takeUploadHarness,
    });

    await session.audition();
    const kept = await session.keep("  Harmony   Vocal  ");

    tester.expect(takeUploadHarness.uploadCalls.length).toBe(1);
    tester.expect(takeUploadHarness.uploadCalls[0]?.projectId).toBe("project-1");
    tester.expect(takeUploadHarness.uploadCalls[0]?.trackName).toBe("Harmony Vocal");
    tester.expect(Array.from(takeUploadHarness.uploadCalls[0]?.capture.bytes ?? [])).toEqual([1, 2, 3]);
    tester.expect(takeUploadHarness.uploadCalls[0]?.musicalPlacement).toEqual({
      start: { bar: 2, beat: 4 },
      spanBeats: 4,
    });
    tester.expect(playbackHarness.engine.getSnapshot().isPlaying).toBe(false);
    tester.expect(takePlaybackHarness.releaseCalls).toBe(1);
    tester.expect(recordingHarness.releaseCalls).toBe(1);
    tester.expect(kept.status).toBe("idle");
    tester.expect(kept.take).toBe(null);
    tester.expect(kept.capture).toBe(null);
    tester.expect(kept.savedTrack?.id).toBe("recorded-track-1");
    tester.expect(kept.savedTrack?.musicalPlacement).toEqual({
      start: { bar: 2, beat: 4 },
      spanBeats: 4,
    });

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });

  tester.it("keeps the reviewed take available when upload fails so the collaborator can retry saving", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness({ startPositionSeconds: 2 });
    const takePlaybackHarness = createTakePlaybackHarness();
    const takeUploadHarness = createTakeUploadHarness();
    takeUploadHarness.uploadError = new Error("Upload connection failed.");
    const session = await recordStoppedTakeForReview({
      recordingHarness,
      playbackHarness,
      takePlaybackHarness,
      takeUploadHarness,
    });

    const failed = await session.keep("Lead Vocal");

    tester.expect(failed.status).toBe("stopped");
    tester.expect(failed.take).toBeTruthy();
    tester.expect(failed.takeSaveStatus).toBe("idle");
    tester.expect(failed.takeSaveFailure?.message).toBe("Upload connection failed.");
    tester.expect(failed.savedTrack).toBe(null);
    tester.expect(recordingHarness.releaseCalls).toBe(0);

    takeUploadHarness.uploadError = null;
    const retried = await session.keep("Lead Vocal");
    tester.expect(takeUploadHarness.uploadCalls.length).toBe(2);
    tester.expect(retried.status).toBe("idle");
    tester.expect(retried.savedTrack?.name).toBe("Lead Vocal");

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });

  tester.it("requires a track name before uploading the reviewed take", async () => {
    const recordingHarness = createRecordingPortHarness();
    const playbackHarness = createPlaybackHarness();
    const takePlaybackHarness = createTakePlaybackHarness();
    const takeUploadHarness = createTakeUploadHarness();
    const session = await recordStoppedTakeForReview({
      recordingHarness,
      playbackHarness,
      takePlaybackHarness,
      takeUploadHarness,
    });

    const result = await session.keep("   ");

    tester.expect(takeUploadHarness.uploadCalls).toEqual([]);
    tester.expect(result.status).toBe("stopped");
    tester.expect(result.take).toBeTruthy();
    tester.expect(result.takeSaveFailure?.message).toBe(
      "Enter a track name before keeping this take.",
    );

    await session.destroy();
    playbackHarness.engine.destroy?.();
  });
});
