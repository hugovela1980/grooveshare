import type {
  MicrophoneRecordedTake,
  MicrophoneRecordingSession,
  MicrophoneRecordingSnapshot,
  Track,
} from "@hugovela/frontend-core";

type MusicalPosition = { bar: number; beat: number };

type ButtonElementLike = {
  disabled: boolean;
  hidden: boolean | string;
  textContent: string | null;
  addEventListener: (
    eventName: "click",
    handler: () => void | Promise<void>,
  ) => void;
  setAttribute?: (name: string, value: string) => void;
  focus?: () => void;
};

type RecordingDialogLike = {
  open: boolean;
  showModal(): void;
  close(): void;
  addEventListener(
    eventName: "cancel",
    handler: (event: { preventDefault(): void }) => void,
  ): void;
};

type ValueInputLike = {
  disabled: boolean;
  hidden: boolean | string;
  value: string;
};

type NumberInputLike = {
  disabled: boolean;
  value: string;
};

type RangeInputLike = {
  disabled: boolean;
  value: string;
  addEventListener: (eventName: "input", handler: () => void) => void;
};

type TextElementLike = {
  textContent: string | null;
};

type MarkupElementLike = {
  innerHTML: string;
  setAttribute?: (name: string, value: string) => void;
};

type AttributeElementLike = {
  setAttribute?: (name: string, value: string) => void;
};

type WorkspaceElementLike = {
  hidden: boolean | string;
  setAttribute?: (name: string, value: string) => void;
};

type HiddenElementLike = {
  hidden: boolean | string;
};

type AlignmentNudgeControl = {
  button: ButtonElementLike;
  deltaMilliseconds: number;
};

type MicrophoneRecordingControllerOptions = {
  recordingSession: MicrophoneRecordingSession;
  armButton: ButtonElementLike;
  armButtonLabelElement?: TextElementLike;
  workspaceElement?: WorkspaceElementLike;
  preparingViewElement?: HiddenElementLike;
  readyViewElement?: HiddenElementLike;
  failureViewElement?: HiddenElementLike;
  countInViewElement?: HiddenElementLike;
  activeRecordingViewElement?: HiddenElementLike;
  processingViewElement?: HiddenElementLike;
  reviewViewElement?: HiddenElementLike;
  reviewCloseButton?: ButtonElementLike;
  cancelButtons?: ButtonElementLike[];
  permissionRetryButton?: ButtonElementLike;
  countInCancelButton?: ButtonElementLike;
  recordButton: ButtonElementLike;
  stopButton: ButtonElementLike;
  auditionButton: ButtonElementLike;
  retryButton: ButtonElementLike;
  discardButton: ButtonElementLike;
  keepButton: ButtonElementLike;
  takeNameInput: ValueInputLike;
  statusElement: TextElementLike;
  failureHeadingElement?: TextElementLike;
  failureMessageElement?: TextElementLike;
  startPositionButton?: ButtonElementLike;
  startPositionLabelElement?: TextElementLike;
  startPositionEditorElement?: HiddenElementLike;
  startBarInput?: NumberInputLike;
  startBeatInput?: NumberInputLike;
  startPositionApplyButton?: ButtonElementLike;
  startPositionStatusElement?: TextElementLike;
  recordingStartStatusElement?: TextElementLike;
  countInNumberElement?: TextElementLike;
  countInBeatsElement?: MarkupElementLike;
  countInPositionElement?: TextElementLike;
  recordingElapsedElement?: TextElementLike;
  recordingPositionElement?: TextElementLike;
  reviewHeadingElement?: TextElementLike;
  reviewRecoveredElement?: HiddenElementLike;
  reviewPositionElement?: TextElementLike;
  reviewDurationElement?: TextElementLike;
  reviewTimelineElement?: AttributeElementLike;
  reviewStatusElement?: TextElementLike;
  auditionVolumeInput?: RangeInputLike;
  auditionVolumeValueElement?: TextElementLike;
  onAuditionVolumeChanged?: (volume: number) => void;
  beatsPerBar?: number;
  getRecordingStartPosition?: () => MusicalPosition;
  setRecordingStartPosition?: (position: MusicalPosition) => boolean;
  prepareRecordingStart?: (position: MusicalPosition) => boolean;
  subscribePlaybackReadiness?: (listener: (ready: boolean) => void) => () => void;
  alignmentValueElement?: TextElementLike;
  alignmentSummaryElement?: TextElementLike;
  alignmentNudgeControls?: AlignmentNudgeControl[];
  alignmentResetButton?: ButtonElementLike;
  keepDialog?: RecordingDialogLike;
  keepConfirmButton?: ButtonElementLike;
  keepCancelButton?: ButtonElementLike;
  keepMetadataElement?: TextElementLike;
  keepStatusElement?: TextElementLike;
  discardDialog?: RecordingDialogLike;
  discardConfirmButton?: ButtonElementLike;
  discardCancelButton?: ButtonElementLike;
  discardStatusElement?: TextElementLike;
  onTakeKept?: (track: Track) => void | Promise<void>;
};

