import type {
    PendingTrackDraft,
    ProjectDraft,
} from "../project-draft/project-draft-state.js";
import type { Project, Track } from "../types.js";

type ClickEventLike = {
    preventDefault?: () => void;
};

type ButtonLike = {
    addEventListener: (
        eventName: string,
        handler: (event: ClickEventLike) => void | Promise<void>,
    ) => void;
};

type TextElementLike = {
    textContent: string | null;
};

type ProjectsApi = {
    createProject: (input: ProjectDraft) => Promise<Project>;
};

type TracksApi = {
    uploadTrack: (input: {
        projectId: string;
        trackName: string;
        audioFile: File;
    }) => Promise<Track>;
};

type ProjectDraftStateLike = {
    getProjectDraft: () => ProjectDraft | null;
    getPendingTracks: () => PendingTrackDraft[];
    clear: () => void;
};

type ConfirmProjectPageControllerOptions = {
    submitButton: ButtonLike;
    statusElement: TextElementLike;
    projectDraftState: ProjectDraftStateLike;
    projectsApi: ProjectsApi;
    tracksApi: TracksApi;
    onProjectSubmitted: (project: Project) => void;
};

export function createConfirmProjectPageController({
    submitButton,
    statusElement,
    projectDraftState,
    projectsApi,
    tracksApi,
    onProjectSubmitted,
}: ConfirmProjectPageControllerOptions) {
    async function handleSubmit(event: ClickEventLike): Promise<void> {
        event.preventDefault?.();

        const projectDraft = projectDraftState.getProjectDraft();

        if (!projectDraft) {
            statusElement.textContent = "Project draft is missing.";
            return;
        }

        try {
            statusElement.textContent = "Creating project...";

            const project = await projectsApi.createProject(projectDraft);
            const pendingTracks = projectDraftState.getPendingTracks();

            if (pendingTracks.length > 0) {
                statusElement.textContent =
                    pendingTracks.length === 1
                        ? "Uploading 1 track..."
                        : `Uploading ${pendingTracks.length} tracks...`;
            }

            for (const pendingTrack of pendingTracks) {
                await tracksApi.uploadTrack({
                    projectId: project.id,
                    trackName: pendingTrack.trackName,
                    audioFile: pendingTrack.audioFile,
                });
            }

            projectDraftState.clear();
            statusElement.textContent = "Project created.";
            onProjectSubmitted(project);
        } catch {
            statusElement.textContent = "Could not create project.";
        }
    }

    function init(): void {
        submitButton.addEventListener("click", (event) => {
            return handleSubmit(event);
        });
    }

    return {
        init,
    };
}