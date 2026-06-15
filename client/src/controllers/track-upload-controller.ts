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

type ContainerLike = {
  innerHTML: string;
};

type ProjectsApi = {
  getProjects: () => Promise<Project[]>;
};

type TracksApi = {
  getTracksByProjectId: (projectId: string) => Promise<Track[]>;
  uploadTrack: (input: UploadTrackInput) => Promise<Track>;
};

type TrackUploadControllerOptions = {
  form: TrackUploadFormLike;
  projectSelect: SelectLike;
  trackNameInput: InputLike;
  audioFileInput: FileInputLike;
  statusElement: TextElementLike;
  trackListElement: ContainerLike;
  projectsApi: ProjectsApi;
  tracksApi: TracksApi;
  renderTrackList: (tracks: Track[]) => string;
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
  trackListElement,
  projectsApi,
  tracksApi,
  renderTrackList,
}: TrackUploadControllerOptions) {
  async function loadTracksForProject(projectId: string): Promise<void> {
    const tracks = await tracksApi.getTracksByProjectId(projectId);
    trackListElement.innerHTML = renderTrackList(tracks);
  }

  async function loadTracksForSelectedProject(): Promise<void> {
    if (!projectSelect.value) {
      trackListElement.innerHTML = renderTrackList([]);
      return;
    }

    await loadTracksForProject(projectSelect.value);
  }

  async function loadProjects(): Promise<void> {
    try {
      const projects = await projectsApi.getProjects();
      projectSelect.innerHTML = renderProjectOptions(projects);
      statusElement.textContent = "";
      await loadTracksForSelectedProject();
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

      await loadTracksForProject(projectId);

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