function formatMusicalPosition(position: MusicalPosition): string {
  const beat = Number(position.beat.toFixed(3));
  return `Bar ${position.bar}, Beat ${beat}`;
}

function formatStartPosition(position: MusicalPosition): string {
  return `Start at Bar ${position.bar} · Beat ${Math.floor(position.beat)}`;
}

function formatElapsedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatAlignmentCompensation(milliseconds: number): string {
  return `${milliseconds > 0 ? "+" : ""}${milliseconds} ms`;
}

function describeStoppedTake(take: MicrophoneRecordedTake | null): string {
  if (!take) {
    return "Take captured.";
  }

  const start = formatMusicalPosition(take.timing.musicalStart);
  const spanBeats = Number(take.timing.musicalSpanBeats.toFixed(3));
  return `Take captured from ${start} · ${spanBeats} project beats.`;
}

function getStatusMessage(snapshot: MicrophoneRecordingSnapshot): string {
  switch (snapshot.status) {
    case "idle":
      return snapshot.savedTrack
        ? `“${snapshot.savedTrack.name}” saved as a project track. Enable your microphone to record another take.`
        : "Enable your microphone to prepare a take.";
    case "requesting-permission":
      return "Requesting microphone permission…";
    case "ready":
      return "Microphone ready. Capture will become active before project playback starts.";
    case "count-in":
      return snapshot.countIn
        ? `Count-in beat ${snapshot.countIn.currentBeat} of ${snapshot.countIn.totalBeats}. Get ready.`
        : "Count-in. Get ready.";
    case "recording":
      return snapshot.startPosition
        ? `Recording from ${formatMusicalPosition(snapshot.startPosition.musical)}…`
        : "Recording…";
    case "processing":
      return "Finishing take and saving a recoverable draft…";
    case "stopped": {
      const description = describeStoppedTake(snapshot.take);
      if (snapshot.takeSaveStatus === "saving") {
        return `${description} Saving as a project track…`;
      }
      if (snapshot.takeSaveFailure) {
        return `${description} ${snapshot.takeSaveFailure.message}`;
      }
      if (snapshot.takeReviewStatus === "auditioning") {
        return `${description} Auditioning…`;
      }
      if (snapshot.takeReviewFailure) {
        return `${description} ${snapshot.takeReviewFailure.message}`;
      }
      return `${description} Audition it, adjust alignment if needed, retry, discard it, or keep it as a project track.`;
    }
    case "failed":
      return snapshot.failure?.message ?? "Microphone recording failed.";
  }
}

