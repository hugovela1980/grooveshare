import type {
    AddPendingTrackInput,
    PendingTrackDraft,
} from "../project-draft/project-draft-state.js";

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

type PendingTrackSelectionControllerOptions = {
    openModalButton: ButtonLike;
    audioFileInput: FileInputLike;
    statusElement: TextElementLike;
    tracksToIncludeSection: HiddenElementLike;
    pendingTrackListElement: ListElementLike;
    projectDraftState: ProjectDraftStateLike;
    renderPendingTrackList: (pendingTracks: PendingTrackDraft[]) => string;
};

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

export function createPendingTrackSelectionController({
    openModalButton,
    audioFileInput,
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

        const filesToAdd = newlySelectedFiles.slice(0, slotsRemaining);

        const pendingTrackInputs = filesToAdd.map((audioFile) => {
            return {
                trackName: getDefaultTrackName(audioFile.name),
                audioFile,
            };
        });

        projectDraftState.addPendingTracks(pendingTrackInputs);

        if (newlySelectedFiles.length > slotsRemaining) {
            statusElement.textContent = `Only ${slotsRemaining} more audio track${slotsRemaining === 1 ? "" : "s"
                } could be added.`;
        } else {
            statusElement.textContent =
                pendingTrackInputs.length === 1
                    ? "Track added to project draft."
                    : "Tracks added to project draft.";
        }

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
        openModalButton.addEventListener("click", handleAddTracksClick);

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