import type {
    AddPendingTrackInput,
    PendingTrackDraft,
} from "../project-draft/project-draft-state.js";

type SubmitEventLike = {
    preventDefault: () => void;
};

type ClickTargetLike = {
    closest?: (
        selector: string,
    ) => { getAttribute: (name: string) => string | null } | null;
};

type ClickEventLike = {
    preventDefault?: () => void;
    target?: ClickTargetLike | null;
};

type ChangeEventLike = Record<string, never>;

type ButtonLike = {
    addEventListener: (
        eventName: string,
        handler: (event: ClickEventLike) => void | Promise<void>,
    ) => void;
};

type FormLike = {
    addEventListener: (
        eventName: string,
        handler: (event: SubmitEventLike) => void | Promise<void>,
    ) => void;
    reset: () => void;
};

type InputLike = {
    value: string;
};

type FileInputLike = {
    files: ArrayLike<File> | Iterable<File> | null;
    value?: string;
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
        eventName: string,
        handler: (event: ClickEventLike) => void,
    ) => void;
};

type SelectedTrackRowsElementLike = {
    innerHTML: string;
    querySelectorAll?: (selector: string) => ArrayLike<InputLike>;
};

type ProjectDraftStateLike = {
    addPendingTracks: (inputs: AddPendingTrackInput[]) => PendingTrackDraft[];
    removePendingTrack: (trackDraftId: string) => void;
    getPendingTracks: () => PendingTrackDraft[];
    getPendingTrackSlotsRemaining: () => number;
};

type SelectedAudioTrackDraft = {
    trackName: string;
    audioFile: File;
};

type PendingTrackSelectionControllerOptions = {
    openModalButton: ButtonLike;
    closeModalButton: ButtonLike;
    cancelButton: ButtonLike;
    modalElement: HiddenElementLike;
    form: FormLike;
    audioFileInput: FileInputLike;
    selectedTrackRowsElement: SelectedTrackRowsElementLike;
    statusElement: TextElementLike;
    tracksToIncludeSection: HiddenElementLike;
    pendingTrackListElement: ListElementLike;
    projectDraftState: ProjectDraftStateLike;
    renderPendingTrackList: (pendingTracks: PendingTrackDraft[]) => string;
};

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getDefaultTrackName(filename: string): string {
    const extensionStartIndex = filename.lastIndexOf(".");

    if (extensionStartIndex <= 0) {
        return filename;
    }

    return filename.slice(0, extensionStartIndex);
}

function getFilesFromInput(audioFileInput: FileInputLike): File[] {
    return Array.from(audioFileInput.files ?? []);
}

function renderSelectedAudioTrackRows(
    selectedAudioTracks: SelectedAudioTrackDraft[],
): string {
    if (selectedAudioTracks.length === 0) {
        return '<p class="empty-state">Select audio files to name them.</p>';
    }

    return selectedAudioTracks
        .map((selectedAudioTrack, index) => {
            return /*html*/ `
        <div class="selected-audio-track-row" data-selected-audio-track-row>
          <label>
            <span>Track name</span>
            <input
              type="text"
              value="${escapeHtml(selectedAudioTrack.trackName)}"
              data-selected-track-name
              data-file-index="${index}"
            />
          </label>

          <div>
            <span>File</span>
            <p>${escapeHtml(selectedAudioTrack.audioFile.name)}</p>
          </div>
        </div>
      `;
        })
        .join("");
}

