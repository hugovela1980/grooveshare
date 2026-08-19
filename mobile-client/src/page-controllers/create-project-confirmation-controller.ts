import type { PendingTrackDraft as CorePendingTrackDraft } from "@hugovela/frontend-core";

type PendingTrackDraft = CorePendingTrackDraft<File>;
import type { CreateProjectInput, Project, Track } from "../types.js";
import {
  formatFileSize,
} from "../uploads/mobile-audio-files.js";
import {
  setControlBusy,
  type BusyControlLike,
} from "../ui/async-state.js";

type ButtonLike = BusyControlLike & {
  textContent?: string | null;
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

export function createCreateProjectConfirmationController({
  submitButton,
  statusElement,
  projectDraftState,
  projectsApi,
  tracksApi,
  onProjectSubmitted,
}: CreateProjectConfirmationControllerOptions) {
  let submissionInFlight = false;
  let projectCreatedWithUploadFailures: Project | null = null;

  function finishProject(project: Project): void {
    projectDraftState.clear();
    onProjectSubmitted(project);
  }

  async function handleSubmit(): Promise<void> {
    if (submissionInFlight) {
      return;
    }

    if (projectCreatedWithUploadFailures) {
      finishProject(projectCreatedWithUploadFailures);
      return;
    }

    const snapshot = projectDraftState.getSnapshot();

    if (!snapshot.project) {
      setStatus(statusElement, "Project details are missing.");
      return;
    }

    submissionInFlight = true;
    setControlBusy(submitButton, true);

    let project: Project;

    try {
      setStatus(statusElement, "Creating project...");
      project = await projectsApi.createProject(snapshot.project);
    } catch (error) {
      setStatus(
        statusElement,
        getErrorMessage(error, "Could not create project."),
      );
      setControlBusy(submitButton, false);
      submissionInFlight = false;
      return;
    }

    const failedTracks: PendingTrackDraft[] = [];

    for (const [index, pendingTrack] of snapshot.pendingTracks.entries()) {
      setStatus(
        statusElement,
        `Uploading ${index + 1} of ${snapshot.pendingTracks.length}: ${pendingTrack.originalFilename} (${formatFileSize(pendingTrack.audioFile.size)})...`,
      );

      try {
        await tracksApi.uploadTrack({
          projectId: project.id,
          trackName: pendingTrack.trackName,
          audioFile: pendingTrack.audioFile,
        });
      } catch {
        failedTracks.push(pendingTrack);
      }
    }

    setControlBusy(submitButton, false);
    submissionInFlight = false;

    if (failedTracks.length > 0) {
      projectCreatedWithUploadFailures = project;
      projectDraftState.clear();

      const failedNames = failedTracks
        .map((track) => track.originalFilename)
        .join(", ");

      setStatus(
        statusElement,
        `Project created, but ${failedTracks.length} track${failedTracks.length === 1 ? "" : "s"} could not upload: ${failedNames}. Open the project and add ${failedTracks.length === 1 ? "it" : "them"} again later.`,
      );

      if (submitButton.textContent !== undefined) {
        submitButton.textContent = "Open Project";
      }

      return;
    }

    setStatus(statusElement, "Project created.");
    finishProject(project);
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
