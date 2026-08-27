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
    alignmentCompensationMilliseconds: 0,
  };
  let listener: ((next: MicrophoneRecordingSnapshot) => void) | null = null;
  const calls: string[] = [];

  function publish(next: MicrophoneRecordingSnapshot) {
    snapshot = next;
    listener?.(snapshot);
    return Promise.resolve(snapshot);
  }

  const session: MicrophoneRecordingSession = {
    restorePendingTake() {
      calls.push("restore-pending-take");
      return Promise.resolve(snapshot);
    },
    arm() {
      calls.push("arm");
      return publish({ ...snapshot, status: "ready", failure: null, savedTrack: null });
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

  return { session, calls, publish };
}

function createControllerHarness(onTakeKept?: (track: Track) => void | Promise<void>, useWorkspace = false) {
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
  const alignmentValueElement = { textContent: "" as string | null };
  const alignmentEarlier100Button = createButton();
  const alignmentEarlier10Button = createButton();
  const alignmentEarlier1Button = createButton();
  const alignmentResetButton = createButton();
  const alignmentLater1Button = createButton();
  const alignmentLater10Button = createButton();
  const alignmentLater100Button = createButton();
  const workspace = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener(_name: "cancel", _handler: (event: { preventDefault(): void }) => void) {},
  };
  const closeButton = createButton();
  const prepareRetryButton = createButton();
  const headingElement = { textContent: "" as string | null };
  const alignmentSection = { hidden: false };
  const reviewSection = { hidden: true };
  const hintElement = { hidden: false };
  const keepDialog = { ...workspace };
  const keepConfirmButton = createButton();
  const keepCancelButton = createButton();
  const keepStatusElement = { textContent: "" as string | null };
  const volumes: number[] = [];
  const phases: string[] = [];
  let volumeHandler = () => {};
  const auditionVolumeInput = {
    value: "100", disabled: true,
    addEventListener(_name: "input", handler: () => void) { volumeHandler = handler; },
    input(value: string) { this.value = value; volumeHandler(); },
  };
  const auditionVolumeValue = { textContent: "100%" };
  const controller = createMicrophoneRecordingController({
    ...(useWorkspace ? { workspace, closeButton, prepareRetryButton, headingElement, alignmentSection,
      reviewSection, hintElement, keepDialog, keepConfirmButton, keepCancelButton, keepStatusElement,
      auditionVolumeInput, auditionVolumeValue,
      onAuditionVolumeChanged: (volume: number) => { volumes.push(volume); },
      onPhaseChange: (status: string) => { phases.push(status); },
    } : {}),
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
    alignmentValueElement,
    alignmentNudgeControls: [
      { button: alignmentEarlier100Button, deltaMilliseconds: 100 },
      { button: alignmentEarlier10Button, deltaMilliseconds: 10 },
      { button: alignmentEarlier1Button, deltaMilliseconds: 1 },
      { button: alignmentLater1Button, deltaMilliseconds: -1 },
      { button: alignmentLater10Button, deltaMilliseconds: -10 },
      { button: alignmentLater100Button, deltaMilliseconds: -100 },
    ],
    alignmentResetButton,
    onTakeKept,
  });

  return {
    ...sessionHarness,
    workspace, closeButton, prepareRetryButton, headingElement, alignmentSection,
    reviewSection, hintElement, keepDialog, keepConfirmButton, keepCancelButton, keepStatusElement,
    auditionVolumeInput, auditionVolumeValue, volumes, phases,
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
  tester.it("discards an auditioned take into microphone-ready without closing or reacquiring", async () => {
    const h = createControllerHarness(undefined, true);
    h.controller.init();
    await h.armButton.click();
    await h.recordButton.click();
    await h.stopButton.click();
    await h.auditionButton.click();
    await h.discardButton.click();
    tester.expect(h.calls).toEqual(["arm", "start", "stop", "audition", "retry"]);
    tester.expect(h.session.getSnapshot().take).toBe(null);
    tester.expect(h.session.getSnapshot().takeReviewStatus).toBe("idle");
    tester.expect(h.session.getSnapshot().status).toBe("ready");
    tester.expect(h.workspace.open).toBe(true);
    tester.expect(h.headingElement.textContent).toBe("Microphone ready");
    tester.expect(h.prepareRetryButton.hidden).toBe(true);
    tester.expect(h.recordButton.disabled).toBe(false);
    tester.expect(h.reviewSection.hidden).toBe(true);
    await h.recordButton.click();
    tester.expect(h.session.getSnapshot().status).toBe("recording");
  });
  tester.it("presents focused recording then temporary review, volume and confirmation without prematurely saving", async () => {
    const h = createControllerHarness(undefined, true);
    h.controller.init();
    await h.armButton.click();
    await h.recordButton.click();
    tester.expect(h.headingElement.textContent).toBe("Recording…");
    tester.expect(h.recordButton.hidden).toBe(true);
    tester.expect(h.stopButton.hidden).toBe(false);
    tester.expect(h.reviewSection.hidden).toBe(true);
    tester.expect(h.hintElement.hidden).toBe(true);
    await h.stopButton.click();
    tester.expect(h.headingElement.textContent).toBe("Take review");
    tester.expect(h.statusElement.textContent?.includes("Not yet kept")).toBe(true);
    tester.expect(h.reviewSection.hidden).toBe(false);
    tester.expect(h.stopButton.hidden).toBe(true);
    h.auditionVolumeInput.input("35");
    tester.expect(h.volumes).toEqual([0.35]);
    tester.expect(h.auditionVolumeValue.textContent).toBe("35%");
    await h.auditionButton.click();
    tester.expect(h.headingElement.textContent).toBe("Auditioning temporary take");
    await h.auditionButton.click();
    await h.keepButton.click();
    tester.expect(h.keepDialog.open).toBe(true);
    tester.expect(h.calls).toEqual(["arm", "start", "stop", "audition", "stop-audition"]);
    await h.keepCancelButton.click();
    tester.expect(h.keepDialog.open).toBe(false);
    tester.expect(h.session.getSnapshot().take !== null).toBe(true);
    await h.keepButton.click();
    h.takeNameInput.value = "Vocal take";
    await h.keepConfirmButton.click();
    tester.expect(h.calls.at(-1)).toBe("keep:Vocal take");
    tester.expect(h.keepDialog.open).toBe(false);
    tester.expect(h.reviewSection.hidden).toBe(true);
    tester.expect(h.session.getSnapshot().savedTrack?.name).toBe("Vocal take");
    tester.expect(h.workspace.open).toBe(false);
    tester.expect(h.armButton.textContent).toBe("Open recording interface");
    tester.expect(h.session.getSnapshot().status).toBe("idle");
    tester.expect(h.recordButton.disabled).toBe(true);
    await h.armButton.click();
    tester.expect(h.workspace.open).toBe(true);
    tester.expect(h.headingElement.textContent).toBe("Microphone ready");
    tester.expect(h.calls.at(-1)).toBe("arm");
  });

  tester.it("reflects async start without a parallel countdown and returns to ready on Retry", async () => {
    const h = createControllerHarness(undefined, true);
    h.controller.init();
    await h.armButton.click();
    const start = h.session.start;
    let finish!: () => void;
    h.session.start = async () => { await new Promise<void>(resolve => { finish = resolve; }); return start(); };
    const pending = h.recordButton.click();
    tester.expect(h.recordButton.disabled).toBe(true);
    tester.expect(h.statusElement.textContent?.includes("count-in")).toBe(true);
    await h.recordButton.click();
    finish();
    await pending;
    await h.stopButton.click();
    await h.auditionButton.click();
    await h.retryButton.click();
    tester.expect(h.session.getSnapshot().take).toBe(null);
    tester.expect(h.session.getSnapshot().takeReviewStatus).toBe("idle");
    tester.expect(h.recordButton.disabled).toBe(false);
    tester.expect(h.reviewSection.hidden).toBe(true);
    tester.expect(h.calls).toEqual(["arm", "start", "stop", "audition", "retry"]);
    tester.expect(h.phases).toEqual(["ready", "recording", "stopped", "ready"]);
  });

  tester.it("locks confirmation while saving and keeps the draft and error available on upload failure", async () => {
    const h = createControllerHarness(undefined, true);
    h.controller.init();
    await h.armButton.click(); await h.recordButton.click(); await h.stopButton.click();
    await h.keepButton.click();
    await h.publish({ ...h.session.getSnapshot(), takeSaveStatus: "saving" });
    await h.keepCancelButton.click(); await h.closeButton.click();
    tester.expect(h.keepDialog.open).toBe(true);
    tester.expect(h.workspace.open).toBe(true);
    tester.expect(h.keepConfirmButton.disabled).toBe(true);
    tester.expect(h.auditionVolumeInput.disabled).toBe(true);
    await h.publish({ ...h.session.getSnapshot(), takeSaveStatus: "idle", takeSaveFailure: { message: "Upload failed" } });
    tester.expect(h.keepStatusElement.textContent).toBe("Upload failed");
    tester.expect(h.keepConfirmButton.disabled).toBe(false);
    tester.expect(h.session.getSnapshot().take !== null).toBe(true);
  });
  tester.it("toggles the inline recording body from the transport microphone button", async () => {
    const h = createControllerHarness(undefined, true);
    h.controller.init();
    await h.armButton.click();
    tester.expect(h.workspace.open).toBe(true);
    tester.expect(h.armButton.textContent).toBe("Close recording interface");
    await h.armButton.click();
    tester.expect(h.workspace.open).toBe(false);
    tester.expect(h.armButton.textContent).toBe("Open recording interface");
    tester.expect(h.calls).toEqual(["arm", "disarm"]);
    await h.armButton.click();
    tester.expect(h.workspace.open).toBe(true);
    tester.expect(h.calls).toEqual(["arm", "disarm", "arm"]);
  });
  tester.it("opens an already-ready session without reacquiring the microphone", async () => {
    const h = createControllerHarness(undefined, true);
    h.controller.init();
    await h.publish({ ...h.session.getSnapshot(), status: "ready" });
    await h.armButton.click();
    tester.expect(h.workspace.open).toBe(true);
    tester.expect(h.recordButton.disabled).toBe(false);
    tester.expect(h.calls).toEqual([]);
  });
  tester.it("opens the recording dialog only on entry, reaches ready, and releases on close", async () => {
    const h = createControllerHarness(undefined, true);
    h.controller.init();
    tester.expect(h.workspace.open).toBe(false);
    tester.expect(h.calls).toEqual([]);
    tester.expect(h.recordButton.disabled).toBe(true);
    await h.armButton.click();
    tester.expect(h.workspace.open).toBe(true);
    tester.expect(h.headingElement.textContent).toBe("Microphone ready");
    tester.expect(h.recordButton.disabled).toBe(false);
    tester.expect(h.alignmentSection.hidden).toBe(true);
    await h.closeButton.click();
    tester.expect(h.workspace.open).toBe(false);
    tester.expect(h.calls).toEqual(["arm", "disarm"]);
    await h.armButton.click();
    await h.recordButton.click();
    tester.expect(h.calls).toEqual(["arm", "disarm", "arm", "start"]);
    tester.expect(h.stopButton.hidden).toBe(false);
    await h.closeButton.click();
    tester.expect(h.workspace.open).toBe(true);
    await h.stopButton.click();
    tester.expect(h.auditionButton.hidden).toBe(false);
    tester.expect(h.alignmentSection.hidden).toBe(false);
    await h.closeButton.click();
    tester.expect(h.workspace.open).toBe(false);
    tester.expect(h.session.getSnapshot().status).toBe("stopped");
    await h.armButton.click();
    tester.expect(h.workspace.open).toBe(true);
    tester.expect(h.session.getSnapshot().status).toBe("stopped");
  });

  tester.it("closes pending permission safely and releases a late microphone acquisition", async () => {
    const h = createControllerHarness(undefined, true);
    let complete!: () => void;
    h.session.arm = async () => {
      await h.publish({ ...h.session.getSnapshot(), status: "requesting-permission" });
      await new Promise<void>((resolve) => { complete = resolve; });
      return h.publish({ ...h.session.getSnapshot(), status: "ready" });
    };
    h.controller.init();
    const pending = h.armButton.click();
    tester.expect(h.headingElement.textContent).toBe("Preparing microphone…");
    tester.expect(h.recordButton.disabled).toBe(true);
    await h.closeButton.click();
    tester.expect(h.workspace.open).toBe(false);
    complete();
    await pending;
    tester.expect(h.session.getSnapshot().status).toBe("idle");
    tester.expect(h.calls).toEqual(["disarm"]);
  });

  tester.it("shows preparation failures with retry and close without starting a take", async () => {
    const h = createControllerHarness(undefined, true);
    const arm = h.session.arm;
    h.session.arm = () => h.publish({ ...h.session.getSnapshot(), status: "failed", failure: { code: "permission-denied", message: "Microphone permission was denied." } });
    h.controller.init();
    await h.armButton.click();
    tester.expect(h.workspace.open).toBe(true);
    tester.expect(h.statusElement.textContent).toBe("Microphone permission was denied.");
    tester.expect(h.prepareRetryButton.hidden).toBe(false);
    tester.expect(h.recordButton.disabled).toBe(true);
    h.session.arm = arm;
    await h.prepareRetryButton.click();
    tester.expect(h.headingElement.textContent).toBe("Microphone ready");
    tester.expect(h.calls).toEqual(["arm"]);
  });
  tester.it("toggles a prepared microphone back to idle through the same control", async () => {
    const harness = createControllerHarness();
    harness.controller.init();

    tester.expect(harness.armButton.textContent).toBe("Enable Microphone");
    tester.expect(harness.calls).toEqual([]);

    await harness.armButton.click();
    tester.expect(harness.armButton.disabled).toBe(false);
    tester.expect(harness.armButton.textContent).toBe("Disable Microphone");
    tester.expect(harness.recordButton.disabled).toBe(false);
    tester.expect(harness.recordButton.textContent).toBe("Record Take");

    await harness.armButton.click();
    tester.expect(harness.armButton.textContent).toBe("Enable Microphone");
    tester.expect(harness.recordButton.disabled).toBe(true);
    tester.expect(harness.statusElement.textContent).toBe(
      "Enable your microphone to prepare a take.",
    );
    tester.expect(harness.calls).toEqual(["arm", "disarm"]);

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
    tester.expect(harness.recordButton.disabled).toBe(false);
    tester.expect(harness.auditionButton.hidden).toBe(true);
    tester.expect(harness.session.getSnapshot().status).toBe("ready");

    tester.expect(harness.calls).toEqual([
      "arm",
      "start",
      "stop",
      "audition",
      "stop-audition",
      "retry",
      "start",
      "stop",
      "retry",
    ]);

    harness.controller.destroy();
  });

  tester.it("offers fine and coarse signed alignment nudges and re-auditions immediately", async () => {
    const harness = createControllerHarness();
    harness.controller.init();

    tester.expect(harness.alignmentValueElement.textContent).toBe("0 ms");
    await harness.alignmentEarlier100Button.click();
    tester.expect(harness.alignmentValueElement.textContent).toBe("100 ms earlier");
    await harness.alignmentLater10Button.click();
    tester.expect(harness.alignmentValueElement.textContent).toBe("90 ms earlier");

    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();
    await harness.auditionButton.click();
    await harness.alignmentEarlier1Button.click();

    tester.expect(harness.calls.slice(-3)).toEqual([
      "stop-audition",
      "alignment:adjust:1",
      "audition",
    ]);
    tester.expect(harness.alignmentValueElement.textContent).toBe("91 ms earlier");

    await harness.alignmentResetButton.click();
    tester.expect(harness.alignmentValueElement.textContent).toBe("0 ms");
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
