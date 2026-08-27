import type {
  MicrophoneRecordedTake,
  MicrophoneRecordingSession,
  MicrophoneRecordingSnapshot,
  Track,
} from "@hugovela/frontend-core";

type ButtonElementLike = {
  disabled: boolean;
  hidden: boolean | string;
  textContent: string | null;
  addEventListener: (
    eventName: "click",
    handler: () => void | Promise<void>,
  ) => void;
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
  focus?: () => void;
};

type RecordingDialogLike = {
  open: boolean;
  showModal(): void;
  close(): void;
  addEventListener(name: "cancel", handler: (event: { preventDefault(): void }) => void): void;
};

type ValueInputLike = {
  disabled: boolean;
  hidden: boolean | string;
  value: string;
};

type TextElementLike = {
  textContent: string | null;
};

type AlignmentNudgeControl = {
  button: ButtonElementLike;
  deltaMilliseconds: number;
};

type MicrophoneRecordingControllerOptions = {
  recordingSession: MicrophoneRecordingSession;
  armButton: ButtonElementLike;
  armButtonLabelElement?: TextElementLike | null;
  workspace?: RecordingDialogLike | null;
  closeButton?: ButtonElementLike | null;
  prepareRetryButton?: ButtonElementLike | null;
  headingElement?: TextElementLike | null;
  alignmentSection?: { hidden: boolean | string } | null;
  reviewSection?: { hidden: boolean | string } | null;
  hintElement?: { hidden: boolean | string } | null;
  auditionVolumeInput?: { value: string; disabled: boolean; addEventListener(name: "input", handler: () => void): void } | null;
  auditionVolumeValue?: TextElementLike | null;
  onAuditionVolumeChanged?: (volume: number) => void;
  keepDialog?: RecordingDialogLike | null;
  keepConfirmButton?: ButtonElementLike | null;
  keepCancelButton?: ButtonElementLike | null;
  keepStatusElement?: TextElementLike | null;
  onPhaseChange?: (status: MicrophoneRecordingSnapshot["status"]) => void;
  shouldMoveFocus?: () => boolean;
  recordButton: ButtonElementLike;
  stopButton: ButtonElementLike;
  auditionButton: ButtonElementLike;
  retryButton: ButtonElementLike;
  discardButton: ButtonElementLike;
  keepButton: ButtonElementLike;
  takeNameInput: ValueInputLike;
  statusElement: TextElementLike;
  alignmentValueElement?: TextElementLike;
  alignmentNudgeControls?: AlignmentNudgeControl[];
  alignmentResetButton?: ButtonElementLike;
  onTakeKept?: (track: Track) => void | Promise<void>;
};

function formatMusicalPosition(position: { bar: number; beat: number }): string {
  const beat = Number(position.beat.toFixed(3));
  return `Bar ${position.bar}, Beat ${beat}`;
}

