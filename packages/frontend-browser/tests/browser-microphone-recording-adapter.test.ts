import {
  MicrophoneRecordingError,
  type MicrophoneRecordingFailure,
  type RecordingAlignmentDiagnosticObservation,
  type RecordingAlignmentDiagnosticsPort,
} from "@hugovela/frontend-core";
import { createBrowserMicrophoneRecordingAdapter } from "../src/index.js";
import { tester } from "./test-runner/tester.js";

class FakeMediaStreamTrack {
  stopCalls = 0;
  readyState: MediaStreamTrackState = "live";
  channelCount = 1;
  rejectMonoConstraint = false;
  applyConstraintsCalls: MediaTrackConstraints[] = [];
  getSettings(): MediaTrackSettings {
    return {
      latency: 0.04,
      sampleRate: 48000,
      channelCount: this.channelCount,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    } as unknown as MediaTrackSettings;
  }
  getCapabilities(): MediaTrackCapabilities {
    return {
      latency: { min: 0.01, max: 0.2 },
      sampleRate: { min: 16000, max: 48000 },
      channelCount: { min: 1, max: 2 },
    } as MediaTrackCapabilities;
  }
  getConstraints(): MediaTrackConstraints {
    return {};
  }
  async applyConstraints(constraints: MediaTrackConstraints): Promise<void> {
    this.applyConstraintsCalls.push(constraints);
    if (this.rejectMonoConstraint) {
      throw new Error("mono constraint rejected");
    }
    const requested = constraints.channelCount;
    const exact = typeof requested === "object" && requested !== null && "exact" in requested
      ? requested.exact
      : requested;
    if (exact === 1) {
      this.channelCount = 1;
    }
  }
  stop(): void {
    this.stopCalls += 1;
    this.readyState = "ended";
  }

  endUnexpectedly(): void {
    this.readyState = "ended";
  }
}

class FakeMediaStream {
  readonly track = new FakeMediaStreamTrack();
  constructor(channelCount = 1) {
    this.track.channelCount = channelCount;
  }
  getTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack];
  }
  getAudioTracks(): MediaStreamTrack[] {
    return this.getTracks();
  }
}

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static supportedTypes = new Set(["audio/webm;codecs=opus"]);

  static isTypeSupported(mimeType: string): boolean {
    return FakeMediaRecorder.supportedTypes.has(mimeType);
  }

  readonly mimeType: string;
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;

  constructor(
    readonly stream: MediaStream,
    options?: MediaRecorderOptions,
  ) {
    this.mimeType = options?.mimeType ?? "audio/default";
    FakeMediaRecorder.instances.push(this);
  }

  start(): void {
    this.state = "recording";
    this.onstart?.(new Event("start"));
  }

  stop(): void {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([4, 5, 6])], { type: this.mimeType }),
    } as BlobEvent);
    this.onstop?.(new Event("stop"));
  }

  fail(error: Error): void {
    const event = new Event("error") as Event & { error?: unknown };
    event.error = error;
    this.onerror?.(event);
  }
}

const MUSIC_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 1 },
};


class DelayedStartMediaRecorder extends FakeMediaRecorder {
  static delayedInstances: DelayedStartMediaRecorder[] = [];

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    super(stream, options);
    DelayedStartMediaRecorder.delayedInstances.push(this);
  }

  override start(): void {
    this.state = "recording";
  }

  emitStart(): void {
    this.onstart?.(new Event("start"));
  }
}

class DelayedStopMediaRecorder extends FakeMediaRecorder {
  override stop(): void {
    this.state = "inactive";
  }
}

function createMediaDevices(
  stream: FakeMediaStream,
  expectedAudioConstraints: boolean | MediaTrackConstraints = MUSIC_AUDIO_CONSTRAINTS,
) {
  return {
    async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
      tester.expect(constraints).toEqual({ audio: expectedAudioConstraints });
      return stream as unknown as MediaStream;
    },
    getSupportedConstraints(): MediaTrackSupportedConstraints {
      return { latency: true } as MediaTrackSupportedConstraints;
    },
  };
}