function getFailurePresentation(snapshot: MicrophoneRecordingSnapshot): {
  heading: string;
  message: string;
} {
  switch (snapshot.failure?.code) {
    case "permission-denied":
      return {
        heading: "Microphone access needed",
        message: "Allow microphone access in your browser settings, then try again.",
      };
    case "microphone-unavailable":
      return {
        heading: "Microphone unavailable",
        message: snapshot.failure.message,
      };
    case "unsupported":
      return {
        heading: "Microphone recording unavailable",
        message: snapshot.failure.message,
      };
    case "not-authorized":
      return {
        heading: "Recording unavailable",
        message: snapshot.failure.message,
      };
    case "recording-failed":
    default:
      return {
        heading: "Microphone could not be prepared",
        message: snapshot.failure?.message ?? "Microphone recording failed.",
      };
  }
}

function normalizeStartPosition(position: MusicalPosition): MusicalPosition {
  return {
    bar: Math.max(1, Math.floor(position.bar)),
    beat: Math.max(1, Math.floor(position.beat)),
  };
}

export function createMicrophoneRecordingController({
  recordingSession,
  armButton,
  armButtonLabelElement,
  workspaceElement,
  preparingViewElement,
  readyViewElement,
  failureViewElement,
  countInViewElement,
  activeRecordingViewElement,
  processingViewElement,
  reviewViewElement,
  reviewCloseButton,
  cancelButtons = [],
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
  auditionVolumeInput,
  auditionVolumeValueElement,
  onAuditionVolumeChanged,
  beatsPerBar = 4,
  getRecordingStartPosition,
  setRecordingStartPosition,
  prepareRecordingStart,
  subscribePlaybackReadiness,
  alignmentValueElement,
  alignmentSummaryElement,
  alignmentNudgeControls = [],
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
}: MicrophoneRecordingControllerOptions) {
  let unsubscribe: (() => void) | null = null;
  let unsubscribePlaybackReadiness: (() => void) | null = null;
  let takeNameInitialized = false;
  let workspaceDismissed = false;
  let selectedStartPosition: MusicalPosition | null = null;
  let playbackReady = true;
  let discarding = false;
  let takeWasRecovered = false;

  function getAuthoritativeStartPosition(): MusicalPosition {
    return normalizeStartPosition(
      getRecordingStartPosition?.() ?? selectedStartPosition ?? { bar: 1, beat: 1 },
    );
  }

  function setStartEditorOpen(open: boolean): void {
    if (startPositionEditorElement) {
      startPositionEditorElement.hidden = !open;
    }
    startPositionButton?.setAttribute?.("aria-expanded", String(open));
  }

  function syncStartPositionPresentation(position = selectedStartPosition): void {
    if (!position) {
      return;
    }

    const normalized = normalizeStartPosition(position);
    selectedStartPosition = normalized;
    if (startPositionLabelElement) {
      startPositionLabelElement.textContent = formatStartPosition(normalized);
    }
    if (startBarInput) {
      startBarInput.value = String(normalized.bar);
    }
    if (startBeatInput) {
      startBeatInput.value = String(normalized.beat);
    }
  }

  function initializeStartPosition(): void {
    selectedStartPosition = getAuthoritativeStartPosition();
    syncStartPositionPresentation();
    if (startPositionStatusElement) {
      startPositionStatusElement.textContent = "";
    }
    if (recordingStartStatusElement) {
      recordingStartStatusElement.textContent = "";
    }
    setStartEditorOpen(false);
  }

  function validateStartPositionFromInputs(): MusicalPosition | null {
    const bar = Number(startBarInput?.value ?? selectedStartPosition?.bar ?? 1);
    const beat = Number(startBeatInput?.value ?? selectedStartPosition?.beat ?? 1);

    if (!Number.isInteger(bar) || bar < 1) {
      if (startPositionStatusElement) {
        startPositionStatusElement.textContent = "Bar must be a whole number of 1 or greater.";
      }
      return null;
    }

    if (!Number.isInteger(beat) || beat < 1 || beat > beatsPerBar) {
      if (startPositionStatusElement) {
        startPositionStatusElement.textContent = `Beat must be a whole number from 1 to ${beatsPerBar}.`;
      }
      return null;
    }

    if (startPositionStatusElement) {
      startPositionStatusElement.textContent = "";
    }
    return { bar, beat };
  }

  function applyStartPosition({ closeEditor = true }: { closeEditor?: boolean } = {}): boolean {
    const position = validateStartPositionFromInputs();
    if (!position) {
      return false;
    }

    if (setRecordingStartPosition && !setRecordingStartPosition(position)) {
      if (startPositionStatusElement) {
        startPositionStatusElement.textContent = "Choose a valid recording start position.";
      }
      return false;
    }

    selectedStartPosition = { ...position };
    syncStartPositionPresentation();
    if (closeEditor) {
      setStartEditorOpen(false);
    }
    return true;
  }

  function setViewVisibility(snapshot: MicrophoneRecordingSnapshot, workspaceVisible: boolean): void {
    const preparing = workspaceVisible && snapshot.status === "requesting-permission";
    const ready = workspaceVisible && snapshot.status === "ready";
    const failed = workspaceVisible && snapshot.status === "failed";
    const countingIn = workspaceVisible && snapshot.status === "count-in";
    const recording = workspaceVisible && snapshot.status === "recording";
    const processing = workspaceVisible && snapshot.status === "processing";
    const reviewing = workspaceVisible && snapshot.status === "stopped";

    if (preparingViewElement) preparingViewElement.hidden = !preparing;
    if (readyViewElement) readyViewElement.hidden = !ready;
    if (failureViewElement) failureViewElement.hidden = !failed;
    if (countInViewElement) countInViewElement.hidden = !countingIn;
    if (activeRecordingViewElement) activeRecordingViewElement.hidden = !recording;
    if (processingViewElement) processingViewElement.hidden = !processing;
    if (reviewViewElement) reviewViewElement.hidden = !reviewing;

    workspaceElement?.setAttribute?.("data-recording-state", snapshot.status);
  }

  function render(snapshot: MicrophoneRecordingSnapshot): void {
    const sessionHasWorkspace =
      snapshot.status !== "idle" || Boolean(snapshot.take) || Boolean(snapshot.failure);
    const workspaceVisible = sessionHasWorkspace && !workspaceDismissed;
    if (workspaceElement) {
      workspaceElement.hidden = !workspaceVisible;
    }
    setViewVisibility(snapshot, workspaceVisible);

    if (snapshot.status === "requesting-permission" && !selectedStartPosition) {
      initializeStartPosition();
    }
    if (snapshot.status === "ready" && !selectedStartPosition) {
      initializeStartPosition();
    }
    if (snapshot.status === "idle") {
      setStartEditorOpen(false);
    }
    if (
      snapshot.status === "count-in" ||
      snapshot.status === "recording" ||
      snapshot.status === "processing"
    ) {
      takeWasRecovered = false;
    }

    const hasStoppedTake = snapshot.status === "stopped" && Boolean(snapshot.take);
    const isSaving = snapshot.takeSaveStatus === "saving";
    const alignmentControlsDisabled =
      !hasStoppedTake ||
      snapshot.status === "requesting-permission" ||
      snapshot.status === "count-in" ||
      snapshot.status === "recording" ||
      snapshot.status === "processing" ||
      isSaving ||
      discarding;

    if (hasStoppedTake && !takeNameInitialized) {
      if (!takeNameInput.value.trim()) {
        takeNameInput.value = "Recorded Take";
      }
      takeNameInitialized = true;
    } else if (!hasStoppedTake) {
      takeNameInitialized = false;
    }

    armButton.disabled =
      snapshot.status === "requesting-permission" ||
      snapshot.status === "count-in" ||
      snapshot.status === "recording" ||
      snapshot.status === "processing" ||
      isSaving ||
      discarding;
    recordButton.disabled = snapshot.status !== "ready";
    stopButton.disabled = snapshot.status !== "recording";
    if (reviewCloseButton) {
      reviewCloseButton.disabled = isSaving || discarding;
    }

    if (snapshot.countIn) {
      const { currentBeat, totalBeats } = snapshot.countIn;
      if (countInNumberElement) {
        countInNumberElement.textContent = String(currentBeat);
      }
      if (countInBeatsElement) {
        countInBeatsElement.innerHTML = Array.from(
          { length: totalBeats },
          (_, index) =>
            `<span${index + 1 === currentBeat ? ' class="is-active"' : ""} aria-hidden="true"></span>`,
        ).join("");
        countInBeatsElement.setAttribute?.(
          "aria-label",
          `Count-in beat ${currentBeat} of ${totalBeats}`,
        );
      }
    }

    const countInPosition = selectedStartPosition ?? snapshot.startPosition?.musical;
    if (countInPosition && countInPositionElement) {
      countInPositionElement.textContent =
        `Recording starts at Bar ${countInPosition.bar} · Beat ${Math.floor(countInPosition.beat)}`;
    }
    const recordingPosition = snapshot.startPosition?.musical ?? selectedStartPosition;
    if (recordingPosition && recordingPositionElement) {
      recordingPositionElement.textContent =
        `From Bar ${recordingPosition.bar} · Beat ${Math.floor(recordingPosition.beat)}`;
    }
    if (recordingElapsedElement) {
      recordingElapsedElement.textContent = formatElapsedTime(
        snapshot.elapsedRecordingSeconds,
      );
    }

    if (hasStoppedTake && snapshot.take) {
      const { musicalStart } = snapshot.take.timing;
      const duration = formatElapsedTime(
        snapshot.take.timing.transport.durationSeconds,
      );
      const alignment = formatAlignmentCompensation(
        snapshot.alignmentCompensationMilliseconds,
      );
      if (reviewHeadingElement) {
        reviewHeadingElement.textContent = snapshot.takeReviewStatus === "auditioning"
          ? "Auditioning take"
          : "Take ready";
      }
      if (reviewPositionElement) {
        reviewPositionElement.textContent =
          `Bar ${musicalStart.bar} · Beat ${Math.floor(musicalStart.beat)}`;
      }
      if (reviewDurationElement) {
        reviewDurationElement.textContent = duration;
      }
      reviewTimelineElement?.setAttribute?.(
        "aria-label",
        `Recorded take duration ${duration}`,
      );
      if (keepMetadataElement) {
        keepMetadataElement.textContent =
          `Bar ${musicalStart.bar} · Beat ${Math.floor(musicalStart.beat)} · Offset ${alignment}`;
      }
    }
    if (reviewRecoveredElement) {
      reviewRecoveredElement.hidden = !hasStoppedTake || !takeWasRecovered;
    }

    auditionButton.hidden = !hasStoppedTake;
    retryButton.hidden = !hasStoppedTake;
    discardButton.hidden = !hasStoppedTake;
    keepButton.hidden = !hasStoppedTake;
    takeNameInput.hidden = !hasStoppedTake;

    auditionButton.disabled = !hasStoppedTake || isSaving || discarding || !playbackReady;
    retryButton.disabled = !hasStoppedTake || isSaving || discarding;
    discardButton.disabled = !hasStoppedTake || isSaving || discarding;
    keepButton.disabled = !hasStoppedTake || isSaving || discarding;
    takeNameInput.disabled = !hasStoppedTake || isSaving || discarding;
    if (auditionVolumeInput) {
      auditionVolumeInput.disabled = !hasStoppedTake || isSaving || discarding;
    }
    if (keepConfirmButton) {
      keepConfirmButton.disabled = !hasStoppedTake || isSaving || discarding;
      keepConfirmButton.textContent = isSaving ? "Saving…" : "Keep track";
    }
    if (keepCancelButton) {
      keepCancelButton.disabled = isSaving;
    }
    if (discardConfirmButton) {
      discardConfirmButton.disabled = !hasStoppedTake || isSaving || discarding;
      discardConfirmButton.textContent = discarding ? "Discarding…" : "Discard take";
    }
    if (discardCancelButton) {
      discardCancelButton.disabled = discarding;
    }

    for (const { button } of alignmentNudgeControls) {
      button.disabled = alignmentControlsDisabled;
    }
    if (alignmentResetButton) {
      alignmentResetButton.disabled =
        alignmentControlsDisabled || snapshot.alignmentCompensationMilliseconds === 0;
    }
    if (alignmentValueElement) {
      alignmentValueElement.textContent = formatAlignmentCompensation(
        snapshot.alignmentCompensationMilliseconds,
      );
    }
    if (alignmentSummaryElement) {
      alignmentSummaryElement.textContent =
        `Offset: ${formatAlignmentCompensation(snapshot.alignmentCompensationMilliseconds)}`;
    }

    if (reviewStatusElement) {
      reviewStatusElement.textContent = snapshot.takeSaveFailure?.message ??
        snapshot.takeReviewFailure?.message ??
        (hasStoppedTake && !playbackReady
          ? "Project playback must be ready before audition."
          : "");
    }
    if (keepStatusElement) {
      keepStatusElement.textContent = isSaving
        ? "Saving your take…"
        : snapshot.takeSaveFailure?.message ?? "";
    }
    if (discardStatusElement) {
      discardStatusElement.textContent = discarding
        ? "Removing the recoverable draft…"
        : "";
    }
    if (!hasStoppedTake) {
      if (keepDialog?.open) keepDialog.close();
      if (discardDialog?.open) discardDialog.close();
    }

    if (snapshot.status === "failed") {
      const failurePresentation = getFailurePresentation(snapshot);
      if (failureHeadingElement) {
        failureHeadingElement.textContent = failurePresentation.heading;
      }
      if (failureMessageElement) {
        failureMessageElement.textContent = failurePresentation.message;
      }
    }

    const armLabel = workspaceVisible
      ? "Close recording workflow"
      : snapshot.status === "requesting-permission"
        ? "Microphone permission pending"
        : "Open recording workflow";
    if (armButtonLabelElement) {
      armButtonLabelElement.textContent = armLabel;
    } else {
      armButton.textContent = snapshot.status === "ready" && workspaceVisible
        ? "Disable Microphone"
        : snapshot.status === "requesting-permission"
          ? "Enabling…"
          : "Enable Microphone";
    }
    armButton.setAttribute?.("aria-label", armLabel);
    armButton.setAttribute?.("aria-pressed", String(workspaceVisible));

    recordButton.textContent = "Start recording";
    auditionButton.textContent = snapshot.takeReviewStatus === "auditioning"
      ? "Stop audition"
      : "Audition";
    auditionButton.setAttribute?.(
      "aria-pressed",
      String(snapshot.takeReviewStatus === "auditioning"),
    );
    keepButton.textContent = isSaving ? "Saving…" : "Keep";
    statusElement.textContent = getStatusMessage(snapshot);
  }

  async function adjustAlignment(deltaMilliseconds: number): Promise<void> {
    const wasAuditioning =
      recordingSession.getSnapshot().takeReviewStatus === "auditioning";

    if (wasAuditioning) {
      await recordingSession.stopAudition();
    }

    recordingSession.adjustAlignmentCompensationMilliseconds(deltaMilliseconds);

    if (wasAuditioning) {
      await recordingSession.audition();
    }
  }

  async function resetAlignment(): Promise<void> {
    const wasAuditioning =
      recordingSession.getSnapshot().takeReviewStatus === "auditioning";

    if (wasAuditioning) {
      await recordingSession.stopAudition();
    }

    recordingSession.resetAlignmentCompensation();

    if (wasAuditioning) {
      await recordingSession.audition();
    }
  }

  async function settleDismissedArm(snapshot: MicrophoneRecordingSnapshot): Promise<void> {
    if (!workspaceDismissed) {
      return;
    }

    if (snapshot.status === "ready") {
      await recordingSession.disarm();
      return;
    }

    if (snapshot.status === "failed") {
      await recordingSession.reset();
    }
  }

  async function openWorkflow(): Promise<void> {
    workspaceDismissed = false;
    initializeStartPosition();
    const next = await recordingSession.arm();
    await settleDismissedArm(next);
  }

  async function closeWorkflow(): Promise<void> {
    const snapshot = recordingSession.getSnapshot();
    if (snapshot.takeSaveStatus === "saving" || discarding) {
      return;
    }
    workspaceDismissed = true;
    if (keepDialog?.open) keepDialog.close();
    if (discardDialog?.open) discardDialog.close();
    if (workspaceElement) {
      workspaceElement.hidden = true;
    }
    armButton.setAttribute?.("aria-pressed", "false");

    if (snapshot.status === "ready") {
      await recordingSession.disarm();
      return;
    }

    if (snapshot.status === "failed") {
      await recordingSession.reset();
      return;
    }

    if (snapshot.status === "stopped" && snapshot.takeReviewStatus === "auditioning") {
      await recordingSession.stopAudition();
      return;
    }

    // A browser permission prompt cannot always be programmatically canceled.
    // If this was a pending prepare(), openWorkflow() releases a late successful
    // grant (or clears a late failure) as soon as arm() settles.
  }

  function init(): void {
    unsubscribe = recordingSession.subscribe(render);
    unsubscribePlaybackReadiness = subscribePlaybackReadiness?.((ready) => {
      playbackReady = ready;
      if (ready && recordingStartStatusElement) {
        recordingStartStatusElement.textContent = "";
      }
      render(recordingSession.getSnapshot());
    }) ?? null;

    armButton.addEventListener("click", async () => {
      const snapshot = recordingSession.getSnapshot();
      if (snapshot.status === "stopped") {
        if (workspaceDismissed) {
          workspaceDismissed = false;
          render(snapshot);
        } else {
          await closeWorkflow();
        }
        return;
      }
      if (
        !workspaceDismissed &&
        (snapshot.status === "requesting-permission" ||
          snapshot.status === "ready" ||
          snapshot.status === "failed")
      ) {
        await closeWorkflow();
        return;
      }

      await openWorkflow();
    });

    for (const button of cancelButtons) {
      button.addEventListener("click", closeWorkflow);
    }
    reviewCloseButton?.addEventListener("click", closeWorkflow);

    permissionRetryButton?.addEventListener("click", openWorkflow);

    countInCancelButton?.addEventListener("click", async () => {
      await recordingSession.cancelCountIn();
    });

    startPositionButton?.addEventListener("click", () => {
      const isOpen = startPositionEditorElement?.hidden === false;
      setStartEditorOpen(!isOpen);
      if (!isOpen) {
        syncStartPositionPresentation(selectedStartPosition ?? getAuthoritativeStartPosition());
      }
    });

    startPositionApplyButton?.addEventListener("click", () => {
      applyStartPosition();
    });

    recordButton.addEventListener("click", async () => {
      if (!applyStartPosition()) {
        setStartEditorOpen(true);
        return;
      }

      const position = selectedStartPosition ?? getAuthoritativeStartPosition();
      if (prepareRecordingStart && !prepareRecordingStart(position)) {
        if (recordingStartStatusElement) {
          recordingStartStatusElement.textContent =
            "Wait for the enabled project tracks to finish preparing, then try again.";
        }
        return;
      }

      if (recordingStartStatusElement) {
        recordingStartStatusElement.textContent = "";
      }

      await recordingSession.start();
    });

    stopButton.addEventListener("click", async () => {
      await recordingSession.stop();
    });

    auditionButton.addEventListener("click", async () => {
      if (recordingSession.getSnapshot().takeReviewStatus === "auditioning") {
        await recordingSession.stopAudition();
        return;
      }
      await recordingSession.audition();
    });

    retryButton.addEventListener("click", async () => {
      if (recordingSession.getSnapshot().takeSaveStatus === "saving" || discarding) {
        return;
      }
      await recordingSession.retry();
    });

    discardButton.addEventListener("click", () => {
      const snapshot = recordingSession.getSnapshot();
      if (
        snapshot.status !== "stopped" ||
        snapshot.takeSaveStatus === "saving" ||
        discarding ||
        discardDialog?.open
      ) {
        return;
      }
      discardDialog?.showModal();
    });

    async function confirmKeep(): Promise<void> {
      const snapshot = recordingSession.getSnapshot();
      if (snapshot.status !== "stopped" || snapshot.takeSaveStatus === "saving" || discarding) {
        return;
      }
      const result = await recordingSession.keep(takeNameInput.value);

      if (result.savedTrack) {
        takeNameInput.value = "";
        keepDialog?.close();
        armButton.focus?.();
        await onTakeKept?.(result.savedTrack);
      }
    }

    keepButton.addEventListener("click", () => {
      const snapshot = recordingSession.getSnapshot();
      if (
        snapshot.status !== "stopped" ||
        snapshot.takeSaveStatus === "saving" ||
        discarding ||
        keepDialog?.open
      ) {
        return;
      }
      keepDialog?.showModal();
    });
    keepConfirmButton?.addEventListener("click", confirmKeep);

    function cancelKeep(): void {
      if (recordingSession.getSnapshot().takeSaveStatus === "saving") {
        return;
      }
      keepDialog?.close();
      keepButton.focus?.();
    }

    keepCancelButton?.addEventListener("click", cancelKeep);
    keepDialog?.addEventListener("cancel", (event) => {
      event.preventDefault();
      cancelKeep();
    });

    async function confirmDiscard(): Promise<void> {
      const snapshot = recordingSession.getSnapshot();
      if (
        snapshot.status !== "stopped" ||
        snapshot.takeSaveStatus === "saving" ||
        discarding
      ) {
        return;
      }
      discarding = true;
      render(snapshot);
      try {
        await recordingSession.discard();
      } finally {
        discarding = false;
        render(recordingSession.getSnapshot());
      }
    }

    discardConfirmButton?.addEventListener("click", confirmDiscard);

    function cancelDiscard(): void {
      if (discarding) {
        return;
      }
      discardDialog?.close();
      discardButton.focus?.();
    }

    discardCancelButton?.addEventListener("click", cancelDiscard);
    discardDialog?.addEventListener("cancel", (event) => {
      event.preventDefault();
      cancelDiscard();
    });

    auditionVolumeInput?.addEventListener("input", () => {
      if (auditionVolumeInput.disabled) {
        return;
      }
      const value = Number(auditionVolumeInput.value);
      if (!Number.isFinite(value)) {
        return;
      }
      const percentage = Math.max(0, Math.min(100, value));
      auditionVolumeInput.value = String(percentage);
      if (auditionVolumeValueElement) {
        auditionVolumeValueElement.textContent = `${percentage}%`;
      }
      onAuditionVolumeChanged?.(percentage / 100);
    });

    for (const { button, deltaMilliseconds } of alignmentNudgeControls) {
      button.addEventListener("click", async () => {
        await adjustAlignment(deltaMilliseconds);
      });
    }

    alignmentResetButton?.addEventListener("click", resetAlignment);
  }

  function destroy(): void {
    unsubscribe?.();
    unsubscribe = null;
    unsubscribePlaybackReadiness?.();
    unsubscribePlaybackReadiness = null;
  }

  function markTakeRecovered(): void {
    const snapshot = recordingSession.getSnapshot();
    if (snapshot.status !== "stopped" || !snapshot.take) {
      return;
    }
    takeWasRecovered = true;
    render(snapshot);
  }

  return {
    init,
    destroy,
    markTakeRecovered,
  };
}
