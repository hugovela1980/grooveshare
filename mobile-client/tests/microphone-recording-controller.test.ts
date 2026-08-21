import type {
  MicrophoneRecordingSession,
  MicrophoneRecordingSnapshot,
} from "@hugovela/frontend-core";
import { createMicrophoneRecordingController } from "../src/page-controllers/microphone-recording-controller.js";
import { tester } from "./test-runner/tester.js";

function createButton() {
  let clickHandler: (() => void | Promise<void>) | null = null;

  return {
    disabled: false,
    textContent: "",
    addEventListener(
      eventName: "click",
      handler: () => void | Promise<void>,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },
    async click() {
      await clickHandler?.();
    },
  };
}

function createSessionHarness() {
  let snapshot: MicrophoneRecordingSnapshot = {
    status: "idle",
    capture: null,
    startPosition: null,
    take: null,
    failure: null,
  };
  let listener: ((next: MicrophoneRecordingSnapshot) => void) | null = null;
  const calls: string[] = [];

  function publish(next: MicrophoneRecordingSnapshot) {
    snapshot = next;
    listener?.(snapshot);
    return Promise.resolve(snapshot);
  }

  const session: MicrophoneRecordingSession = {
    arm() {
      calls.push("arm");
      return publish({ ...snapshot, status: "ready", failure: null });
    },
    start() {
      calls.push("start");
      return publish({
        ...snapshot,
        status: "recording",
        startPosition: {
          transport: {
            kind: "recording-start",
            projectPositionSeconds: 3.5,
            audioContextTimeSeconds: 20,
            playbackState: "playing",
          },
          musical: { bar: 2, beat: 4 },
        },
      });
    },
    stop() {
      calls.push("stop");
      return publish({
        ...snapshot,
        status: "stopped",
        capture: {
          bytes: new Uint8Array([1]),
          mimeType: "audio/webm",
        },
        take: {
          capture: {
            bytes: new Uint8Array([1]),
            mimeType: "audio/webm",
          },
          timing: {
            transport: {
              startProjectPositionSeconds: 3.5,
              stopProjectPositionSeconds: 5.5,
              startAudioContextTimeSeconds: 20,
              stopAudioContextTimeSeconds: 22,
              durationSeconds: 2,
              timelineOffsetSeconds: 3.5,
            },
            musicalStart: { bar: 2, beat: 4 },
            musicalStop: { bar: 3, beat: 4 },
            musicalSpanBeats: 4,
          },
        },
      });
    },
    reset() {
      calls.push("reset");
      return publish({
        status: "idle",
        capture: null,
        startPosition: null,
        take: null,
        failure: null,
      });
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(nextListener) {
      listener = nextListener;
      nextListener(snapshot);
      return () => {
        listener = null;
      };
    },
    async destroy() {},
  };

  return { session, calls };
}

tester.describe("microphone recording controller", () => {
  tester.it("drives arm, record, and stop controls from shared recording state", async () => {
    const harness = createSessionHarness();
    const armButton = createButton();
    const recordButton = createButton();
    const stopButton = createButton();
    const statusElement = { textContent: "" as string | null };
    const controller = createMicrophoneRecordingController({
      recordingSession: harness.session,
      armButton,
      recordButton,
      stopButton,
      statusElement,
    });

    controller.init();
    tester.expect(armButton.disabled).toBe(false);
    tester.expect(recordButton.disabled).toBe(true);
    tester.expect(stopButton.disabled).toBe(true);

    await armButton.click();
    tester.expect(recordButton.disabled).toBe(false);
    tester.expect(statusElement.textContent?.includes("current project position")).toBe(true);

    await recordButton.click();
    tester.expect(stopButton.disabled).toBe(false);
    tester.expect(statusElement.textContent).toBe("Recording from Bar 2, Beat 4…");

    await stopButton.click();
    tester.expect(stopButton.disabled).toBe(true);
    tester.expect(statusElement.textContent).toBe(
      "Take captured from Bar 2, Beat 4 · 4 project beats.",
    );
    tester.expect(harness.calls).toEqual(["arm", "start", "stop"]);

    controller.destroy();
  });
});
