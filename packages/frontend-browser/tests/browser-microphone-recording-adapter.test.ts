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
  getSettings(): MediaTrackSettings {
    return {
      latency: 0.04,
      sampleRate: 48000,
      channelCount: 1,
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
  stop(): void {
    this.stopCalls += 1;
  }
}

class FakeMediaStream {
  readonly track = new FakeMediaStreamTrack();
  getTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack];
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

function createMediaDevices(
  stream: FakeMediaStream,
  expectedAudioConstraints: boolean | MediaTrackConstraints = true,
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


  tester.it("can request unprocessed microphone audio for alignment diagnostics", async () => {
    const stream = new FakeMediaStream();
    const rawConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    const adapter = createBrowserMicrophoneRecordingAdapter({
      mediaDevices: createMediaDevices(stream, rawConstraints),
      MediaRecorderConstructor: FakeMediaRecorder,
      getAudioConstraints: () => rawConstraints,
    });

    await adapter.prepare();
    await adapter.release();

    tester.expect(stream.track.stopCalls).toBe(1);
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
