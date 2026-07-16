import type { Project, Track, UploadTrackInput } from "../types.js";

type SubmitEventLike = {
    preventDefault: () => void;
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

type ElementLike = {
    innerHTML: string;
};

type TracksApi = {
    getTracksByProjectId: (projectId: string) => Promise<Track[]>;
    uploadTrack: (input: UploadTrackInput) => Promise<Track>;
};

type RenderTrackList = (tracks: Track[]) => string;

type ProjectPlayerPageControllerOptions = {
    project: Project;
    form: FormLike;
    trackNameInput: InputLike;
    audioFileInput: FileInputLike;
    statusElement: TextElementLike;
    trackListElement: ElementLike;
    tracksApi: TracksApi;
    renderTrackList: RenderTrackList;
};

export function createProjectPlayerPageController({
    project,
    form,
    trackNameInput,
    audioFileInput,
    statusElement,
    trackListElement,
    tracksApi,
    renderTrackList,
}: ProjectPlayerPageControllerOptions) {
    async function loadTracks(): Promise<void> {
        try {
            const tracks = await tracksApi.getTracksByProjectId(project.id);
            trackListElement.innerHTML = renderTrackList(tracks);
        } catch {
            trackListElement.innerHTML =
                '<p class="empty-state">Could not load tracks.</p>';
        }
    }

    async function handleSubmit(event: SubmitEventLike): Promise<void> {
        event.preventDefault();

        const audioFile = audioFileInput.files?.[0] ?? null;

        if (!audioFile) {
            statusElement.textContent = "Choose an audio file to upload.";
            return;
        }

        const trackName = trackNameInput.value.trim();

        try {
            await tracksApi.uploadTrack({
                projectId: project.id,
                trackName,
                audioFile,
            });

            form.reset();
            statusElement.textContent = "Track uploaded.";
            await loadTracks();
        } catch {
            statusElement.textContent = "Could not upload track.";
        }
    }

    async function init(): Promise<void> {
        form.addEventListener("submit", (event) => {
            return handleSubmit(event);
        });

        await loadTracks();
    }

    return {
        init,
    };
}