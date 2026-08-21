import type {
  MicrophoneRecordedTake,
  MicrophoneRecordingSession,
  MicrophoneRecordingSnapshot,
  Track,
} from "@hugovela/frontend-core";

type ButtonElementLike = {
  disabled: boolean;
  // Modern DOM typings allow the `until-found` string in addition to booleans.
  // The controller only writes booleans, but accepting string keeps real
  // HTMLButtonElement instances structurally compatible with this UI boundary.
  hidden: boolean | string;
  textContent: string | null;
  addEventListener: (
    eventName: "click",
    handler: () => void | Promise<void>,
  ) => void;
};

type ValueInputLike = {
  disabled: boolean;
  hidden: boolean | string;
  value: string;
};

type TextElementLike = {
  textContent: string | null;
};

type MicrophoneRecordingControllerOptions = {
  recordingSession: MicrophoneRecordingSession;
  armButton: ButtonElementLike;
  recordButton: ButtonElementLike;
  stopButton: ButtonElementLike;
  auditionButton: ButtonElementLike;
  retryButton: ButtonElementLike;
  discardButton: ButtonElementLike;
  keepButton: ButtonElementLike;
  takeNameInput: ValueInputLike;
  statusElement: TextElementLike;
  onTakeKept?: (track: Track) => void | Promise<void>;
};

function formatMusicalPosition(position: { bar: number; beat: number }): string {
  const beat = Number(position.beat.toFixed(3));
  return `Bar ${position.bar}, Beat ${beat}`;
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
      return "Microphone ready. Recording will begin from the current project position.";
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
      return `${description} Audition it, retry, discard it, or keep it as a project track.`;
    }
    case "failed":
      return snapshot.failure?.message ?? "Microphone recording failed.";
  }
}

export function createMicrophoneRecordingController({
  recordingSession,
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
}: MicrophoneRecordingControllerOptions) {
  let unsubscribe: (() => void) | null = null;
  let takeNameInitialized = false;

  function render(snapshot: MicrophoneRecordingSnapshot): void {
    const hasStoppedTake = snapshot.status === "stopped" && Boolean(snapshot.take);
    const isSaving = snapshot.takeSaveStatus === "saving";

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
      snapshot.status === "ready" ||
      snapshot.status === "recording" ||
      snapshot.status === "stopped";
    recordButton.disabled = snapshot.status !== "ready";
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

    armButton.textContent = snapshot.status === "requesting-permission"
      ? "Enabling…"
      : "Enable Microphone";
    recordButton.textContent = snapshot.status === "recording"
      ? "Recording…"
      : "Record";
    auditionButton.textContent = snapshot.takeReviewStatus === "auditioning"
      ? "Stop Audition"
      : "Audition Take";
    keepButton.textContent = isSaving ? "Saving…" : "Keep Take";
    statusElement.textContent = getStatusMessage(snapshot);
  }

  function init(): void {
    unsubscribe = recordingSession.subscribe(render);

    armButton.addEventListener("click", async () => {
      await recordingSession.arm();
    });

    recordButton.addEventListener("click", async () => {
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
      await recordingSession.retry();
    });

    discardButton.addEventListener("click", async () => {
      await recordingSession.discard();
    });

    keepButton.addEventListener("click", async () => {
      const result = await recordingSession.keep(takeNameInput.value);

      if (result.savedTrack) {
        takeNameInput.value = "";
        await onTakeKept?.(result.savedTrack);
      }
    });
  }

  function destroy(): void {
    unsubscribe?.();
    unsubscribe = null;
  }

  return {
    init,
    destroy,
  };
}
