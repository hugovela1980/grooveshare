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
    hidden: false,
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

function createStoppedTake() {
  return {
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
  };
}

function createSessionHarness() {
  let snapshot: MicrophoneRecordingSnapshot = {
    status: "idle",
    capture: null,
    startPosition: null,
    take: null,
    failure: null,
    takeReviewStatus: "idle",
    takeReviewFailure: null,
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
        take: null,
        capture: null,
        takeReviewStatus: "idle",
        takeReviewFailure: null,
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
      const take = createStoppedTake();
      return publish({
        ...snapshot,
        status: "stopped",
        capture: take.capture,
        take,
        takeReviewStatus: "idle",
        takeReviewFailure: null,
      });
    },
    audition() {
      calls.push("audition");
      return publish({
        ...snapshot,
        takeReviewStatus: "auditioning",
        takeReviewFailure: null,
      });
    },
    stopAudition() {
      calls.push("stop-audition");
      return publish({
        ...snapshot,
        takeReviewStatus: "idle",
        takeReviewFailure: null,
      });
    },
    retry() {
      calls.push("retry");
      return publish({
        ...snapshot,
        status: "ready",
        capture: null,
        startPosition: null,
        take: null,
        takeReviewStatus: "idle",
        takeReviewFailure: null,
      });
    },
    discard() {
      calls.push("discard");
      return publish({
        status: "idle",
        capture: null,
        startPosition: null,
        take: null,
        failure: null,
        takeReviewStatus: "idle",
        takeReviewFailure: null,
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
        takeReviewStatus: "idle",
        takeReviewFailure: null,
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
  tester.it("drives record, audition, retry, and discard controls from shared state", async () => {
    const harness = createSessionHarness();
    const armButton = createButton();
    const recordButton = createButton();
    const stopButton = createButton();
    const auditionButton = createButton();
    const retryButton = createButton();
    const discardButton = createButton();
    const statusElement = { textContent: "" as string | null };
    const controller = createMicrophoneRecordingController({
      recordingSession: harness.session,
      armButton,
      recordButton,
      stopButton,
      auditionButton,
      retryButton,
      discardButton,
      statusElement,
    });

    controller.init();
    tester.expect(armButton.disabled).toBe(false);
    tester.expect(recordButton.disabled).toBe(true);
    tester.expect(stopButton.disabled).toBe(true);
    tester.expect(auditionButton.hidden).toBe(true);

    await armButton.click();
    tester.expect(recordButton.disabled).toBe(false);
    tester.expect(statusElement.textContent?.includes("current project position")).toBe(true);

    await recordButton.click();
    tester.expect(stopButton.disabled).toBe(false);
    tester.expect(statusElement.textContent).toBe("Recording from Bar 2, Beat 4…");

    await stopButton.click();
    tester.expect(stopButton.disabled).toBe(true);
    tester.expect(auditionButton.hidden).toBe(false);
    tester.expect(retryButton.hidden).toBe(false);
    tester.expect(discardButton.hidden).toBe(false);
    tester.expect(statusElement.textContent).toBe(
      "Take captured from Bar 2, Beat 4 · 4 project beats. Audition it, retry, or discard it.",
    );

    await auditionButton.click();
    tester.expect(auditionButton.textContent).toBe("Stop Audition");
    tester.expect(statusElement.textContent?.endsWith("Auditioning…")).toBe(true);

    await auditionButton.click();
    tester.expect(auditionButton.textContent).toBe("Audition Take");

    await retryButton.click();
    tester.expect(recordButton.disabled).toBe(false);
    tester.expect(auditionButton.hidden).toBe(true);

    await recordButton.click();
    await stopButton.click();
    await discardButton.click();
    tester.expect(armButton.disabled).toBe(false);
    tester.expect(recordButton.disabled).toBe(true);
    tester.expect(auditionButton.hidden).toBe(true);
    tester.expect(statusElement.textContent).toBe("Enable your microphone to prepare a take.");

    tester.expect(harness.calls).toEqual([
      "arm",
      "start",
      "stop",
      "audition",
      "stop-audition",
      "retry",
      "start",
      "stop",
      "discard",
    ]);

    controller.destroy();
  });
});
