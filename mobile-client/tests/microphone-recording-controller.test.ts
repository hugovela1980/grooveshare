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
  type KeyEvent = { key: string; preventDefault(): void };

  return {
    disabled: false,
    hidden: false,
    textContent: "",
    focusCalls: 0,
    onkeydown: null as ((event: KeyEvent) => void) | null,
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
    focus() {
      this.focusCalls += 1;
    },
    async click() {
      await clickHandler?.();
    },
    keydown(key: string) {
      let prevented = false;
      this.onkeydown?.({
        key,
        preventDefault() {
          prevented = true;
        },
      });
      return prevented;
    },
  };
}

function createRangeInput(value = "100") {
  let inputHandler: (() => void) | null = null;
  return {
    disabled: false,
    value,
    addEventListener(eventName: "input", handler: () => void) {
      if (eventName === "input") inputHandler = handler;
    },
    input() {
      inputHandler?.();
    },
  };
}

function createReviewMixTrackList() {
  type ReviewMixTarget = {
    dataset?: Record<string, string | undefined>;
    value?: string;
    checked?: boolean;
  };
  let inputHandler: ((event: { target?: ReviewMixTarget | null }) => void) | null = null;
  const valueElements = new Map<number, { textContent: string | null }>();

  return {
    innerHTML: "",
    addEventListener(
      eventName: "input" | "change",
      handler: (event: { target?: ReviewMixTarget | null }) => void,
    ) {
      if (eventName === "input") inputHandler = handler;
    },
    querySelector(selector: string) {
      const channelNumber = Number(selector.match(/data-review-channel="(\d+)"/)?.[1]);
      if (!Number.isFinite(channelNumber)) return null;
      let element = valueElements.get(channelNumber);
      if (!element) {
        element = { textContent: null };
        valueElements.set(channelNumber, element);
      }
      return element;
    },
    input(target: ReviewMixTarget) {
      inputHandler?.({ target });
    },
    getValue(channelNumber: number) {
      return valueElements.get(channelNumber)?.textContent ?? null;
    },
  };
}

function createDialog() {
  let cancelHandler: ((event: { preventDefault(): void }) => void) | null = null;
  return {
    open: false,
    showModalCalls: 0,
    closeCalls: 0,
    showModal() {
      this.open = true;
      this.showModalCalls += 1;
    },
    close() {
      this.open = false;
      this.closeCalls += 1;
    },
    addEventListener(
      eventName: "cancel",
      handler: (event: { preventDefault(): void }) => void,
    ) {
      if (eventName === "cancel") cancelHandler = handler;
    },
    cancel() {
      let prevented = false;
      cancelHandler?.({ preventDefault() { prevented = true; } });
      return prevented;
    },
  };
}

