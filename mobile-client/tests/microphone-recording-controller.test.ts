import type {
  MicrophoneRecordingSession,
  MicrophoneRecordingSnapshot,
  Track,
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

function createInput() {
  return {
    disabled: false,
    hidden: false,
    value: "",
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

function createSavedTrack(name: string): Track {
  return {
    id: "recorded-track-1",
    projectId: "project-1",
    name,
    originalFilename: `${name}.webm`,
    filePath: `/uploads/${name}.webm`,
    mimeType: "audio/webm",
    fileSize: 1,
    musicalPlacement: {
      start: { bar: 2, beat: 4 },
      spanBeats: 4,
    },
    createdAt: "2026-08-21T00:00:00.000Z",
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
    takeSaveStatus: "idle",
    takeSaveFailure: null,
    savedTrack: null,
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
      return publish({ ...snapshot, status: "ready", failure: null, savedTrack: null });
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
        takeSaveStatus: "idle",
        takeSaveFailure: null,
        savedTrack: null,
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
        takeSaveStatus: "idle",
        takeSaveFailure: null,
        savedTrack: null,
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
        takeSaveStatus: "idle",
        takeSaveFailure: null,
        savedTrack: null,
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
        takeSaveStatus: "idle",
        takeSaveFailure: null,
        savedTrack: null,
      });
    },
    keep(trackName) {
      calls.push(`keep:${trackName}`);
      return publish({
        status: "idle",
        capture: null,
        startPosition: null,
        take: null,
        failure: null,
        takeReviewStatus: "idle",
        takeReviewFailure: null,
        takeSaveStatus: "idle",
        takeSaveFailure: null,
        savedTrack: createSavedTrack(trackName.trim()),
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
        takeSaveStatus: "idle",
        takeSaveFailure: null,
        savedTrack: null,
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

function createControllerHarness(onTakeKept?: (track: Track) => void | Promise<void>) {
  const sessionHarness = createSessionHarness();
  const armButton = createButton();
  const recordButton = createButton();
  const stopButton = createButton();
  const auditionButton = createButton();
  const retryButton = createButton();
  const discardButton = createButton();
  const keepButton = createButton();
  const takeNameInput = createInput();
  const statusElement = { textContent: "" as string | null };
  const controller = createMicrophoneRecordingController({
    recordingSession: sessionHarness.session,
    armButton,
    recordButton,
    stopButton,
    auditionButton,
    retryButton,
    discardButton,
    keepButton,
    takeNameInput,
    statusElement,
    onTakeKept,
  });

  return {
    ...sessionHarness,
    controller,
    armButton,
    recordButton,
    stopButton,
    auditionButton,
    retryButton,
    discardButton,
    keepButton,
    takeNameInput,
    statusElement,
  };
}

tester.describe("microphone recording controller", () => {
  tester.it("drives record, audition, retry, and discard controls from shared state", async () => {
    const harness = createControllerHarness();
    harness.controller.init();
    tester.expect(harness.armButton.disabled).toBe(false);
    tester.expect(harness.recordButton.disabled).toBe(true);
    tester.expect(harness.stopButton.disabled).toBe(true);
    tester.expect(harness.auditionButton.hidden).toBe(true);
    tester.expect(harness.keepButton.hidden).toBe(true);
    tester.expect(harness.takeNameInput.hidden).toBe(true);

    await harness.armButton.click();
    tester.expect(harness.recordButton.disabled).toBe(false);
    tester.expect(harness.statusElement.textContent?.includes("current project position")).toBe(true);

    await harness.recordButton.click();
    tester.expect(harness.stopButton.disabled).toBe(false);
    tester.expect(harness.statusElement.textContent).toBe("Recording from Bar 2, Beat 4…");

    await harness.stopButton.click();
    tester.expect(harness.stopButton.disabled).toBe(true);
    tester.expect(harness.auditionButton.hidden).toBe(false);
    tester.expect(harness.retryButton.hidden).toBe(false);
    tester.expect(harness.discardButton.hidden).toBe(false);
    tester.expect(harness.keepButton.hidden).toBe(false);
    tester.expect(harness.takeNameInput.hidden).toBe(false);
    tester.expect(harness.takeNameInput.value).toBe("Recorded Take");
    tester.expect(harness.statusElement.textContent).toBe(
      "Take captured from Bar 2, Beat 4 · 4 project beats. Audition it, retry, discard it, or keep it as a project track.",
    );

    await harness.auditionButton.click();
    tester.expect(harness.auditionButton.textContent).toBe("Stop Audition");
    tester.expect(harness.statusElement.textContent?.endsWith("Auditioning…")).toBe(true);

    await harness.auditionButton.click();
    tester.expect(harness.auditionButton.textContent).toBe("Audition Take");

    await harness.retryButton.click();
    tester.expect(harness.recordButton.disabled).toBe(false);
    tester.expect(harness.auditionButton.hidden).toBe(true);

    await harness.recordButton.click();
    await harness.stopButton.click();
    await harness.discardButton.click();
    tester.expect(harness.armButton.disabled).toBe(false);
    tester.expect(harness.recordButton.disabled).toBe(true);
    tester.expect(harness.auditionButton.hidden).toBe(true);
    tester.expect(harness.statusElement.textContent).toBe("Enable your microphone to prepare a take.");

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

    harness.controller.destroy();
  });

  tester.it("keeps a named reviewed take and reports the saved track for project refresh", async () => {
    const refreshedTracks: string[] = [];
    const harness = createControllerHarness((track) => {
      refreshedTracks.push(track.id);
    });
    harness.controller.init();

    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();
    harness.takeNameInput.value = "Harmony Vocal";
    await harness.keepButton.click();

    tester.expect(harness.calls.at(-1)).toBe("keep:Harmony Vocal");
    tester.expect(refreshedTracks).toEqual(["recorded-track-1"]);
    tester.expect(harness.keepButton.hidden).toBe(true);
    tester.expect(harness.takeNameInput.hidden).toBe(true);
    tester.expect(harness.takeNameInput.value).toBe("");
    tester.expect(harness.statusElement.textContent).toBe(
      "“Harmony Vocal” saved as a project track. Enable your microphone to record another take.",
    );

    harness.controller.destroy();
  });
});
