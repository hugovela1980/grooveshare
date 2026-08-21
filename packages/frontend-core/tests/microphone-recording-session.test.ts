import {
  MicrophoneRecordingError,
  createMicrophoneRecordingSession,
  createRecordingTimeline,
  createTransport,
  type MicrophoneRecordingFailureHandler,
  type MicrophoneRecordingPort,
  type PlaybackEngine,
  type RecordedAudioCapture,
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