tester.describe("browser microphone recording adapter", () => {
  tester.beforeEach(() => {
    FakeMediaRecorder.instances = [];
    FakeMediaRecorder.supportedTypes = new Set(["audio/webm;codecs=opus"]);
  });

  tester.it("requests audio permission, records bytes, and releases the microphone stream", async () => {
    const stream = new FakeMediaStream();
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream),
      MediaRecorderConstructor: FakeMediaRecorder,
    });

    await adapter.prepare();
    await adapter.start();
    tester.expect(FakeMediaRecorder.instances.length).toBe(1);
    tester.expect(FakeMediaRecorder.instances[0]?.mimeType).toBe("audio/webm;codecs=opus");

    const capture = await adapter.stop();
    tester.expect(Array.from(capture.bytes)).toEqual([4, 5, 6]);
    tester.expect(capture.mimeType).toBe("audio/webm;codecs=opus");

    await adapter.release();
    tester.expect(stream.track.stopCalls).toBe(1);
  });

  tester.it("restores the browser playback audio session after releasing the microphone", async () => {
    const stream = new FakeMediaStream();
    const assignedTypes: string[] = [];
    let currentType = "auto";
    const audioSession = {
      get type() {
        return currentType as "auto" | "playback" | "play-and-record";
      },
      set type(value: "auto" | "playback" | "play-and-record") {
        currentType = value;
        assignedTypes.push(value);
      },
    };
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream),
      MediaRecorderConstructor: FakeMediaRecorder,
      audioSession,
    });

    await adapter.prepare();
    tester.expect(assignedTypes).toEqual(["play-and-record"]);

    await adapter.release();

    tester.expect(stream.track.stopCalls).toBe(1);
    tester.expect(assignedTypes).toEqual([
      "play-and-record",
      "playback",
      "auto",
    ]);
    tester.expect(audioSession.type).toBe("auto");
  });


  tester.it("requests music-oriented unprocessed microphone audio by default", async () => {
    const stream = new FakeMediaStream();
    const rawConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 1 },
    };
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream, rawConstraints),
      MediaRecorderConstructor: FakeMediaRecorder,
    });

    await adapter.prepare();
    await adapter.release();

    tester.expect(stream.track.stopCalls).toBe(1);
  });


  tester.it("forces a multichannel microphone track to native mono before MediaRecorder", async () => {
    const stream = new FakeMediaStream(2);
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream),
      MediaRecorderConstructor: FakeMediaRecorder,
    });

    await adapter.prepare();
    tester.expect(stream.track.applyConstraintsCalls).toEqual([
      { channelCount: { exact: 1 } },
    ]);
    tester.expect(stream.track.channelCount).toBe(1);

    await adapter.start();
    tester.expect(FakeMediaRecorder.instances[0]?.stream).toBe(
      stream as unknown as MediaStream,
    );
    await adapter.stop();
    await adapter.release();
  });

  tester.it("falls back to a browser mono capture stream when the device refuses a mono track constraint", async () => {
    const stream = new FakeMediaStream(2);
    stream.track.rejectMonoConstraint = true;
    const normalizedStream = new FakeMediaStream(1);
    let normalizeCalls = 0;
    let normalizeReleaseCalls = 0;
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream),
      MediaRecorderConstructor: FakeMediaRecorder,
      async createMonoRecordingStream(sourceStream) {
        normalizeCalls += 1;
        tester.expect(sourceStream).toBe(stream as unknown as MediaStream);
        return {
          stream: normalizedStream as unknown as MediaStream,
          async release() {
            normalizeReleaseCalls += 1;
          },
        };
      },
    });

    await adapter.prepare();
    await adapter.start();

    tester.expect(normalizeCalls).toBe(1);
    tester.expect(FakeMediaRecorder.instances[0]?.stream).toBe(
      normalizedStream as unknown as MediaStream,
    );

    await adapter.stop();
    await adapter.release();
    tester.expect(normalizeReleaseCalls).toBe(1);
    tester.expect(stream.track.stopCalls).toBe(1);
  });

  tester.it("reacquires a fresh music-oriented stream when the prepared input has ended", async () => {
    const firstStream = new FakeMediaStream();
    const secondStream = new FakeMediaStream();
    const requestedConstraints: MediaStreamConstraints[] = [];
    let getUserMediaCalls = 0;
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: {
        async getUserMedia(constraints) {
          requestedConstraints.push(constraints);
          getUserMediaCalls += 1;
          return (getUserMediaCalls === 1 ? firstStream : secondStream) as unknown as MediaStream;
        },
      },
      MediaRecorderConstructor: FakeMediaRecorder,
    });

    await adapter.prepare();
    firstStream.track.endUnexpectedly();
    await adapter.start();

    tester.expect(getUserMediaCalls).toBe(2);
    tester.expect(requestedConstraints).toEqual([
      { audio: MUSIC_AUDIO_CONSTRAINTS },
      { audio: MUSIC_AUDIO_CONSTRAINTS },
    ]);
    tester.expect(firstStream.track.stopCalls).toBe(1);

    tester.expect(FakeMediaRecorder.instances[0]?.stream).toBe(
      secondStream as unknown as MediaStream,
    );
    await adapter.stop();
    await adapter.release();
    tester.expect(secondStream.track.stopCalls).toBe(1);
  });

  tester.it("runs the AudioWorklet PCM alignment monitor alongside raw diagnostic capture", async () => {
    const stream = new FakeMediaStream();
    const rawConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      latency: { exact: 0.02 },
    } as MediaTrackConstraints & { latency: { exact: number } };
    const observations: RecordingAlignmentDiagnosticObservation[] = [];
    const diagnostics: RecordingAlignmentDiagnosticsPort = {
      beginAttempt() { return "recording-1"; },
      observe(observation) { observations.push(observation); },
      completeAttempt() {},
      getActiveAttemptId() { return "recording-1"; },
    };
    let createMonitorCalls = 0;
    let anchorCalls = 0;
    let releaseCalls = 0;
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream, rawConstraints),
      MediaRecorderConstructor: FakeMediaRecorder,
      recordingAlignmentDiagnostics: diagnostics,
      getAudioConstraints: () => rawConstraints,
      getPcmAlignmentDiagnosticsEnabled: () => true,
      async createPcmAlignmentMonitor(options) {
        createMonitorCalls += 1;
        tester.expect(options.stream).toBe(stream as unknown as MediaStream);
        tester.expect(options.recordingAlignmentDiagnostics).toBe(diagnostics);
        return {
          markAttemptClockAnchor() {
            anchorCalls += 1;
          },
          async release() {
            releaseCalls += 1;
          },
        };
      },
    });

    await adapter.prepare();
    await adapter.start();
    await adapter.stop();
    await adapter.release();

    tester.expect(createMonitorCalls).toBe(1);
    tester.expect(anchorCalls).toBe(1);
    tester.expect(releaseCalls).toBe(1);
    const prepared = observations.find(
      (observation) => observation.stage === "microphone-prepared",
    );
    tester.expect(prepared?.detail?.pcmAlignmentMonitorStatus).toBe("ready");
    tester.expect(prepared?.detail?.inputLatencyMilliseconds).toBe(40);
    tester.expect(prepared?.detail?.latencyConstraintSupported).toBe(true);
    tester.expect(prepared?.detail?.inputLatencyCapabilityMinimumMilliseconds).toBe(10);
    tester.expect(prepared?.detail?.inputLatencyCapabilityMaximumMilliseconds).toBe(200);
    tester.expect(prepared?.detail?.requestedLatencyConstraintMilliseconds).toBe(null);
    tester.expect(prepared?.detail?.requestedLatencyConstraintIdealMilliseconds).toBe(null);
    tester.expect(prepared?.detail?.requestedLatencyConstraintExactMilliseconds).toBe(20);
    tester.expect(prepared?.detail?.sampleRateCapabilityMaximum).toBe(48000);
    tester.expect(prepared?.detail?.channelCountCapabilityMaximum).toBe(2);
  });

  tester.it("does not resolve start until MediaRecorder reports that capture is active", async () => {
    const stream = new FakeMediaStream();
    DelayedStartMediaRecorder.delayedInstances = [];
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream),
      MediaRecorderConstructor: DelayedStartMediaRecorder,
    });

    await adapter.prepare();
    let startResolved = false;
    const startPromise = adapter.start().then(() => {
      startResolved = true;
    });
    await Promise.resolve();

    tester.expect(startResolved).toBe(false);
    tester.expect(DelayedStartMediaRecorder.delayedInstances.length).toBe(1);

    DelayedStartMediaRecorder.delayedInstances[0]?.emitStart();
    await startPromise;
    tester.expect(startResolved).toBe(true);

    await adapter.stop();
    await adapter.release();
  });

  tester.it("reports unsupported browser recording APIs", async () => {
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: null,
      MediaRecorderConstructor: null,
    });

    let failure: MicrophoneRecordingError | null = null;
    try {
      await adapter.prepare();
    } catch (error) {
      failure = error as MicrophoneRecordingError;
    }

    tester.expect(failure?.code).toBe("unsupported");
  });

  tester.it("maps denied microphone permission", async () => {
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: {
        async getUserMedia() {
          const error = new Error("denied");
          error.name = "NotAllowedError";
          throw error;
        },
      },
      MediaRecorderConstructor: FakeMediaRecorder,
    });

    let failure: MicrophoneRecordingError | null = null;
    try {
      await adapter.prepare();
    } catch (error) {
      failure = error as MicrophoneRecordingError;
    }

    tester.expect(failure?.code).toBe("permission-denied");
  });

  tester.it("maps a missing microphone device", async () => {
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: {
        async getUserMedia() {
          const error = new Error("missing");
          error.name = "NotFoundError";
          throw error;
        },
      },
      MediaRecorderConstructor: FakeMediaRecorder,
    });

    let failure: MicrophoneRecordingError | null = null;
    try {
      await adapter.prepare();
    } catch (error) {
      failure = error as MicrophoneRecordingError;
    }

    tester.expect(failure?.code).toBe("microphone-unavailable");
  });

  tester.it("maps an unreadable audio route to a recoverable microphone-unavailable failure", async () => {
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: {
        async getUserMedia() {
          const error = new Error("device busy");
          error.name = "NotReadableError";
          throw error;
        },
      },
      MediaRecorderConstructor: FakeMediaRecorder,
    });

    let failure: MicrophoneRecordingError | null = null;
    try {
      await adapter.prepare();
    } catch (error) {
      failure = error as MicrophoneRecordingError;
    }

    tester.expect(failure?.code).toBe("microphone-unavailable");
    tester.expect(failure?.message).toBe(
      "The microphone could not be opened. Check the audio device or route and try again.",
    );
  });

  tester.it("rejects a pending recorder start and releases the stream when the session is torn down", async () => {
    const stream = new FakeMediaStream();
    DelayedStartMediaRecorder.delayedInstances = [];
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream),
      MediaRecorderConstructor: DelayedStartMediaRecorder,
    });

    await adapter.prepare();
    let failure: MicrophoneRecordingError | null = null;
    const startPromise = adapter.start().catch((error) => {
      failure = error as MicrophoneRecordingError;
    });
    await Promise.resolve();

    await adapter.release();
    await startPromise;

    tester.expect((failure as MicrophoneRecordingError | null)?.code).toBe("recording-failed");
    tester.expect(stream.track.stopCalls).toBe(1);
  });

  tester.it("rejects a pending recorder stop rather than leaving a cleanup promise hanging", async () => {
    const stream = new FakeMediaStream();
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream),
      MediaRecorderConstructor: DelayedStopMediaRecorder,
    });

    await adapter.prepare();
    await adapter.start();
    let failure: MicrophoneRecordingError | null = null;
    const stopPromise = adapter.stop().catch((error) => {
      failure = error as MicrophoneRecordingError;
      return null;
    });
    await Promise.resolve();

    await adapter.release();
    await stopPromise;

    tester.expect((failure as MicrophoneRecordingError | null)?.code).toBe("recording-failed");
    tester.expect(stream.track.stopCalls).toBe(1);
  });

  tester.it("reports asynchronous MediaRecorder failures through the shared callback", async () => {
    const stream = new FakeMediaStream();
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream),
      MediaRecorderConstructor: FakeMediaRecorder,
    });
    const failures: MicrophoneRecordingFailure[] = [];

    await adapter.prepare();
    await adapter.start({
      onFailure(nextFailure) {
        failures.push(nextFailure);
      },
    });
    FakeMediaRecorder.instances[0]?.fail(new Error("capture device disconnected"));

    tester.expect(failures[0]?.code).toBe("recording-failed");
    tester.expect(failures[0]?.message).toBe("capture device disconnected");
    await adapter.release();
  });
  tester.it("reports MediaRecorder start/stop events to shared alignment diagnostics", async () => {
    const stream = new FakeMediaStream();
    const observations: RecordingAlignmentDiagnosticObservation[] = [];
    const diagnostics: RecordingAlignmentDiagnosticsPort = {
      beginAttempt() { return "recording-1"; },
      observe(observation) { observations.push(observation); },
      completeAttempt() {},
      getActiveAttemptId() { return "recording-1"; },
    };
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream),
      MediaRecorderConstructor: FakeMediaRecorder,
      recordingAlignmentDiagnostics: diagnostics,
    });

    await adapter.prepare();
    await adapter.start();
    await adapter.stop();

    tester.expect(observations.map((observation) => observation.stage)).toEqual([
      "microphone-prepared",
      "media-recorder-start-called",
      "media-recorder-start-event",
      "media-recorder-stop-called",
      "media-recorder-stop-event",
      "recorded-capture-ready",
    ]);
  });

});
