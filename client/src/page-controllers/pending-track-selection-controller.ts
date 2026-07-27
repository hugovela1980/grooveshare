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
    target: ClickTargetLike | null;
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
    files: FileList | null;
};

type TextElementLike = {
    textContent: string | null;
};

type ListElementLike = {
    innerHTML: string;
    addEventListener?: (
        eventName: string,
        handler: (event: ClickEventLike) => void,
    ) => void;
};

type ProjectDraftStateLike = {
    addPendingTrack: (input: AddPendingTrackInput) => PendingTrackDraft;
    removePendingTrack: (trackDraftId: string) => void;
    getPendingTracks: () => PendingTrackDraft[];
};

type PendingTrackSelectionControllerOptions = {
    form: FormLike;
    trackNameInput: InputLike;
    audioFileInput: FileInputLike;
    statusElement: TextElementLike;
    pendingTrackListElement: ListElementLike;
    projectDraftState: ProjectDraftStateLike;
    renderPendingTrackList: (pendingTracks: PendingTrackDraft[]) => string;
};

export function createPendingTrackSelectionController({
    form,
    trackNameInput,
    audioFileInput,
    statusElement,
    pendingTrackListElement,
    projectDraftState,
    renderPendingTrackList,
}: PendingTrackSelectionControllerOptions) {
    function render(): void {
        pendingTrackListElement.innerHTML = renderPendingTrackList(
            projectDraftState.getPendingTracks(),
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
        render();
    }

    function handleSubmit(event: SubmitEventLike): void {
        event.preventDefault();

        const audioFile = audioFileInput.files?.[0] ?? null;

        if (!audioFile) {
            statusElement.textContent = "Choose an audio file first.";
            return;
        }

        projectDraftState.addPendingTrack({
            trackName: trackNameInput.value,
            audioFile,
        });

        form.reset();
        statusElement.textContent = "Track added to project draft.";
        render();
    }

    function init(): void {
        form.addEventListener("submit", handleSubmit);

        pendingTrackListElement.addEventListener?.("click", handleRemoveClick);

        render();
    }

    return {
        init,
    };
}