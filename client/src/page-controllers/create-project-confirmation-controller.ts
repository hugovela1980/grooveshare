import type { PendingTrackDraft } from "../project-draft/project-draft-state.js";
import type { CreateProjectInput, Project, Track } from "../types.js";

type ButtonLike = {
    disabled?: boolean;
    addEventListener: (
        eventName: "click",
        handler: () => void | Promise<void>,
    ) => void;
};

type TextElementLike = {
    textContent: string | null;
};

type ProjectDraftSnapshot = {
    project: CreateProjectInput | null;
    pendingTracks: PendingTrackDraft[];
};

type ProjectDraftStateLike = {
    getSnapshot: () => ProjectDraftSnapshot;
    clear: () => void;
};

type ProjectsApiLike = {
    createProject: (input: CreateProjectInput) => Promise<Project>;
};

type TracksApiLike = {
    uploadTrack: (input: {
        projectId: string;
        trackName: string;
        audioFile: File;
    }) => Promise<Track>;
};

type CreateProjectConfirmationControllerOptions = {
    submitButton: ButtonLike;
    statusElement: TextElementLike;
    projectDraftState: ProjectDraftStateLike;
    projectsApi: ProjectsApiLike;
    tracksApi: TracksApiLike;
    onProjectSubmitted: (project: Project) => void;
};

function setStatus(statusElement: TextElementLike, message: string): void {
    statusElement.textContent = message;
}

export function createCreateProjectConfirmationController({
    submitButton,
    statusElement,
    projectDraftState,
    projectsApi,
    tracksApi,
    onProjectSubmitted,
}: CreateProjectConfirmationControllerOptions) {
    async function handleSubmit(): Promise<void> {
        const snapshot = projectDraftState.getSnapshot();

        if (!snapshot.project) {
            setStatus(statusElement, "Project details are missing.");
            return;
        }

        try {
            submitButton.disabled = true;
            setStatus(statusElement, "Creating project...");

            const project = await projectsApi.createProject(snapshot.project);

            if (snapshot.pendingTracks.length > 0) {
                setStatus(
                    statusElement,
                    snapshot.pendingTracks.length === 1
                        ? "Uploading 1 track..."
                        : `Uploading ${snapshot.pendingTracks.length} tracks...`,
                );
            }

            for (const pendingTrack of snapshot.pendingTracks) {
                await tracksApi.uploadTrack({
                    projectId: project.id,
                    trackName: pendingTrack.trackName,
                    audioFile: pendingTrack.audioFile,
                });
            }

            setStatus(statusElement, "Project created.");
            projectDraftState.clear();
            onProjectSubmitted(project);
        } catch {
            setStatus(statusElement, "Could not create project.");
        } finally {
            submitButton.disabled = false;
        }
    }

    function init(): void {
        submitButton.addEventListener("click", () => {
            return handleSubmit();
        });
    }

    return {
        init,
    };
}