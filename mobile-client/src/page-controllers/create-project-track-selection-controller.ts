import type {
  AddPendingTrackInput,
  PendingTrackDraft,
} from "../project-draft/project-draft-state.js";
import {
  getDefaultTrackNameFromAudioFile,
  validateMobileAudioFile,
  type MobileAudioFileValidationResult,
} from "../uploads/mobile-audio-files.js";

type ClickTargetLike = {
  closest?: (
    selector: string,
  ) => { getAttribute: (name: string) => string | null } | null;
  getAttribute?: (name: string) => string | null;
  value?: string;
};

type ClickEventLike = {
  preventDefault?: () => void;
  target?: ClickTargetLike | null;
};

type ChangeEventLike = {
  target?: ClickTargetLike | null;
};

type ButtonLike = {
  addEventListener: (
    eventName: string,
    handler: (event: ClickEventLike) => void | Promise<void>,
  ) => void;
};

type FileInputLike = {
  files: ArrayLike<File> | Iterable<File> | null;
  value?: string;
  click?: () => void;
  addEventListener?: (
    eventName: string,
    handler: (event: ChangeEventLike) => void,
  ) => void;
};

type TextElementLike = {
  textContent: string | null;
};

type HiddenElementLike = {
  hidden: boolean | "until-found";
};

type ListElementLike = {
  innerHTML: string;
  addEventListener?: (
    eventName: "click" | "input",
    handler: (event: ClickEventLike) => void,
  ) => void;
};

type ProjectDraftStateLike = {
  addPendingTracks: (inputs: AddPendingTrackInput[]) => PendingTrackDraft[];
  updatePendingTrackName: (trackDraftId: string, trackName: string) => void;
  removePendingTrack: (trackDraftId: string) => void;
  getPendingTracks: () => PendingTrackDraft[];
  getPendingTrackSlotsRemaining: () => number;
};

type CreateProjectTrackSelectionControllerOptions = {
  addTracksButton: ButtonLike;
  audioFileInput: FileInputLike;
  statusElement: TextElementLike;
  tracksToIncludeSection: HiddenElementLike;
  pendingTrackListElement: ListElementLike;
  projectDraftState: ProjectDraftStateLike;
  renderPendingTrackList: (pendingTracks: PendingTrackDraft[]) => string;
  validateAudioFile?: (file: File) => MobileAudioFileValidationResult;
};

function getFilesFromInput(audioFileInput: FileInputLike): File[] {
  return Array.from(audioFileInput.files ?? []);
}

export function createProjectTrackSelectionController({
  addTracksButton,
  audioFileInput,
  statusElement,
  tracksToIncludeSection,
  pendingTrackListElement,
  projectDraftState,
  renderPendingTrackList,
  validateAudioFile = validateMobileAudioFile,
}: CreateProjectTrackSelectionControllerOptions) {
  function renderPendingTracks(): void {
    const pendingTracks = projectDraftState.getPendingTracks();

    pendingTrackListElement.innerHTML = renderPendingTrackList(pendingTracks);
    tracksToIncludeSection.hidden = pendingTracks.length === 0;
  }

  function resetNativeFileInput(): void {
    audioFileInput.value = "";
  }

  function handleAddTracksClick(event: ClickEventLike): void {
    event.preventDefault?.();
    statusElement.textContent = "";
    audioFileInput.click?.();
  }

  function handleAudioFileChange(): void {
    const newlySelectedFiles = getFilesFromInput(audioFileInput);
    const slotsRemaining = projectDraftState.getPendingTrackSlotsRemaining();

    if (newlySelectedFiles.length === 0) {
      return;
    }

    if (slotsRemaining === 0) {
      statusElement.textContent =
        "This project already has the maximum number of audio tracks.";
      resetNativeFileInput();
      return;
    }

    const validFiles: File[] = [];
    const validationErrors: string[] = [];

    for (const audioFile of newlySelectedFiles) {
      const validation = validateAudioFile(audioFile);

      if (!validation.ok) {
        validationErrors.push(validation.error);
        continue;
      }

      validFiles.push(audioFile);
    }

    const filesToAdd = validFiles.slice(0, slotsRemaining);
    const pendingTrackInputs = filesToAdd.map((audioFile) => {
      return {
        trackName: getDefaultTrackNameFromAudioFile(audioFile),
        audioFile,
      };
    });

    if (pendingTrackInputs.length > 0) {
      projectDraftState.addPendingTracks(pendingTrackInputs);
    }

    const messages: string[] = [];

    if (validationErrors.length > 0) {
      messages.push(validationErrors.join(" "));
    }

    if (validFiles.length > slotsRemaining) {
      messages.push(
        `Only ${slotsRemaining} more audio track${slotsRemaining === 1 ? "" : "s"} could be added.`,
      );
    } else if (pendingTrackInputs.length === 1) {
      messages.push("Track added to project draft.");
    } else if (pendingTrackInputs.length > 1) {
      messages.push("Tracks added to project draft.");
    }

    statusElement.textContent = messages.join(" ");
    resetNativeFileInput();
    renderPendingTracks();
  }

  function handlePendingTrackNameInput(event: ClickEventLike): void {
    const input = event.target;
    const pendingTrackId = input?.getAttribute?.("data-pending-track-name");

    if (!pendingTrackId) {
      return;
    }

    projectDraftState.updatePendingTrackName(
      pendingTrackId,
      input?.value ?? "",
    );

    statusElement.textContent = "";
  }

  function handleRemoveClick(event: ClickEventLike): void {
    const removeButton = event.target?.closest?.("[data-pending-track-id]");
    const pendingTrackId = removeButton?.getAttribute("data-pending-track-id");

    if (!pendingTrackId) {
      return;
    }

    projectDraftState.removePendingTrack(pendingTrackId);
    statusElement.textContent = "Track removed.";
    renderPendingTracks();
  }

  function init(): void {
    addTracksButton.addEventListener("click", handleAddTracksClick);

    audioFileInput.addEventListener?.("change", () => {
      handleAudioFileChange();
    });

    pendingTrackListElement.addEventListener?.("input", handlePendingTrackNameInput);
    pendingTrackListElement.addEventListener?.("click", handleRemoveClick);

    renderPendingTracks();
  }

  return {
    init,
  };
}
