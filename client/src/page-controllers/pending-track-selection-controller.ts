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

function renderSelectedAudioTrackRows(files: File[]): string {
    if (files.length === 0) {
        return '<p class="empty-state">Select audio files to name them.</p>';
    }

    return files
        .map((file, index) => {
            const defaultTrackName = getDefaultTrackName(file.name);

            return /*html*/ `
        <div class="selected-audio-track-row" data-selected-audio-track-row>
          <label>
            <span>Track name</span>
            <input
              type="text"
              value="${escapeHtml(defaultTrackName)}"
              data-selected-track-name
              data-file-index="${index}"
            />
          </label>

          <div>
            <span>File</span>
            <p>${escapeHtml(file.name)}</p>
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
    function renderPendingTracks(): void {
        const pendingTracks = projectDraftState.getPendingTracks();

        pendingTrackListElement.innerHTML = renderPendingTrackList(pendingTracks);
        tracksToIncludeSection.hidden = pendingTracks.length === 0;
    }

    function renderSelectedFiles(): void {
        const selectedFiles = getFilesFromInput(audioFileInput);
        const slotsRemaining = projectDraftState.getPendingTrackSlotsRemaining();

        if (selectedFiles.length > slotsRemaining) {
            statusElement.textContent = `You can add ${slotsRemaining} more audio track${slotsRemaining === 1 ? "" : "s"
                }.`;
        }

        selectedTrackRowsElement.innerHTML = renderSelectedAudioTrackRows(
            selectedFiles.slice(0, slotsRemaining),
        );
    }

    function openModal(): void {
        modalElement.hidden = false;
        statusElement.textContent = "";
        renderSelectedFiles();
    }

    function closeModal(): void {
        modalElement.hidden = true;
        form.reset();
        selectedTrackRowsElement.innerHTML = renderSelectedAudioTrackRows([]);
    }

    function getTrackNameInputs(): InputLike[] {
        return Array.from(
            selectedTrackRowsElement.querySelectorAll?.("[data-selected-track-name]") ??
            [],
        );
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

        const selectedFiles = getFilesFromInput(audioFileInput);
        const slotsRemaining = projectDraftState.getPendingTrackSlotsRemaining();

        if (selectedFiles.length === 0) {
            statusElement.textContent = "Choose at least one audio file first.";
            return;
        }

        if (selectedFiles.length > slotsRemaining) {
            statusElement.textContent = `You can add ${slotsRemaining} more audio track${slotsRemaining === 1 ? "" : "s"
                }.`;
            return;
        }

        const trackNameInputs = getTrackNameInputs();

        const pendingTrackInputs = selectedFiles.map((audioFile, index) => {
            return {
                trackName:
                    trackNameInputs[index]?.value ?? getDefaultTrackName(audioFile.name),
                audioFile,
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
            renderSelectedFiles();
        });

        pendingTrackListElement.addEventListener?.("click", handleRemoveClick);

        modalElement.hidden = true;
        selectedTrackRowsElement.innerHTML = renderSelectedAudioTrackRows([]);
        renderPendingTracks();
    }

    return {
        init,
    };
}