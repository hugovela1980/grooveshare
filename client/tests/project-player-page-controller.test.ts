import { createProjectPlayerPageController } from "../src/page-controllers/project-player-page-controller.js";
import type { Project, Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

function createProject(): Project {
  return {
    id: "project-1",
    title: "Bass Groove",
    description: "Practice loop",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function createTrack(): Track {
  return {
    id: "track-1",
    projectId: "project-1",
    name: "Guitar",
    originalFilename: "guitar.wav",
    filePath: "server/uploads/projects/project-1/guitar.wav",
    mimeType: "audio/wav",
    fileSize: 123,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

type FakeClickEvent = {
  target: EventTarget | null;
};

function createFakeTrackListElement() {
  let clickHandler: ((event: FakeClickEvent) => void | Promise<void>) | null =
    null;

  return {
    innerHTML: "",

    addEventListener(
      eventName: "click",
      handler: (event: FakeClickEvent) => void | Promise<void>,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },

    async clickDeleteButton(trackId: string): Promise<void> {
      if (!clickHandler) {
        throw new Error("Click handler was not registered.");
      }

      await clickHandler({
        target: {
          closest(selector: string) {
            if (selector !== "[data-track-delete-button]") {
              return null;
            }

            return {
              dataset: {
                trackId,
              },
            };
          },
        } as unknown as EventTarget,
      });
    },

    async clickLoadButton(trackId: string): Promise<void> {
      if (!clickHandler) {
        throw new Error("Click handler was not registered.");
      }

      await clickHandler({
        target: {
          closest(selector: string) {
            if (selector !== "[data-track-load-button]") {
              return null;
            }

            return {
              dataset: {
                trackId,
              },
            };
          },
        } as unknown as EventTarget,
      });
    },
  };
}

function createFakeStatusElement() {
  return {
    textContent: "",
  };
}

function createFakeDeleteProjectButton() {
  let clickHandler: (() => void | Promise<void>) | null = null;

  return {
    addEventListener(
      eventName: "click",
      handler: () => void | Promise<void>,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },

    async click(): Promise<void> {
      if (!clickHandler) {
        throw new Error("Click handler was not registered.");
      }

      await clickHandler();
    },
  };
}

tester.describe("project player page controller", () => {
  tester.it("loads tracks for the selected project on init", async () => {
    const trackListElement = createFakeTrackListElement();

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      tracksApi: {
        async getTracksByProjectId(projectId) {
          tester.expect(projectId).toBe("project-1");
          return [createTrack()];
        },

        async deleteTrack() {
          throw new Error("deleteTrack should not be called in this test.");
        },
      },
      renderTrackList(tracks) {
        return tracks.map((track) => track.name).join(", ");
      },
    });

    await controller.init();

    tester.expect(trackListElement.innerHTML).toBe("Guitar");
  });

  tester.it("shows an error message when tracks cannot load", async () => {
    const trackListElement = createFakeTrackListElement();

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      tracksApi: {
        async getTracksByProjectId() {
          throw new Error("API failed.");
        },

        async deleteTrack() {
          throw new Error("deleteTrack should not be called in this test.");
        },
      },
      renderTrackList(tracks) {
        return tracks.map((track) => track.name).join(", ");
      },
    });

    await controller.init();

    tester.expect(trackListElement.innerHTML).toBe(
      '<p class="empty-state">Could not load tracks.</p>',
    );
  });

  tester.it("deletes a track and reloads the track list", async () => {
    const trackListElement = createFakeTrackListElement();
    const statusElement = createFakeStatusElement();

    let getTracksCallCount = 0;
    let deletedProjectId = "";
    let deletedTrackId = "";

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      statusElement,
      tracksApi: {
        async getTracksByProjectId(projectId) {
          tester.expect(projectId).toBe("project-1");

          getTracksCallCount += 1;

          if (getTracksCallCount === 1) {
            return [createTrack()];
          }

          return [];
        },

        async deleteTrack(projectId, trackId) {
          deletedProjectId = projectId;
          deletedTrackId = trackId;

          return createTrack();
        },
      },
      renderTrackList(tracks) {
        if (tracks.length === 0) {
          return '<p class="empty-state">No tracks yet.</p>';
        }

        return tracks.map((track) => track.name).join(", ");
      },
    });

    await controller.init();

    tester.expect(trackListElement.innerHTML).toBe("Guitar");

    await trackListElement.clickDeleteButton("track-1");

    tester.expect(deletedProjectId).toBe("project-1");
    tester.expect(deletedTrackId).toBe("track-1");
    tester.expect(getTracksCallCount).toBe(2);
    tester.expect(trackListElement.innerHTML).toBe(
      '<p class="empty-state">No tracks yet.</p>',
    );
    tester.expect(statusElement.textContent).toBe("Track deleted.");
  });

  tester.it("shows an error message when a track cannot be deleted", async () => {
    const trackListElement = createFakeTrackListElement();
    const statusElement = createFakeStatusElement();

    let getTracksCallCount = 0;

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      statusElement,
      tracksApi: {
        async getTracksByProjectId() {
          getTracksCallCount += 1;

          return [createTrack()];
        },

        async deleteTrack() {
          throw new Error("Delete failed.");
        },
      },
      renderTrackList(tracks) {
        return tracks.map((track) => track.name).join(", ");
      },
    });

    await controller.init();

    await trackListElement.clickDeleteButton("track-1");

    tester.expect(getTracksCallCount).toBe(1);
    tester.expect(trackListElement.innerHTML).toBe("Guitar");
    tester.expect(statusElement.textContent).toBe("Could not delete track.");
  });

  tester.it("deletes the current project and runs the deleted callback", async () => {
    const trackListElement = createFakeTrackListElement();
    const statusElement = createFakeStatusElement();
    const deleteProjectButton = createFakeDeleteProjectButton();

    let deletedProjectId = "";
    let projectDeletedCallbackWasCalled = false;

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      statusElement,
      deleteProjectButton,
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },

        async deleteTrack() {
          throw new Error("deleteTrack should not be called in this test.");
        },
      },
      projectsApi: {
        async deleteProject(projectId) {
          deletedProjectId = projectId;

          return createProject();
        },
      },
      renderTrackList() {
        return '<p class="empty-state">No tracks yet.</p>';
      },
      confirmDeleteProject() {
        return true;
      },
      onProjectDeleted() {
        projectDeletedCallbackWasCalled = true;
      },
    });

    await controller.init();

    await deleteProjectButton.click();

    tester.expect(deletedProjectId).toBe("project-1");
    tester.expect(statusElement.textContent).toBe("Project deleted.");
    tester.expect(projectDeletedCallbackWasCalled).toBe(true);
  });

  tester.it("does not delete the current project when deletion is cancelled", async () => {
    const trackListElement = createFakeTrackListElement();
    const statusElement = createFakeStatusElement();
    const deleteProjectButton = createFakeDeleteProjectButton();

    let deleteProjectCallCount = 0;
    let projectDeletedCallbackWasCalled = false;

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      statusElement,
      deleteProjectButton,
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },

        async deleteTrack() {
          throw new Error("deleteTrack should not be called in this test.");
        },
      },
      projectsApi: {
        async deleteProject(projectId) {
          deleteProjectCallCount += 1;

          return createProject();
        },
      },
      renderTrackList() {
        return '<p class="empty-state">No tracks yet.</p>';
      },
      confirmDeleteProject() {
        return false;
      },
      onProjectDeleted() {
        projectDeletedCallbackWasCalled = true;
      },
    });

    await controller.init();

    await deleteProjectButton.click();

    tester.expect(deleteProjectCallCount).toBe(0);
    tester.expect(statusElement.textContent).toBe("");
    tester.expect(projectDeletedCallbackWasCalled).toBe(false);
  });

  tester.it("shows an error message when the current project cannot be deleted", async () => {
    const trackListElement = createFakeTrackListElement();
    const statusElement = createFakeStatusElement();
    const deleteProjectButton = createFakeDeleteProjectButton();

    let projectDeletedCallbackWasCalled = false;

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      statusElement,
      deleteProjectButton,
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },

        async deleteTrack() {
          throw new Error("deleteTrack should not be called in this test.");
        },
      },
      projectsApi: {
        async deleteProject() {
          throw new Error("Project delete failed.");
        },
      },
      renderTrackList() {
        return '<p class="empty-state">No tracks yet.</p>';
      },
      confirmDeleteProject() {
        return true;
      },
      onProjectDeleted() {
        projectDeletedCallbackWasCalled = true;
      },
    });

    await controller.init();

    await deleteProjectButton.click();

    tester.expect(statusElement.textContent).toBe("Could not delete project.");
    tester.expect(projectDeletedCallbackWasCalled).toBe(false);
  });

  tester.it("loads a selected track into the audio player", async () => {
    const project = createProject();
    const tracks = [
      {
        id: "track-1",
        projectId: project.id,
        name: "Guitar Take",
        originalFilename: "guitar.wav",
        filePath: "server/uploads/projects/project-1/guitar.wav",
        mimeType: "audio/wav",
        fileSize: 123,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const trackListElement = createFakeTrackListElement();
    const statusElement = createFakeStatusElement();

    let loadedTrack: { name: string; audioUrl: string } | null = null;

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      statusElement,
      tracksApi: {
        getTracksByProjectId: async () => tracks,
        deleteTrack: async () => tracks[0],
      },
      renderTrackList: () => "<button data-track-load-button data-track-id=\"track-1\">Load</button>",
      audioPlayerController: {
        loadTrack: (track) => {
          loadedTrack = track;
        },
      },
      getTrackAudioUrl: (projectId, trackId) => {
        return `http://localhost:3000/api/projects/${projectId}/tracks/${trackId}/audio`;
      },
    });

    await controller.init();

    await trackListElement.clickLoadButton("track-1");

    tester.expect(loadedTrack).toEqual({
      name: "Guitar Take",
      audioUrl:
        `http://localhost:3000/api/projects/${project.id}/tracks/track-1/audio`,
    });

    tester.expect(statusElement.textContent).toBe("Loaded Guitar Take.");
  });
});