function formatAlignmentCompensation(milliseconds: number): string {
  if (milliseconds === 0) {
    return "0 ms";
  }

  return milliseconds > 0
    ? `${milliseconds} ms earlier`
    : `${Math.abs(milliseconds)} ms later`;
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
    case "recording":
      return snapshot.startPosition
        ? `Recording from ${formatMusicalPosition(snapshot.startPosition.musical)}…`
        : "Recording…";
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

export function createMicrophoneRecordingController({
  recordingSession,
  armButton,
  armButtonLabelElement,
  workspace,
  closeButton,
  prepareRetryButton,
  headingElement,
  alignmentSection,
  reviewSection,
  hintElement,
  auditionVolumeInput,
  auditionVolumeValue,
  onAuditionVolumeChanged,
  keepDialog,
  keepConfirmButton,
  keepCancelButton,
  keepStatusElement,
  onPhaseChange,
  shouldMoveFocus,
  recordButton,
  stopButton,
  auditionButton,
  retryButton,
  discardButton,
  keepButton,
  takeNameInput,
  statusElement,
  alignmentValueElement,
  alignmentNudgeControls = [],
  alignmentResetButton,
  onTakeKept,
}: MicrophoneRecordingControllerOptions) {
  let unsubscribe: (() => void) | null = null;
  let takeNameInitialized = false;
  let starting = false;
  let disposed = false;
  let previousStatus: MicrophoneRecordingSnapshot["status"] | null = null;

  async function closeWorkspace(): Promise<void> {
    const status = recordingSession.getSnapshot().status;
    if (starting || status === "recording" || recordingSession.getSnapshot().takeSaveStatus === "saving") return;
    workspace?.close();
    if (status === "ready") {
      const result = await recordingSession.disarm();
      if (disposed) return;
      if (result.status === "failed") {
        workspace?.showModal();
        return;
      }
    }
    render(recordingSession.getSnapshot());
    armButton.focus?.();
  }

  async function prepareWorkspace(): Promise<void> {
    if (workspace && !workspace.open) workspace.showModal();
    const current = recordingSession.getSnapshot();
    render(current);
    if (current.status === "ready" || current.status === "stopped" || current.status === "recording" || current.status === "requesting-permission") return;
    const result = await recordingSession.arm();
    // Browser permission prompts cannot be canceled by closing our dialog.
    // Release a late acquisition if the user already left this workspace.
    if (!disposed && workspace && !workspace.open && result.status === "ready") {
      await recordingSession.disarm();
    }
  }

  function render(snapshot: MicrophoneRecordingSnapshot): void {
    // Capture focus ownership before hiding the previous action. Browsers may
    // otherwise move activeElement to body as soon as that control disappears.
    const moveFocus = shouldMoveFocus?.() ?? true;
    const hasStoppedTake = snapshot.status === "stopped" && Boolean(snapshot.take);
    const isSaving = snapshot.takeSaveStatus === "saving";
    if (workspace) {
      if (headingElement) headingElement.textContent = snapshot.status === "ready"
        ? "Microphone ready"
        : snapshot.status === "requesting-permission" ? "Preparing microphone…"
        : snapshot.status === "failed" ? "Microphone needs attention"
        : snapshot.status === "recording" ? "Recording…"
        : hasStoppedTake ? (snapshot.takeReviewStatus === "auditioning" ? "Auditioning temporary take" : "Take review") : "Prepare your microphone";
      if (closeButton) closeButton.disabled = starting || snapshot.status === "recording" || isSaving;
      if (alignmentSection) alignmentSection.hidden = !hasStoppedTake;
      if (prepareRetryButton) {
        prepareRetryButton.hidden = snapshot.status !== "failed" && snapshot.status !== "idle";
        prepareRetryButton.disabled = starting;
      }
      recordButton.hidden = snapshot.status !== "ready" && snapshot.status !== "requesting-permission";
      stopButton.hidden = snapshot.status !== "recording";
    }
    if (reviewSection) reviewSection.hidden = !hasStoppedTake;
    if (hintElement) hintElement.hidden = snapshot.status !== "ready" && snapshot.status !== "requesting-permission";
    if (auditionVolumeInput) auditionVolumeInput.disabled = !hasStoppedTake || isSaving;
    if (keepConfirmButton) {
      keepConfirmButton.disabled = !hasStoppedTake || isSaving;
      keepConfirmButton.textContent = isSaving ? "Saving…" : "Keep Take";
    }
    if (keepCancelButton) keepCancelButton.disabled = isSaving;
    if (keepStatusElement) keepStatusElement.textContent = isSaving
      ? "Saving your take…" : snapshot.takeSaveFailure?.message ?? "";
    if (!hasStoppedTake && keepDialog?.open) keepDialog.close();
    const alignmentControlsDisabled =
      snapshot.status === "requesting-permission" ||
      snapshot.status === "recording" ||
      isSaving;

    if (hasStoppedTake && !takeNameInitialized) {
      if (!takeNameInput.value.trim()) {
        takeNameInput.value = "Recorded Take";
      }
      takeNameInitialized = true;
    } else if (!hasStoppedTake) {
      takeNameInitialized = false;
    }

    armButton.disabled =
      starting || isSaving || (snapshot.status === "requesting-permission" && !workspace) ||
      snapshot.status === "recording" ||
      (snapshot.status === "stopped" && !workspace);
    recordButton.disabled = starting || snapshot.status !== "ready";
    stopButton.disabled = snapshot.status !== "recording";

    auditionButton.hidden = !hasStoppedTake;
    retryButton.hidden = !hasStoppedTake;
    discardButton.hidden = !hasStoppedTake;
    keepButton.hidden = !hasStoppedTake;
    takeNameInput.hidden = !hasStoppedTake;

    auditionButton.disabled = !hasStoppedTake || isSaving;
    retryButton.disabled = !hasStoppedTake || isSaving;
    discardButton.disabled = !hasStoppedTake || isSaving;
    keepButton.disabled = !hasStoppedTake || isSaving;
    takeNameInput.disabled = !hasStoppedTake || isSaving;

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

    const armButtonLabel = workspace
      ? (workspace.open ? "Close recording interface" : "Open recording interface")
      : snapshot.status === "requesting-permission"
      ? "Enabling…"
      : snapshot.status === "ready"
        ? "Disable Microphone"
        : "Enable Microphone";
    if (armButtonLabelElement) {
      armButtonLabelElement.textContent = armButtonLabel;
    } else {
      armButton.textContent = armButtonLabel;
    }
    armButton.setAttribute?.("aria-label", armButtonLabel);
    if (workspace) armButton.setAttribute?.("aria-expanded", String(workspace.open));
    armButton.setAttribute?.("aria-pressed", String(snapshot.status === "ready"));
    if (snapshot.status === "requesting-permission") {
      armButton.setAttribute?.("aria-busy", "true");
    } else {
      armButton.removeAttribute?.("aria-busy");
    }
    recordButton.textContent = snapshot.status === "recording"
      ? "Recording…"
      : "Record Take";
    auditionButton.textContent = snapshot.takeReviewStatus === "auditioning"
      ? "Stop Audition"
      : workspace ? "Audition" : "Audition Take";
    auditionButton.setAttribute?.("aria-pressed", String(snapshot.takeReviewStatus === "auditioning"));
    keepButton.textContent = isSaving ? "Saving…" : workspace ? "Keep" : "Keep Take";
    statusElement.textContent = getStatusMessage(snapshot);
    if (workspace && snapshot.status === "ready") {
      statusElement.textContent = starting
        ? "Starting capture… The existing count-in leads into project playback."
        : "Recording has not started. Press Record Take when you’re ready. Closing releases the microphone.";
    }
    if (workspace && hasStoppedTake) {
      const start = snapshot.take!.timing.musicalStart;
      const description = `Temporary take from Bar ${start.bar} · Beat ${Math.floor(start.beat)}. Not yet kept.`;
      statusElement.textContent = `${description} ${isSaving ? "Saving as a project track…"
        : snapshot.takeSaveFailure?.message ?? snapshot.takeReviewFailure?.message
        ?? (snapshot.takeReviewStatus === "auditioning" ? "Playing with the project mix." : "Retry, Audition, or Keep when ready.")}`;
    }
    if (workspace && snapshot.status === "recording") {
      statusElement.textContent = "Recording is in progress. Use Stop Recording below to finish this take.";
    }
    if (previousStatus !== snapshot.status) {
      previousStatus = snapshot.status;
      if (workspace?.open && moveFocus) onPhaseChange?.(snapshot.status);
    }
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

  function init(): void {
    unsubscribe = recordingSession.subscribe(render);

    armButton.addEventListener("click", async () => {
      if (workspace) {
        if (workspace.open) await closeWorkspace();
        else await prepareWorkspace();
        return;
      }
      if (recordingSession.getSnapshot().status === "ready") {
        await recordingSession.disarm();
        return;
      }

      await recordingSession.arm();
    });

    recordButton.addEventListener("click", async () => {
      if (starting || recordingSession.getSnapshot().status !== "ready") return;
      starting = true;
      render(recordingSession.getSnapshot());
      try {
        await recordingSession.start();
      } finally {
        starting = false;
        if (!disposed) render(recordingSession.getSnapshot());
      }
    });

    closeButton?.addEventListener("click", closeWorkspace);
    prepareRetryButton?.addEventListener("click", prepareWorkspace);
    workspace?.addEventListener("cancel", (event) => {
      event.preventDefault();
      void closeWorkspace();
    });

    stopButton.addEventListener("click", async () => {
      if (recordingSession.getSnapshot().status !== "recording") return;
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
      await recordingSession.retry();
    });

    discardButton.addEventListener("click", async () => {
      // Discarding from this workspace means preparing for another take.
      // The shared retry transition clears the draft and retains a ready mic.
      await recordingSession.retry();
    });

    async function confirmKeep(): Promise<void> {
      const snapshot = recordingSession.getSnapshot();
      if (snapshot.status !== "stopped" || snapshot.takeSaveStatus === "saving") return;
      const result = await recordingSession.keep(takeNameInput.value);

      if (result.savedTrack) {
        takeNameInput.value = "";
        if (!disposed) {
          workspace?.close();
          render(result);
          armButton.focus?.();
        }
        await onTakeKept?.(result.savedTrack);
      }
    }
    keepButton.addEventListener("click", async () => {
      if (keepDialog) {
        const snapshot = recordingSession.getSnapshot();
        if (snapshot.status !== "stopped" || snapshot.takeSaveStatus === "saving") return;
        if (!keepDialog.open) keepDialog.showModal();
        return;
      }
      await confirmKeep();
    });
    keepConfirmButton?.addEventListener("click", confirmKeep);
    function cancelKeep(): void {
      if (recordingSession.getSnapshot().takeSaveStatus === "saving") return;
      keepDialog?.close();
      keepButton.focus?.();
    }
    keepCancelButton?.addEventListener("click", cancelKeep);
    keepDialog?.addEventListener("cancel", event => {
      event.preventDefault();
      cancelKeep();
    });
    auditionVolumeInput?.addEventListener("input", () => {
      if (auditionVolumeInput.disabled) return;
      const value = Number(auditionVolumeInput.value);
      if (!Number.isFinite(value)) return;
      const percentage = Math.max(0, Math.min(100, value));
      auditionVolumeInput.value = String(percentage);
      if (auditionVolumeValue) auditionVolumeValue.textContent = `${percentage}%`;
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
    disposed = true;
    workspace?.close();
    keepDialog?.close();
    unsubscribe?.();
    unsubscribe = null;
  }

  return {
    init,
    destroy,
  };
}
