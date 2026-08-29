import type {
  MicrophoneRecordingSession,
  MicrophoneRecordingSnapshot,
  Track,
} from "@hugovela/frontend-core";
import { createMicrophoneRecordingController } from "../src/page-controllers/microphone-recording-controller.js";
import { tester } from "./test-runner/tester.js";

function createButton() {
  let clickHandler: (() => void | Promise<void>) | null = null;
  const attributes = new Map<string, string>();

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
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
    async click() {
      await clickHandler?.();
    },
  };
}

function createInput(value = "") {
  return {
    disabled: false,
    hidden: false,
    value,
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
      mediaLeadInSeconds: 2.43,
    },
    alignmentCompensationMilliseconds: 0,
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

function createSessionHarness({ deferArm = false }: { deferArm?: boolean } = {}) {
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
    alignmentCompensationMilliseconds: 0,
  };
  let listener: ((next: MicrophoneRecordingSnapshot) => void) | null = null;
  let resolveDeferredArm: (() => void) | null = null;
  const calls: string[] = [];

  function publishSync(next: MicrophoneRecordingSnapshot) {
    snapshot = next;
    listener?.(snapshot);
    return snapshot;
  }

  function publish(next: MicrophoneRecordingSnapshot) {
    return Promise.resolve(publishSync(next));
  }

  function readySnapshot(): MicrophoneRecordingSnapshot {
    return {
      ...snapshot,
      status: "ready",
      failure: null,
      savedTrack: null,
    };
  }

  const session: MicrophoneRecordingSession = {
    restorePendingTake() {
      calls.push("restore-pending-take");
      return Promise.resolve(snapshot);
    },
    arm() {
      calls.push("arm");
      publishSync({
        ...snapshot,
        status: "requesting-permission",
        failure: null,
        savedTrack: null,
      });

      if (deferArm) {
        return new Promise<MicrophoneRecordingSnapshot>((resolve) => {
          resolveDeferredArm = () => resolve(publishSync(readySnapshot()));
        });
      }

      return publish(readySnapshot());
    },
    disarm() {
      calls.push("disarm");
      return publish({
        ...snapshot,
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
            musicalPosition: { bar: 2, beat: 4 },
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
        alignmentCompensationMilliseconds: snapshot.alignmentCompensationMilliseconds,
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
        alignmentCompensationMilliseconds: snapshot.alignmentCompensationMilliseconds,
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
        alignmentCompensationMilliseconds: snapshot.alignmentCompensationMilliseconds,
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
        alignmentCompensationMilliseconds: snapshot.alignmentCompensationMilliseconds,
      });
    },
    setAlignmentCompensationMilliseconds(value) {
      calls.push(`alignment:set:${value}`);
      snapshot = { ...snapshot, alignmentCompensationMilliseconds: value };
      listener?.(snapshot);
      return snapshot;
    },
    adjustAlignmentCompensationMilliseconds(delta) {
      calls.push(`alignment:adjust:${delta}`);
      snapshot = {
        ...snapshot,
        alignmentCompensationMilliseconds:
          snapshot.alignmentCompensationMilliseconds + delta,
      };
      listener?.(snapshot);
      return snapshot;
    },
    resetAlignmentCompensation() {
      calls.push("alignment:reset");
      snapshot = { ...snapshot, alignmentCompensationMilliseconds: 0 };
      listener?.(snapshot);
      return snapshot;
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
        alignmentCompensationMilliseconds: snapshot.alignmentCompensationMilliseconds,
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

  return {
    session,
    calls,
    publishSnapshot(next: MicrophoneRecordingSnapshot) {
      return publishSync(next);
    },
    getSnapshot() {
      return snapshot;
    },
    resolveArmReady() {
      resolveDeferredArm?.();
      resolveDeferredArm = null;
    },
  };
}

type ControllerHarnessOptions = {
  onTakeKept?: (track: Track) => void | Promise<void>;
  deferArm?: boolean;
  initialStartPosition?: { bar: number; beat: number };
  beatsPerBar?: number;
};

function createControllerHarness({
  onTakeKept,
  deferArm = false,
  initialStartPosition = { bar: 6, beat: 3 },
  beatsPerBar = 4,
}: ControllerHarnessOptions = {}) {
  const sessionHarness = createSessionHarness({ deferArm });
  const armButton = createButton();
  const workspaceElement = {
    hidden: true,
    attributes: new Map<string, string>(),
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    },
  };
  const preparingViewElement = { hidden: true };
  const readyViewElement = { hidden: true };
  const failureViewElement = { hidden: true };
  const legacyViewElement = { hidden: true };
  const preparingCloseButton = createButton();
  const cancelButton = createButton();
  const permissionRetryButton = createButton();
  const recordButton = createButton();
  const stopButton = createButton();
  const auditionButton = createButton();
  const retryButton = createButton();
  const discardButton = createButton();
  const keepButton = createButton();
  const takeNameInput = createInput();
  const statusElement = { textContent: "" as string | null };
  const failureHeadingElement = { textContent: "" as string | null };
  const failureMessageElement = { textContent: "" as string | null };
  const startPositionButton = createButton();
  const startPositionLabelElement = { textContent: "" as string | null };
  const startPositionEditorElement = { hidden: true };
  const startBarInput = createInput("1");
  const startBeatInput = createInput("1");
  const startPositionApplyButton = createButton();
  const startPositionStatusElement = { textContent: "" as string | null };
  const selectedPositions: { bar: number; beat: number }[] = [];
  const preparedPositions: { bar: number; beat: number }[] = [];
  const alignmentValueElement = { textContent: "" as string | null };
  const alignmentEarlier100Button = createButton();
  const alignmentEarlier10Button = createButton();
  const alignmentEarlier1Button = createButton();
  const alignmentResetButton = createButton();
  const alignmentLater1Button = createButton();
  const alignmentLater10Button = createButton();
  const alignmentLater100Button = createButton();
  const controller = createMicrophoneRecordingController({
    recordingSession: sessionHarness.session,
    armButton,
    workspaceElement,
    preparingViewElement,
    readyViewElement,
    failureViewElement,
    legacyViewElement,
    cancelButtons: [preparingCloseButton, cancelButton],
    permissionRetryButton,
    recordButton,
    stopButton,
    auditionButton,
    retryButton,
    discardButton,
    keepButton,
    takeNameInput,
    statusElement,
    failureHeadingElement,
    failureMessageElement,
    startPositionButton,
    startPositionLabelElement,
    startPositionEditorElement,
    startBarInput,
    startBeatInput,
    startPositionApplyButton,
    startPositionStatusElement,
    beatsPerBar,
    getRecordingStartPosition: () => ({ ...initialStartPosition }),
    setRecordingStartPosition(position) {
      selectedPositions.push({ ...position });
      return true;
    },
    prepareRecordingStart(position) {
      preparedPositions.push({ ...position });
      return true;
    },
    alignmentValueElement,
    alignmentNudgeControls: [
      { button: alignmentEarlier100Button, deltaMilliseconds: -100 },
      { button: alignmentEarlier10Button, deltaMilliseconds: -10 },
      { button: alignmentEarlier1Button, deltaMilliseconds: -1 },
      { button: alignmentLater1Button, deltaMilliseconds: 1 },
      { button: alignmentLater10Button, deltaMilliseconds: 10 },
      { button: alignmentLater100Button, deltaMilliseconds: 100 },
    ],
    alignmentResetButton,
    onTakeKept,
  });

  return {
    ...sessionHarness,
    controller,
    armButton,
    workspaceElement,
    preparingViewElement,
    readyViewElement,
    failureViewElement,
    legacyViewElement,
    preparingCloseButton,
    cancelButton,
    permissionRetryButton,
    recordButton,
    stopButton,
    auditionButton,
    retryButton,
    discardButton,
    keepButton,
    takeNameInput,
    statusElement,
    failureHeadingElement,
    failureMessageElement,
    startPositionButton,
    startPositionLabelElement,
    startPositionEditorElement,
    startBarInput,
    startBeatInput,
    startPositionApplyButton,
    startPositionStatusElement,
    selectedPositions,
    preparedPositions,
    alignmentValueElement,
    alignmentEarlier100Button,
    alignmentEarlier10Button,
    alignmentEarlier1Button,
    alignmentResetButton,
    alignmentLater1Button,
    alignmentLater10Button,
    alignmentLater100Button,
  };
}

tester.describe("microphone recording controller", () => {
  tester.it("opens the workflow, renders Ready, and disarms when the workflow closes", async () => {
    const harness = createControllerHarness();
    harness.controller.init();

    tester.expect(harness.armButton.textContent).toBe("Enable Microphone");

    await harness.armButton.click();
    tester.expect(harness.workspaceElement.hidden).toBe(false);
    tester.expect(harness.preparingViewElement.hidden).toBe(true);
    tester.expect(harness.readyViewElement.hidden).toBe(false);
    tester.expect(harness.armButton.disabled).toBe(false);
    tester.expect(harness.armButton.textContent).toBe("Disable Microphone");
    tester.expect(harness.recordButton.disabled).toBe(false);
    tester.expect(harness.startPositionLabelElement.textContent).toBe("Start at Bar 6 · Beat 3");

    await harness.armButton.click();
    tester.expect(harness.workspaceElement.hidden).toBe(true);
    tester.expect(harness.armButton.textContent).toBe("Enable Microphone");
    tester.expect(harness.recordButton.disabled).toBe(true);
    tester.expect(harness.statusElement.textContent).toBe(
      "Enable your microphone to prepare a take.",
    );
    tester.expect(harness.calls).toEqual(["arm", "disarm"]);

    harness.controller.destroy();
  });

  tester.it("shows Preparing while permission is pending and releases a late grant after Cancel", async () => {
    const harness = createControllerHarness({ deferArm: true });
    harness.controller.init();

    const openPromise = harness.armButton.click();
    tester.expect(harness.getSnapshot().status).toBe("requesting-permission");
    tester.expect(harness.workspaceElement.hidden).toBe(false);
    tester.expect(harness.preparingViewElement.hidden).toBe(false);
    tester.expect(harness.readyViewElement.hidden).toBe(true);

    await harness.cancelButton.click();
    tester.expect(harness.workspaceElement.hidden).toBe(true);

    harness.resolveArmReady();
    await openPromise;

    tester.expect(harness.getSnapshot().status).toBe("idle");
    tester.expect(harness.workspaceElement.hidden).toBe(true);
    tester.expect(harness.calls).toEqual(["arm", "disarm"]);

    harness.controller.destroy();
  });

  tester.it("renders permission-denied recovery and retries through the shared arm path", async () => {
    const harness = createControllerHarness();
    harness.controller.init();

    harness.publishSnapshot({
      ...harness.getSnapshot(),
      status: "failed",
      failure: {
        code: "permission-denied",
        message: "Permission denied by browser.",
      },
    });

    tester.expect(harness.workspaceElement.hidden).toBe(false);
    tester.expect(harness.failureViewElement.hidden).toBe(false);
    tester.expect(harness.failureHeadingElement.textContent).toBe("Microphone access needed");
    tester.expect(harness.failureMessageElement.textContent).toBe(
      "Allow microphone access in your browser settings, then try again.",
    );

    await harness.permissionRetryButton.click();
    tester.expect(harness.getSnapshot().status).toBe("ready");
    tester.expect(harness.readyViewElement.hidden).toBe(false);
    tester.expect(harness.calls).toEqual(["arm"]);

    harness.controller.destroy();
  });

  tester.it("lets Ready adjust the sticky start Bar/Beat and prepares transport before shared start", async () => {
    const harness = createControllerHarness({
      initialStartPosition: { bar: 6, beat: 3 },
      beatsPerBar: 4,
    });
    harness.controller.init();
    await harness.armButton.click();

    await harness.startPositionButton.click();
    tester.expect(harness.startPositionEditorElement.hidden).toBe(false);
    tester.expect(harness.startPositionButton.getAttribute("aria-expanded")).toBe("true");

    harness.startBarInput.value = "8";
    harness.startBeatInput.value = "2";
    await harness.startPositionApplyButton.click();

    tester.expect(harness.startPositionLabelElement.textContent).toBe("Start at Bar 8 · Beat 2");
    tester.expect(harness.startPositionEditorElement.hidden).toBe(true);
    tester.expect(harness.selectedPositions).toEqual([{ bar: 8, beat: 2 }]);

    await harness.recordButton.click();
    tester.expect(harness.preparedPositions).toEqual([{ bar: 8, beat: 2 }]);
    tester.expect(harness.calls.slice(-1)).toEqual(["start"]);
    tester.expect(harness.legacyViewElement.hidden).toBe(false);

    harness.controller.destroy();
  });

  tester.it("rejects a Ready beat outside the project meter before recording starts", async () => {
    const harness = createControllerHarness({ beatsPerBar: 4 });
    harness.controller.init();
    await harness.armButton.click();

    await harness.startPositionButton.click();
    harness.startBarInput.value = "9";
    harness.startBeatInput.value = "5";
    await harness.recordButton.click();

    tester.expect(harness.preparedPositions).toEqual([]);
    tester.expect(harness.calls.includes("start")).toBe(false);
    tester.expect(harness.startPositionEditorElement.hidden).toBe(false);
    tester.expect(harness.startPositionStatusElement.textContent).toBe(
      "Beat must be a whole number from 1 to 4.",
    );

    harness.controller.destroy();
  });

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
    tester.expect(harness.statusElement.textContent).toBe(
      "Microphone ready. Capture will become active before project playback starts.",
    );

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
      "Take captured from Bar 2, Beat 4 · 4 project beats. Audition it, adjust alignment if needed, retry, discard it, or keep it as a project track.",
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

  tester.it("offers fine and coarse signed alignment nudges and re-auditions immediately", async () => {
    const harness = createControllerHarness();
    harness.controller.init();

    tester.expect(harness.alignmentValueElement.textContent).toBe("0 ms");
    await harness.alignmentEarlier100Button.click();
    tester.expect(harness.alignmentValueElement.textContent).toBe("-100 ms earlier");
    await harness.alignmentLater10Button.click();
    tester.expect(harness.alignmentValueElement.textContent).toBe("-90 ms earlier");

    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();
    await harness.auditionButton.click();
    await harness.alignmentEarlier1Button.click();

    tester.expect(harness.calls.slice(-3)).toEqual([
      "stop-audition",
      "alignment:adjust:-1",
      "audition",
    ]);
    tester.expect(harness.alignmentValueElement.textContent).toBe("-91 ms earlier");

    await harness.alignmentResetButton.click();
    tester.expect(harness.alignmentValueElement.textContent).toBe("0 ms");
  });

  tester.it("keeps a named reviewed take and reports the saved track for project refresh", async () => {
    const refreshedTracks: string[] = [];
    const harness = createControllerHarness({
      onTakeKept(track) {
        refreshedTracks.push(track.id);
      },
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
