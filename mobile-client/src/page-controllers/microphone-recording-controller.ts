import type {
  MicrophoneRecordedTake,
  MicrophoneRecordingSession,
  MicrophoneRecordingSnapshot,
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
  statusElement: TextElementLike;
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
      return "Enable your microphone to prepare a take.";
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
      if (snapshot.takeReviewStatus === "auditioning") {
        return `${description} Auditioning…`;
      }
      if (snapshot.takeReviewFailure) {
        return `${description} ${snapshot.takeReviewFailure.message}`;
      }
      return `${description} Audition it, retry, or discard it.`;
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
  statusElement,
}: MicrophoneRecordingControllerOptions) {
  let unsubscribe: (() => void) | null = null;

  function render(snapshot: MicrophoneRecordingSnapshot): void {
    const hasStoppedTake = snapshot.status === "stopped" && Boolean(snapshot.take);

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
    auditionButton.disabled = !hasStoppedTake;
    retryButton.disabled = !hasStoppedTake;
    discardButton.disabled = !hasStoppedTake;

    armButton.textContent = snapshot.status === "requesting-permission"
      ? "Enabling…"
      : "Enable Microphone";
    recordButton.textContent = snapshot.status === "recording"
      ? "Recording…"
      : "Record";
    auditionButton.textContent = snapshot.takeReviewStatus === "auditioning"
      ? "Stop Audition"
      : "Audition Take";
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
