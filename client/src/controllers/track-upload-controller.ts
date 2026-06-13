import type { Project, Track, UploadTrackInput } from "../types.js";

type TrackUploadFormLike = {
  addEventListener: (
    eventName: string,
    handler: (event: { preventDefault: () => void }) => void | Promise<void>,
  ) => void;
  reset: () => void;
};

type SelectLike = {
  value: string;
  innerHTML: string;
};

type InputLike = {
  value: string;
};

type FileInputLike = {
  files: File[] | FileList | null;
};

type TextElementLike = {
  textContent: string | null;
};

type ProjectsApi = {
  getProjects: () => Promise<Project[]>;
};

type TracksApi = {
  uploadTrack: (input: UploadTrackInput) => Promise<Track>;
};

type TrackUploadControllerOptions = {
  form: TrackUploadFormLike;
  projectSelect: SelectLike;
  trackNameInput: InputLike;
  audioFileInput: FileInputLike;
  statusElement: TextElementLike;
  projectsApi: ProjectsApi;
  tracksApi: TracksApi;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProjectOptions(projects: Project[]): string {
  return [
    '<option value="">Select a project</option>',
    ...projects.map((project) => {
      return `<option value="${escapeHtml(project.id)}">${escapeHtml(
        project.title,
      )}</option>`;
    }),
  ].join("");
}

function getSelectedFile(fileInput: FileInputLike): File | null {
  return fileInput.files?.[0] ?? null;
}

export function createTrackUploadController({
  form,
  projectSelect,
  trackNameInput,
  audioFileInput,
  statusElement,
  projectsApi,
  tracksApi,
}: TrackUploadControllerOptions) {
  async function loadProjects(): Promise<void> {
    try {
      const projects = await projectsApi.getProjects();
      projectSelect.innerHTML = renderProjectOptions(projects);
      statusElement.textContent = "";
    } catch {
      statusElement.textContent = "Could not load projects for upload.";
    }
  }

  async function handleSubmit(event: {
    preventDefault: () => void;
  }): Promise<void> {
    event.preventDefault();

    const projectId = projectSelect.value;
    const audioFile = getSelectedFile(audioFileInput);
    const trackName = trackNameInput.value.trim();

    if (!projectId) {
      statusElement.textContent = "Select a project first.";
      return;
    }

    if (!audioFile) {
      statusElement.textContent = "Choose an audio file to upload.";
      return;
    }

    try {
      await tracksApi.uploadTrack({
        projectId,
        trackName,
        audioFile,
      });

      form.reset();
      statusElement.textContent = "Track uploaded.";
    } catch {
      statusElement.textContent = "Could not upload track.";
    }
  }

  async function init(): Promise<void> {
    form.addEventListener("submit", (event) => {
      return handleSubmit(event);
    });

    await loadProjects();
  }

  return {
    init,
  };
}