import {
  MicrophoneRecordingError,
  createMicrophoneRecordingSession,
  type MicrophoneRecordingFailureHandler,
  type MicrophoneRecordingPort,
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