export function createPendingTrackSelectionController({
    openModalButton,
    closeModalButton,
    cancelButton,
    modalElement,
    form,
    audioFileInput,
    selectedTrackRowsElement,
    statusElement,
    tracksToIncludeSection,
    pendingTrackListElement,
    projectDraftState,
    renderPendingTrackList,
}: PendingTrackSelectionControllerOptions) {
    let selectedAudioTracks: SelectedAudioTrackDraft[] = [];

    function getTrackNameInputs(): InputLike[] {
        return Array.from(
            selectedTrackRowsElement.querySelectorAll?.("[data-selected-track-name]") ??
            [],
        );
    }

    function syncSelectedTrackNamesFromInputs(): void {
        const trackNameInputs = getTrackNameInputs();

        selectedAudioTracks = selectedAudioTracks.map((selectedAudioTrack, index) => {
            return {
                ...selectedAudioTrack,
                trackName:
                    trackNameInputs[index]?.value.trim() ||
                    selectedAudioTrack.trackName ||
                    selectedAudioTrack.audioFile.name,
            };
        });
    }

    function renderPendingTracks(): void {
        const pendingTracks = projectDraftState.getPendingTracks();

        pendingTrackListElement.innerHTML = renderPendingTrackList(pendingTracks);
        tracksToIncludeSection.hidden = pendingTracks.length === 0;
    }

    function renderSelectedFiles(): void {
        selectedTrackRowsElement.innerHTML =
            renderSelectedAudioTrackRows(selectedAudioTracks);
    }

    function resetNativeFileInput(): void {
        audioFileInput.value = "";
    }

    function openModal(): void {
        modalElement.hidden = false;
        statusElement.textContent = "";
        renderSelectedFiles();
    }

    function closeModal(): void {
        modalElement.hidden = true;
        selectedAudioTracks = [];
        form.reset();
        resetNativeFileInput();
        renderSelectedFiles();
    }

    function handleAudioFileChange(): void {
        syncSelectedTrackNamesFromInputs();

        const newlySelectedFiles = getFilesFromInput(audioFileInput);
        const slotsRemaining = projectDraftState.getPendingTrackSlotsRemaining();
        const modalSlotsRemaining = Math.max(
            slotsRemaining - selectedAudioTracks.length,
            0,
        );

        if (newlySelectedFiles.length === 0) {
            renderSelectedFiles();
            return;
        }

        if (modalSlotsRemaining === 0) {
            statusElement.textContent =
                "This project already has the maximum number of audio tracks.";
            resetNativeFileInput();
            renderSelectedFiles();
            return;
        }

        const filesToAdd = newlySelectedFiles.slice(0, modalSlotsRemaining);

        selectedAudioTracks = [
            ...selectedAudioTracks,
            ...filesToAdd.map((audioFile) => {
                return {
                    trackName: getDefaultTrackName(audioFile.name),
                    audioFile,
                };
            }),
        ];

        if (newlySelectedFiles.length > modalSlotsRemaining) {
            statusElement.textContent = `Only ${modalSlotsRemaining} more audio track${modalSlotsRemaining === 1 ? "" : "s"
                } could be added.`;
        } else {
            statusElement.textContent =
                selectedAudioTracks.length === 1
                    ? "1 audio file selected."
                    : `${selectedAudioTracks.length} audio files selected.`;
        }

        resetNativeFileInput();
        renderSelectedFiles();
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

    function handleSubmit(event: SubmitEventLike): void {
        event.preventDefault();

        syncSelectedTrackNamesFromInputs();

        if (selectedAudioTracks.length === 0) {
            statusElement.textContent = "Choose at least one audio file first.";
            return;
        }

        const pendingTrackInputs = selectedAudioTracks.map((selectedAudioTrack) => {
            return {
                trackName: selectedAudioTrack.trackName,
                audioFile: selectedAudioTrack.audioFile,
            };
        });

        projectDraftState.addPendingTracks(pendingTrackInputs);

        statusElement.textContent =
            pendingTrackInputs.length === 1
                ? "Track added to project draft."
                : "Tracks added to project draft.";

        renderPendingTracks();
        closeModal();
    }

    function init(): void {
        openModalButton.addEventListener("click", openModal);
        closeModalButton.addEventListener("click", closeModal);
        cancelButton.addEventListener("click", closeModal);

        form.addEventListener("submit", handleSubmit);

        audioFileInput.addEventListener?.("change", () => {
            handleAudioFileChange();
        });

        pendingTrackListElement.addEventListener?.("click", handleRemoveClick);

        modalElement.hidden = true;
        renderSelectedFiles();
        renderPendingTracks();
    }

    return {
        init,
    };
}