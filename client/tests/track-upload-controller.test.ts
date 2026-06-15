import { createTrackUploadController } from "../src/controllers/track-upload-controller.js";
import type { Project, Track, UploadTrackInput } from "../src/types.js";
import {
  createFakeContainer,
  createFakeFileInput,
  createFakeForm,
  createFakeInput,
  createFakeSelect,
  createFakeTextElement,
} from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    title: "Chorus Riff Idea",
    description: "Guitar riff with scratch drums",
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    ...overrides,
  };
}

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    projectId: "project-1",
    name: "Guitar",
    originalFilename: "guitar-riff.wav",
    filePath: "server/uploads/projects/project-1/guitar-riff.wav",
    mimeType: "audio/wav",
    fileSize: 123,
    createdAt: "2026-06-10T00:00:00.000Z",
    ...overrides,
  };
}

function createAudioFile(): File {
  return new File(["fake wav data"], "guitar-riff.wav", {
    type: "audio/wav",
  });
}

tester.describe("track upload controller", () => {
  tester.it("loads projects into the project select on init", async () => {
    const form = createFakeForm();
    const projectSelect = createFakeSelect();
    const trackNameInput = createFakeInput();
    const audioFileInput = createFakeFileInput();
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [
            createProject({
              id: "project-1",
              title: "Chorus Riff Idea",
            }),
          ];
        },
      },
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },
        async uploadTrack() {
          throw new Error("uploadTrack should not be called during init.");
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender.map((track) => track.name).join(", ");
      },
    });

    await controller.init();

    tester.expect(projectSelect.innerHTML).toBe(
      '<option value="">Select a project</option><option value="project-1">Chorus Riff Idea</option>',
    );
    tester.expect(statusElement.textContent).toBe("");
  });

  tester.it("uploads the selected audio file to the selected project", async () => {
    const audioFile = createAudioFile();

    const form = createFakeForm();
    const projectSelect = createFakeSelect("project-1");
    const trackNameInput = createFakeInput("Guitar");
    const audioFileInput = createFakeFileInput([audioFile]);
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    const uploadTrackCalls: UploadTrackInput[] = [];

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [createProject()];
        },
      },
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },
        async uploadTrack(input: UploadTrackInput) {
          uploadTrackCalls.push(input);
          return createTrack({
            projectId: input.projectId,
            name: input.trackName,
            originalFilename: input.audioFile.name,
            mimeType: input.audioFile.type,
            fileSize: input.audioFile.size,
          });
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender.map((track) => track.name).join(", ");
      },
    });

    await controller.init();
    const submitEvent = await form.submit();

    tester.expect(submitEvent.defaultPrevented).toBe(true);
    tester.expect(uploadTrackCalls.length).toBe(1);
    tester.expect(uploadTrackCalls[0].projectId).toBe("project-1");
    tester.expect(uploadTrackCalls[0].trackName).toBe("Guitar");
    tester.expect(uploadTrackCalls[0].audioFile).toBe(audioFile);
  });

  tester.it("shows an error when no project is selected", async () => {
    const form = createFakeForm();
    const projectSelect = createFakeSelect("");
    const trackNameInput = createFakeInput("Guitar");
    const audioFileInput = createFakeFileInput([createAudioFile()]);
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    let uploadCallCount = 0;

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [createProject()];
        },
      },
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },
        async uploadTrack() {
          uploadCallCount += 1;
          return createTrack();
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender.map((track) => track.name).join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(uploadCallCount).toBe(0);
    tester.expect(statusElement.textContent).toBe("Select a project first.");
  });

  tester.it("shows an error when no audio file is selected", async () => {
    const form = createFakeForm();
    const projectSelect = createFakeSelect("project-1");
    const trackNameInput = createFakeInput("Guitar");
    const audioFileInput = createFakeFileInput([]);
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    let uploadCallCount = 0;

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [createProject()];
        },
      },
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },
        async uploadTrack() {
          uploadCallCount += 1;
          return createTrack();
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender.map((track) => track.name).join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(uploadCallCount).toBe(0);
    tester.expect(statusElement.textContent).toBe("Choose an audio file to upload.");
  });

  tester.it("resets the form and shows a success message after upload", async () => {
    const form = createFakeForm();
    const projectSelect = createFakeSelect("project-1");
    const trackNameInput = createFakeInput("Guitar");
    const audioFileInput = createFakeFileInput([createAudioFile()]);
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [createProject()];
        },
      },
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },
        async uploadTrack() {
          return createTrack();
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender.map((track) => track.name).join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(form.getResetCallCount()).toBe(1);
    tester.expect(statusElement.textContent).toBe("Track uploaded.");
  });

  tester.it("shows an error when upload fails", async () => {
    const form = createFakeForm();
    const projectSelect = createFakeSelect("project-1");
    const trackNameInput = createFakeInput("Guitar");
    const audioFileInput = createFakeFileInput([createAudioFile()]);
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [createProject()];
        },
      },
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },
        async uploadTrack() {
          throw new Error("Upload failed");
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender.map((track) => track.name).join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(form.getResetCallCount()).toBe(0);
    tester.expect(statusElement.textContent).toBe("Could not upload track.");
  });

  tester.it("loads tracks for the selected project after upload", async () => {
    const form = createFakeForm();
    const projectSelect = createFakeSelect("project-1");
    const trackNameInput = createFakeInput("Guitar");
    const audioFileInput = createFakeFileInput([createAudioFile()]);
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    let getTracksCallCount = 0;

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [createProject()];
        },
      },
      tracksApi: {
        async getTracksByProjectId(projectId: string) {
          getTracksCallCount += 1;

          if (projectId !== "project-1") {
            throw new Error("Unexpected project ID.");
          }

          if (getTracksCallCount === 1) {
            return [];
          }

          return [
            createTrack({
              name: "Guitar",
              originalFilename: "guitar-riff.wav",
              mimeType: "audio/wav",
            }),
          ];
        },
        async uploadTrack() {
          return createTrack();
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender
          .map((track) => {
            return `${track.name} | ${track.originalFilename} | ${track.mimeType}`;
          })
          .join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(getTracksCallCount).toBe(2);
    tester.expect(trackListElement.innerHTML).toBe(
      "Guitar | guitar-riff.wav | audio/wav",
    );
  });

  tester.it("shows backend error message when uploaded file type is unsupported", async () => {
    const form = createFakeForm();
    const projectSelect = createFakeSelect("project-1");
    const trackNameInput = createFakeInput("Guitar");
    const audioFileInput = createFakeFileInput([createAudioFile()]);
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [createProject()];
        },
      },
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },
        async uploadTrack() {
          throw new Error("Unsupported audio file type.");
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender.map((track) => track.name).join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(form.getResetCallCount()).toBe(0);
    tester.expect(statusElement.textContent).toBe("Unsupported audio file type.");
  });

  tester.it("shows backend error message when uploaded file is too large", async () => {
    const form = createFakeForm();
    const projectSelect = createFakeSelect("project-1");
    const trackNameInput = createFakeInput("Guitar");
    const audioFileInput = createFakeFileInput([createAudioFile()]);
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [createProject()];
        },
      },
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },
        async uploadTrack() {
          throw new Error("Audio file is too large.");
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender.map((track) => track.name).join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(form.getResetCallCount()).toBe(0);
    tester.expect(statusElement.textContent).toBe("Audio file is too large.");
  });

  tester.it("shows backend error message when project no longer exists", async () => {
    const form = createFakeForm();
    const projectSelect = createFakeSelect("project-1");
    const trackNameInput = createFakeInput("Guitar");
    const audioFileInput = createFakeFileInput([createAudioFile()]);
    const statusElement = createFakeTextElement();
    const trackListElement = createFakeContainer();

    const controller = createTrackUploadController({
      form,
      projectSelect,
      trackNameInput,
      audioFileInput,
      statusElement,
      trackListElement,
      projectsApi: {
        async getProjects() {
          return [createProject()];
        },
      },
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },
        async uploadTrack() {
          throw new Error("Project not found.");
        },
      },
      renderTrackList(tracksToRender: Track[]) {
        return tracksToRender.map((track) => track.name).join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(form.getResetCallCount()).toBe(0);
    tester.expect(statusElement.textContent).toBe("Project not found.");
  });
});