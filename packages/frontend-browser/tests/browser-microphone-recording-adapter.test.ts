import {
  MicrophoneRecordingError,
  type MicrophoneRecordingFailure,
} from "@hugovela/frontend-core";
import { createBrowserMicrophoneRecordingAdapter } from "../src/index.js";
import { tester } from "./test-runner/tester.js";

class FakeMediaStreamTrack {
  stopCalls = 0;
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

function createMediaDevices(stream: FakeMediaStream) {
  return {
    async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
      tester.expect(constraints).toEqual({ audio: true });
      return stream as unknown as MediaStream;
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
});