function createInput(value = "") {
  return {
    disabled: false,
    hidden: false,
    value,
    focusCalls: 0,
    selectCalls: 0,
    focus() {
      this.focusCalls += 1;
    },
    select() {
      this.selectCalls += 1;
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

function createSessionHarness({
  deferArm = false,
  keepFailure = null,
}: {
  deferArm?: boolean;
  keepFailure?: string | null;
} = {}) {
  let snapshot: MicrophoneRecordingSnapshot = {
    status: "idle",
    countIn: null,
    elapsedRecordingSeconds: 0,
    capture: null,
    startPosition: null,
    take: null,
    failure: null,
    takeReviewStatus: "idle",
    takeReviewFailure: null,
    takeSaveStatus: "idle",
    takeSaveFailure: null,
    savedTrack: null,
    takeRecoveryStatus: "idle",
    takeRecoveryFailure: null,
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
        status: "count-in",
        countIn: {
          bars: 1,
          totalBeats: 4,
          currentBeat: 1,
          durationSeconds: 2,
        },
        elapsedRecordingSeconds: 0,
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
    cancelCountIn() {
      calls.push("cancel-count-in");
      return publish({
        ...snapshot,
        status: "ready",
        countIn: null,
        elapsedRecordingSeconds: 0,
        capture: null,
        startPosition: null,
        take: null,
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
        takeRecoveryStatus: "idle",
        takeRecoveryFailure: null,
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
        takeRecoveryStatus: "idle",
        takeRecoveryFailure: null,
        alignmentCompensationMilliseconds: snapshot.alignmentCompensationMilliseconds,
      });
    },
    discard() {
      calls.push("discard");
      return publish({
        status: "idle",
        countIn: null,
        elapsedRecordingSeconds: 0,
        capture: null,
        startPosition: null,
        take: null,
        failure: null,
        takeReviewStatus: "idle",
        takeReviewFailure: null,
        takeSaveStatus: "idle",
        takeSaveFailure: null,
        savedTrack: null,
        takeRecoveryStatus: "idle",
        takeRecoveryFailure: null,
        alignmentCompensationMilliseconds: snapshot.alignmentCompensationMilliseconds,
      });
    },
    keep(trackName) {
      calls.push(`keep:${trackName}`);
      if (keepFailure) {
        return publish({
          ...snapshot,
          status: "stopped",
          takeSaveStatus: "idle",
          takeSaveFailure: { message: keepFailure },
          savedTrack: null,
        });
      }
      return publish({
        status: "idle",
        countIn: null,
        elapsedRecordingSeconds: 0,
        capture: null,
        startPosition: null,
        take: null,
        failure: null,
        takeReviewStatus: "idle",
        takeReviewFailure: null,
        takeSaveStatus: "idle",
        takeSaveFailure: null,
        savedTrack: createSavedTrack(trackName.trim()),
        takeRecoveryStatus: "idle",
        takeRecoveryFailure: null,
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
        countIn: null,
        elapsedRecordingSeconds: 0,
        capture: null,
        startPosition: null,
        take: null,
        failure: null,
        takeReviewStatus: "idle",
        takeReviewFailure: null,
        takeSaveStatus: "idle",
        takeSaveFailure: null,
        savedTrack: null,
        takeRecoveryStatus: "idle",
        takeRecoveryFailure: null,
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
  prepareRecordingStartResult?: boolean;
  keepFailure?: string | null;
  projectPlaybackMix?: Array<{
    channelNumber: number;
    trackId: string;
    name: string;
    volume: number;
    enabled: boolean;
  }>;
};

function createControllerHarness({
  onTakeKept,
  deferArm = false,
  initialStartPosition = { bar: 6, beat: 3 },
  beatsPerBar = 4,
  prepareRecordingStartResult = true,
  keepFailure = null,
  projectPlaybackMix = [
    { channelNumber: 1, trackId: "bass", name: "Bass", volume: 0.75, enabled: true },
    { channelNumber: 2, trackId: "vocal", name: "Vocal", volume: 0.72, enabled: false },
  ],
}: ControllerHarnessOptions = {}) {
  const sessionHarness = createSessionHarness({ deferArm, keepFailure });
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
  const recoveryViewElement = { hidden: true };
  const countInViewElement = { hidden: true };
  const activeRecordingViewElement = { hidden: true };
  const processingViewElement = { hidden: true };
  const reviewViewElement = { hidden: true };
  const reviewCloseButton = createButton();
  const preparingCloseButton = createButton();
  const cancelButton = createButton();
  const permissionRetryButton = createButton();
  const countInCancelButton = createButton();
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
  const recoveryHeadingElement = { textContent: "" as string | null };
  const recoveryMessageElement = { textContent: "" as string | null };
  const recoveryRetryButton = createButton();
  const startPositionButton = createButton();
  const startPositionLabelElement = { textContent: "" as string | null };
  const startPositionEditorElement = { hidden: true };
  const startBarInput = createInput("1");
  const startBeatInput = createInput("1");
  const startPositionApplyButton = createButton();
  const startPositionStatusElement = { textContent: "" as string | null };
  const recordingStartStatusElement = { textContent: "" as string | null };
  const countInNumberElement = { textContent: "" as string | null };
  const countInBeatsElement = {
    innerHTML: "",
    attributes: new Map<string, string>(),
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    },
  };
  const countInPositionElement = { textContent: "" as string | null };
  const recordingElapsedElement = { textContent: "" as string | null };
  const recordingPositionElement = { textContent: "" as string | null };
  const reviewHeadingElement = {
    textContent: "" as string | null,
    focusCount: 0,
    focus() {
      this.focusCount += 1;
    },
  };
  const reviewRecoveredElement = { hidden: true };
  const reviewPositionElement = { textContent: "" as string | null };
  const reviewDurationElement = { textContent: "" as string | null };
  const reviewTimelineElement = {
    attributes: new Map<string, string>(),
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    },
  };
  const reviewStatusElement = { textContent: "" as string | null };
  const alignmentTabButton = createButton();
  const playbackMixTabButton = createButton();
  const alignmentTabPanel = { hidden: false };
  const playbackMixTabPanel = { hidden: true };
  const reviewMixTrackListElement = createReviewMixTrackList();
  const appliedReviewPlaybackMixes: typeof projectPlaybackMix[] = [];
  let restoreProjectPlaybackMixCalls = 0;
  const auditionVolumeInput = createRangeInput();
  const auditionVolumeValueElement = { textContent: "100%" as string | null };
  const auditionVolumes: number[] = [];
  const selectedPositions: { bar: number; beat: number }[] = [];
  const preparedPositions: { bar: number; beat: number }[] = [];
  let playbackReadinessListener: ((ready: boolean) => void) | null = null;
  const alignmentValueElement = { textContent: "" as string | null };
  const alignmentSummaryElement = { textContent: "" as string | null };
  const alignmentEarlier100Button = createButton();
  const alignmentEarlier10Button = createButton();
  const alignmentEarlier1Button = createButton();
  const alignmentResetButton = createButton();
  const alignmentLater1Button = createButton();
  const alignmentLater10Button = createButton();
  const alignmentLater100Button = createButton();
  const keepDialog = createDialog();
  const keepConfirmButton = createButton();
  const keepCancelButton = createButton();
  const keepMetadataElement = { textContent: "" as string | null };
  const keepStatusElement = { textContent: "" as string | null };
  const discardDialog = createDialog();
  const discardConfirmButton = createButton();
  const discardCancelButton = createButton();
  const discardStatusElement = { textContent: "" as string | null };
  const controller = createMicrophoneRecordingController({
    recordingSession: sessionHarness.session,
    armButton,
    workspaceElement,
    preparingViewElement,
    readyViewElement,
    failureViewElement,
    recoveryViewElement,
    countInViewElement,
    activeRecordingViewElement,
    processingViewElement,
    reviewViewElement,
    reviewCloseButton,
    cancelButtons: [preparingCloseButton, cancelButton],
    permissionRetryButton,
    countInCancelButton,
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
    recoveryHeadingElement,
    recoveryMessageElement,
    recoveryRetryButton,
    startPositionButton,
    startPositionLabelElement,
    startPositionEditorElement,
    startBarInput,
    startBeatInput,
    startPositionApplyButton,
    startPositionStatusElement,
    recordingStartStatusElement,
    countInNumberElement,
    countInBeatsElement,
    countInPositionElement,
    recordingElapsedElement,
    recordingPositionElement,
    reviewHeadingElement,
    reviewRecoveredElement,
    reviewPositionElement,
    reviewDurationElement,
    reviewTimelineElement,
    reviewStatusElement,
    alignmentTabButton,
    playbackMixTabButton,
    alignmentTabPanel,
    playbackMixTabPanel,
    reviewMixTrackListElement,
    getProjectPlaybackMix: () => projectPlaybackMix.map((channel) => ({ ...channel })),
    applyReviewPlaybackMix(channels) {
      appliedReviewPlaybackMixes.push(channels.map((channel) => ({ ...channel })));
      return true;
    },
    restoreProjectPlaybackMix() {
      restoreProjectPlaybackMixCalls += 1;
    },
    auditionVolumeInput,
    auditionVolumeValueElement,
    onAuditionVolumeChanged(volume) {
      auditionVolumes.push(volume);
    },
    beatsPerBar,
    getRecordingStartPosition: () => ({ ...initialStartPosition }),
    setRecordingStartPosition(position) {
      selectedPositions.push({ ...position });
      return true;
    },
    prepareRecordingStart(position) {
      preparedPositions.push({ ...position });
      return prepareRecordingStartResult;
    },
    subscribePlaybackReadiness(listener) {
      playbackReadinessListener = listener;
      return () => {
        playbackReadinessListener = null;
      };
    },
    alignmentValueElement,
    alignmentSummaryElement,
    alignmentNudgeControls: [
      { button: alignmentEarlier100Button, deltaMilliseconds: -100 },
      { button: alignmentEarlier10Button, deltaMilliseconds: -10 },
      { button: alignmentEarlier1Button, deltaMilliseconds: -1 },
      { button: alignmentLater1Button, deltaMilliseconds: 1 },
      { button: alignmentLater10Button, deltaMilliseconds: 10 },
      { button: alignmentLater100Button, deltaMilliseconds: 100 },
    ],
    alignmentResetButton,
    keepDialog,
    keepConfirmButton,
    keepCancelButton,
    keepMetadataElement,
    keepStatusElement,
    discardDialog,
    discardConfirmButton,
    discardCancelButton,
    discardStatusElement,
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
    recoveryViewElement,
    countInViewElement,
    activeRecordingViewElement,
    processingViewElement,
    reviewViewElement,
    reviewCloseButton,
    preparingCloseButton,
    cancelButton,
    permissionRetryButton,
    countInCancelButton,
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
    recoveryHeadingElement,
    recoveryMessageElement,
    recoveryRetryButton,
    startPositionButton,
    startPositionLabelElement,
    startPositionEditorElement,
    startBarInput,
    startBeatInput,
    startPositionApplyButton,
    startPositionStatusElement,
    recordingStartStatusElement,
    countInNumberElement,
    countInBeatsElement,
    countInPositionElement,
    recordingElapsedElement,
    recordingPositionElement,
    reviewHeadingElement,
    reviewRecoveredElement,
    reviewPositionElement,
    reviewDurationElement,
    reviewTimelineElement,
    reviewStatusElement,
    alignmentTabButton,
    playbackMixTabButton,
    alignmentTabPanel,
    playbackMixTabPanel,
    reviewMixTrackListElement,
    appliedReviewPlaybackMixes,
    getRestoreProjectPlaybackMixCalls() {
      return restoreProjectPlaybackMixCalls;
    },
    auditionVolumeInput,
    auditionVolumeValueElement,
    auditionVolumes,
    selectedPositions,
    preparedPositions,
    publishPlaybackReadiness(ready: boolean) {
      playbackReadinessListener?.(ready);
    },
    alignmentValueElement,
    alignmentSummaryElement,
    alignmentEarlier100Button,
    alignmentEarlier10Button,
    alignmentEarlier1Button,
    alignmentResetButton,
    alignmentLater1Button,
    alignmentLater10Button,
    alignmentLater100Button,
    keepDialog,
    keepConfirmButton,
    keepCancelButton,
    keepMetadataElement,
    keepStatusElement,
    discardDialog,
    discardConfirmButton,
    discardCancelButton,
    discardStatusElement,
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
    tester.expect(harness.countInViewElement.hidden).toBe(false);
    tester.expect(harness.reviewViewElement.hidden).toBe(true);

    harness.controller.destroy();
  });

  tester.it("renders shared count-in progress and Cancel returns to Ready", async () => {
    const harness = createControllerHarness();
    harness.controller.init();
    await harness.armButton.click();
    await harness.recordButton.click();

    tester.expect(harness.countInViewElement.hidden).toBe(false);
    tester.expect(harness.countInNumberElement.textContent).toBe("1");
    tester.expect(
      harness.countInBeatsElement.innerHTML.includes('class="is-active"'),
    ).toBe(true);
    tester.expect(harness.countInPositionElement.textContent).toBe(
      "Recording starts at Bar 6 · Beat 3",
    );

    harness.publishSnapshot({
      ...harness.getSnapshot(),
      countIn: {
        bars: 1,
        totalBeats: 4,
        currentBeat: 3,
        durationSeconds: 2,
      },
    });
    tester.expect(harness.countInNumberElement.textContent).toBe("3");
    tester.expect(
      harness.countInBeatsElement.attributes.get("aria-label"),
    ).toBe("Count-in beat 3 of 4");

    await harness.countInCancelButton.click();
    tester.expect(harness.getSnapshot().status).toBe("ready");
    tester.expect(harness.readyViewElement.hidden).toBe(false);
    tester.expect(harness.countInViewElement.hidden).toBe(true);
    tester.expect(harness.startPositionLabelElement.textContent).toBe(
      "Start at Bar 6 · Beat 3",
    );
    tester.expect(harness.calls.slice(-1)).toEqual(["cancel-count-in"]);
  });

  tester.it("renders authoritative recording duration and Processing before stopped review", async () => {
    const harness = createControllerHarness();
    harness.controller.init();
    await harness.armButton.click();
    await harness.recordButton.click();

    harness.publishSnapshot({
      ...harness.getSnapshot(),
      status: "recording",
      elapsedRecordingSeconds: 78.9,
    });
    tester.expect(harness.activeRecordingViewElement.hidden).toBe(false);
    tester.expect(harness.recordingElapsedElement.textContent).toBe("01:18");
    tester.expect(harness.recordingPositionElement.textContent).toBe(
      "From Bar 2 · Beat 4",
    );
    tester.expect(harness.stopButton.disabled).toBe(false);

    harness.publishSnapshot({
      ...harness.getSnapshot(),
      status: "processing",
    });
    tester.expect(harness.processingViewElement.hidden).toBe(false);
    tester.expect(harness.activeRecordingViewElement.hidden).toBe(true);
    tester.expect(harness.stopButton.disabled).toBe(true);
    tester.expect(harness.reviewViewElement.hidden).toBe(true);
    tester.expect(harness.statusElement.textContent).toBe(
      "Finishing take and saving a recoverable draft…",
    );

    const take = createStoppedTake();
    harness.publishSnapshot({
      ...harness.getSnapshot(),
      status: "stopped",
      capture: take.capture,
      take,
    });
    tester.expect(harness.processingViewElement.hidden).toBe(true);
    tester.expect(harness.reviewViewElement.hidden).toBe(false);
    tester.expect(harness.reviewHeadingElement.textContent).toBe("Take ready");
    tester.expect(harness.reviewPositionElement.textContent).toBe("Bar 2 · Beat 4");
    tester.expect(harness.reviewDurationElement.textContent).toBe("00:02");
    tester.expect(
      harness.reviewTimelineElement.attributes.get("aria-label"),
    ).toBe("Recorded take duration 00:02");
  });

  tester.it("defaults Take Review to Alignment and preserves tab state for the same in-memory take", async () => {
    const harness = createControllerHarness();
    harness.controller.init();
    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();

    tester.expect(harness.alignmentTabButton.getAttribute("aria-selected")).toBe("true");
    tester.expect(harness.playbackMixTabButton.getAttribute("aria-selected")).toBe("false");
    tester.expect(harness.alignmentTabPanel.hidden).toBe(false);
    tester.expect(harness.playbackMixTabPanel.hidden).toBe(true);

    await harness.alignmentLater10Button.click();
    await harness.playbackMixTabButton.click();
    tester.expect(harness.alignmentTabButton.getAttribute("aria-selected")).toBe("false");
    tester.expect(harness.playbackMixTabButton.getAttribute("aria-selected")).toBe("true");
    tester.expect(harness.alignmentTabPanel.hidden).toBe(true);
    tester.expect(harness.playbackMixTabPanel.hidden).toBe(false);
    tester.expect(harness.alignmentSummaryElement.textContent).toBe("Offset: +10 ms");

    await harness.reviewCloseButton.click();
    await harness.armButton.click();
    tester.expect(harness.playbackMixTabPanel.hidden).toBe(false);

    await harness.alignmentTabButton.click();
    tester.expect(harness.alignmentTabPanel.hidden).toBe(false);
    tester.expect(harness.alignmentTabButton.focusCalls).toBe(1);
    tester.expect(harness.alignmentSummaryElement.textContent).toBe("Offset: +10 ms");

    tester.expect(harness.alignmentTabButton.keydown("ArrowRight")).toBe(true);
    tester.expect(harness.playbackMixTabPanel.hidden).toBe(false);
    tester.expect(harness.playbackMixTabButton.keydown("Home")).toBe(true);
    tester.expect(harness.alignmentTabPanel.hidden).toBe(false);
  });

  tester.it("keeps review playback-mix changes outside normal mix mutation and persistence paths", async () => {
    const projectPlaybackMix = [
      { channelNumber: 1, trackId: "bass", name: "Bass", volume: 0.75, enabled: true },
      { channelNumber: 2, trackId: "vocal", name: "Vocal", volume: 0.72, enabled: false },
    ];
    const harness = createControllerHarness({ projectPlaybackMix });
    harness.controller.init();
    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();

    tester.expect(harness.reviewMixTrackListElement.innerHTML.includes("Bass")).toBe(true);
    tester.expect(harness.reviewMixTrackListElement.innerHTML.includes("Vocal")).toBe(true);
    tester.expect(harness.reviewMixTrackListElement.innerHTML.includes("75%")).toBe(true);
    tester.expect(harness.reviewMixTrackListElement.innerHTML.includes("72%")).toBe(true);
    tester.expect(
      harness.reviewMixTrackListElement.innerHTML.includes(
        "microphone-recording__review-mix-track-name",
      ),
    ).toBe(false);
    tester.expect(harness.reviewMixTrackListElement.innerHTML.includes(">On<")).toBe(false);
    tester.expect(harness.reviewMixTrackListElement.innerHTML.includes(">Off<")).toBe(false);
    tester.expect(harness.reviewMixTrackListElement.innerHTML.includes("Add track")).toBe(false);
    tester.expect(harness.reviewMixTrackListElement.innerHTML.includes("data-channel-volume")).toBe(false);
    tester.expect(harness.reviewMixTrackListElement.innerHTML.includes("data-channel-enabled")).toBe(false);

    harness.reviewMixTrackListElement.input({
      dataset: { reviewChannel: "1", reviewChannelVolume: "" },
      value: "0.4",
    });
    harness.reviewMixTrackListElement.input({
      dataset: { reviewChannel: "2", reviewChannelEnabled: "" },
      checked: true,
    });

    const appliedMix = harness.appliedReviewPlaybackMixes.at(-1)!;
    tester.expect(appliedMix[0]!.volume).toBe(0.4);
    tester.expect(appliedMix[1]!.enabled).toBe(true);
    tester.expect(harness.reviewMixTrackListElement.getValue(1)).toBe("40%");
    tester.expect(projectPlaybackMix).toEqual([
      { channelNumber: 1, trackId: "bass", name: "Bass", volume: 0.75, enabled: true },
      { channelNumber: 2, trackId: "vocal", name: "Vocal", volume: 0.72, enabled: false },
    ]);

    await harness.reviewCloseButton.click();
    tester.expect(harness.getRestoreProjectPlaybackMixCalls()).toBe(1);

    await harness.armButton.click();
    const reappliedMix = harness.appliedReviewPlaybackMixes.at(-1)!;
    tester.expect(reappliedMix[0]!.volume).toBe(0.4);
    tester.expect(reappliedMix[1]!.enabled).toBe(true);

    await harness.retryButton.click();
    tester.expect(harness.getRestoreProjectPlaybackMixCalls()).toBe(2);
  });

  tester.it("closes and reopens a stopped review without discarding its recoverable take", async () => {
    const harness = createControllerHarness();
    harness.controller.init();
    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();

    await harness.reviewCloseButton.click();
    tester.expect(harness.workspaceElement.hidden).toBe(true);
    tester.expect(harness.getSnapshot().status).toBe("stopped");
    tester.expect(Boolean(harness.getSnapshot().take)).toBe(true);
    tester.expect(harness.calls.includes("discard")).toBe(false);
    tester.expect(harness.armButton.disabled).toBe(false);

    await harness.armButton.click();
    tester.expect(harness.workspaceElement.hidden).toBe(false);
    tester.expect(harness.reviewViewElement.hidden).toBe(false);
    tester.expect(Boolean(harness.getSnapshot().take)).toBe(true);
  });

  tester.it("identifies a restored recoverable draft without changing shared take state", async () => {
    const harness = createControllerHarness();
    harness.controller.init();
    const take = createStoppedTake();
    harness.publishSnapshot({
      ...harness.getSnapshot(),
      status: "stopped",
      capture: take.capture,
      take,
      takeRecoveryStatus: "restored",
      takeRecoveryFailure: null,
    });

    tester.expect(harness.reviewRecoveredElement.hidden).toBe(false);
    tester.expect(harness.reviewHeadingElement.textContent).toBe("Take restored");
    tester.expect(harness.reviewHeadingElement.focusCount).toBe(1);
    tester.expect(harness.reviewPositionElement.textContent).toBe(
      "From Bar 2 · Beat 4 · Offset 0 ms",
    );
    tester.expect(harness.getSnapshot().status).toBe("stopped");
    tester.expect(harness.getSnapshot().take).toBe(take);

    await harness.retryButton.click();
    await harness.recordButton.click();
    tester.expect(harness.reviewRecoveredElement.hidden).toBe(true);
  });

  tester.it("shows authoritative recovery failure and retries through the shared draft path", async () => {
    const harness = createControllerHarness();
    harness.controller.init();

    harness.publishSnapshot({
      ...harness.getSnapshot(),
      takeRecoveryStatus: "failed",
      takeRecoveryFailure: {
        message: "The saved recording draft could not be opened.",
      },
    });

    tester.expect(harness.workspaceElement.hidden).toBe(false);
    tester.expect(harness.recoveryViewElement.hidden).toBe(false);
    tester.expect(harness.recoveryHeadingElement.textContent).toBe(
      "Recording draft unavailable",
    );
    tester.expect(harness.recoveryMessageElement.textContent).toBe(
      "The saved recording draft could not be opened.",
    );

    await harness.recoveryRetryButton.click();
    tester.expect(harness.calls.at(-1)).toBe("restore-pending-take");
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

  tester.it("keeps Ready open when project tracks are still preparing", async () => {
    const harness = createControllerHarness({
      prepareRecordingStartResult: false,
    });
    harness.controller.init();
    await harness.armButton.click();

    await harness.recordButton.click();

    tester.expect(harness.getSnapshot().status).toBe("ready");
    tester.expect(harness.failureViewElement.hidden).toBe(true);
    tester.expect(harness.calls.includes("start")).toBe(false);
    tester.expect(harness.recordingStartStatusElement.textContent).toBe(
      "Wait for the enabled project tracks to finish preparing, then try again.",
    );

    harness.publishPlaybackReadiness(true);
    tester.expect(harness.recordingStartStatusElement.textContent).toBe("");

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
    tester.expect(harness.countInViewElement.hidden).toBe(false);
    harness.publishSnapshot({
      ...harness.getSnapshot(),
      status: "recording",
      elapsedRecordingSeconds: 0,
    });
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
    tester.expect(harness.reviewHeadingElement.textContent).toBe("Take ready");
    tester.expect(harness.alignmentSummaryElement.textContent).toBe("Offset: 0 ms");
    tester.expect(harness.statusElement.textContent).toBe(
      "Take captured from Bar 2, Beat 4 · 4 project beats. Audition it, adjust alignment if needed, retry, discard it, or keep it as a project track.",
    );

    await harness.auditionButton.click();
    tester.expect(harness.auditionButton.textContent).toBe("Stop audition");
    tester.expect(harness.auditionButton.getAttribute("aria-pressed")).toBe("true");
    tester.expect(harness.reviewHeadingElement.textContent).toBe("Auditioning take");
    tester.expect(harness.statusElement.textContent?.endsWith("Auditioning…")).toBe(true);

    await harness.auditionButton.click();
    tester.expect(harness.auditionButton.textContent).toBe("Audition");
    tester.expect(harness.auditionButton.getAttribute("aria-pressed")).toBe("false");

    harness.auditionVolumeInput.value = "72";
    harness.auditionVolumeInput.input();
    tester.expect(harness.auditionVolumeValueElement.textContent).toBe("72%");
    tester.expect(harness.auditionVolumes).toEqual([0.72]);

    await harness.retryButton.click();
    tester.expect(harness.recordButton.disabled).toBe(false);
    tester.expect(harness.auditionButton.hidden).toBe(true);
    tester.expect(harness.startPositionLabelElement.textContent).toBe(
      "Start at Bar 6 · Beat 3",
    );
    tester.expect(harness.calls.filter((call) => call === "arm").length).toBe(1);

    await harness.recordButton.click();
    await harness.stopButton.click();
    await harness.discardButton.click();
    tester.expect(harness.discardDialog.open).toBe(true);
    tester.expect(harness.calls.includes("discard")).toBe(false);
    await harness.discardCancelButton.click();
    tester.expect(harness.discardDialog.open).toBe(false);
    tester.expect(Boolean(harness.getSnapshot().take)).toBe(true);

    await harness.discardButton.click();
    await harness.discardConfirmButton.click();
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
    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();

    tester.expect(harness.alignmentValueElement.textContent).toBe("0 ms");
    await harness.alignmentLater10Button.click();
    await harness.alignmentLater10Button.click();
    await harness.alignmentEarlier1Button.click();
    tester.expect(harness.alignmentValueElement.textContent).toBe("+19 ms");
    await harness.alignmentResetButton.click();
    tester.expect(harness.alignmentValueElement.textContent).toBe("0 ms");
    await harness.alignmentEarlier100Button.click();
    await harness.alignmentLater1Button.click();
    await harness.alignmentEarlier10Button.click();
    await harness.alignmentLater100Button.click();
    tester.expect(harness.alignmentValueElement.textContent).toBe("-9 ms");
    tester.expect(harness.getSnapshot().take?.timing.musicalStart).toEqual({ bar: 2, beat: 4 });

    await harness.auditionButton.click();
    await harness.alignmentEarlier1Button.click();

    tester.expect(harness.calls.slice(-3)).toEqual([
      "stop-audition",
      "alignment:adjust:-1",
      "audition",
    ]);
    tester.expect(harness.alignmentValueElement.textContent).toBe("-10 ms");
    tester.expect(harness.alignmentSummaryElement.textContent).toBe("Offset: -10 ms");

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
    tester.expect(harness.keepDialog.open).toBe(true);
    tester.expect(harness.takeNameInput.focusCalls).toBe(1);
    tester.expect(harness.takeNameInput.selectCalls).toBe(1);
    harness.takeNameInput.value = "Harmony Vocal Edit";
    harness.publishPlaybackReadiness(false);
    tester.expect(harness.takeNameInput.value).toBe("Harmony Vocal Edit");
    tester.expect(harness.takeNameInput.focusCalls).toBe(1);
    tester.expect(harness.takeNameInput.selectCalls).toBe(1);
    harness.takeNameInput.value = "Harmony Vocal";
    tester.expect(harness.keepMetadataElement.textContent).toBe(
      "Bar 2 · Beat 4 · Offset 0 ms",
    );
    tester.expect(harness.calls.some((call) => call.startsWith("keep:"))).toBe(false);
    await harness.keepCancelButton.click();
    tester.expect(harness.keepDialog.open).toBe(false);
    tester.expect(Boolean(harness.getSnapshot().take)).toBe(true);

    await harness.keepButton.click();
    tester.expect(harness.takeNameInput.focusCalls).toBe(2);
    tester.expect(harness.takeNameInput.selectCalls).toBe(2);
    await harness.keepConfirmButton.click();

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

  tester.it("keeps the naming dialog, entered name, and recoverable take after Keep failure", async () => {
    const harness = createControllerHarness({
      keepFailure: "The track upload could not be completed.",
    });
    harness.controller.init();
    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();
    harness.takeNameInput.value = "Room Vocal";

    await harness.keepButton.click();
    await harness.keepConfirmButton.click();

    tester.expect(harness.keepDialog.open).toBe(true);
    tester.expect(harness.takeNameInput.value).toBe("Room Vocal");
    tester.expect(Boolean(harness.getSnapshot().take)).toBe(true);
    tester.expect(harness.keepStatusElement.textContent).toBe(
      "The track upload could not be completed.",
    );
    tester.expect(harness.keepConfirmButton.disabled).toBe(false);
  });

  tester.it("keeps audition unavailable until required playback is ready", async () => {
    const harness = createControllerHarness();
    harness.controller.init();
    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();

    harness.publishPlaybackReadiness(false);
    tester.expect(harness.auditionButton.disabled).toBe(true);
    tester.expect(harness.reviewStatusElement.textContent).toBe(
      "Project playback must be ready before audition.",
    );

    harness.publishPlaybackReadiness(true);
    tester.expect(harness.auditionButton.disabled).toBe(false);
    tester.expect(harness.reviewStatusElement.textContent).toBe("");

    harness.controller.destroy();
  });

  tester.it("auditions through the current review mix while volume and alignment remain independent", async () => {
    const harness = createControllerHarness();
    harness.controller.init();
    await harness.armButton.click();
    await harness.recordButton.click();
    await harness.stopButton.click();

    harness.reviewMixTrackListElement.input({
      dataset: { reviewChannel: "1", reviewChannelVolume: "" },
      value: "0.35",
    });
    harness.reviewMixTrackListElement.input({
      dataset: { reviewChannel: "2", reviewChannelEnabled: "" },
      checked: true,
    });
    const mixBeforeIndependentControls = harness.appliedReviewPlaybackMixes.at(-1)!;

    harness.auditionVolumeInput.value = "65";
    harness.auditionVolumeInput.input();
    await harness.alignmentLater10Button.click();
    tester.expect(harness.auditionVolumes.at(-1)).toBe(0.65);
    tester.expect(harness.alignmentSummaryElement.textContent).toBe("Offset: +10 ms");
    tester.expect(harness.appliedReviewPlaybackMixes.at(-1)).toEqual(
      mixBeforeIndependentControls,
    );

    harness.publishPlaybackReadiness(false);
    tester.expect(harness.auditionButton.disabled).toBe(true);
    tester.expect(harness.reviewStatusElement.textContent).toBe(
      "Project playback must be ready before audition.",
    );
    harness.publishPlaybackReadiness(true);

    const applyCountBeforeAudition = harness.appliedReviewPlaybackMixes.length;
    await harness.auditionButton.click();
    tester.expect(harness.appliedReviewPlaybackMixes.length).toBe(
      applyCountBeforeAudition + 1,
    );
    tester.expect(harness.appliedReviewPlaybackMixes.at(-1)![0]!.volume).toBe(0.35);
    tester.expect(harness.appliedReviewPlaybackMixes.at(-1)![1]!.enabled).toBe(true);
    tester.expect(harness.calls.at(-1)).toBe("audition");

    harness.reviewMixTrackListElement.input({
      dataset: { reviewChannel: "1", reviewChannelVolume: "" },
      value: "0.2",
    });
    tester.expect(harness.appliedReviewPlaybackMixes.at(-1)![0]!.volume).toBe(0.2);
    tester.expect(harness.calls.at(-1)).toBe("audition");

    await harness.auditionButton.click();
    tester.expect(harness.calls.at(-1)).toBe("stop-audition");
    tester.expect(harness.appliedReviewPlaybackMixes.at(-1)![0]!.volume).toBe(0.2);

    harness.controller.destroy();
  });
});
