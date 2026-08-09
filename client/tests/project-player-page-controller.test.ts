import { createProjectPlayerPageController } from "../src/page-controllers/project-player-page-controller.js";
import type { MixSettings, Project, Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    title: "Bass Groove",
    description: "Practice loop",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    projectId: "project-1",
    name: "Guitar",
    originalFilename: "guitar.wav",
    filePath: "server/uploads/projects/project-1/guitar.wav",
    mimeType: "audio/wav",
    fileSize: 123,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

type FakeTrackListEvent = {
  target: EventTarget | null;
  key?: string;
  preventDefault?: () => void;
};

type FakeChannelSetting = {
  channelNumber: number;
  trackId: string;
  enabled: boolean;
  volume: number;
};

function createFakeTrackListElement() {
  let clickHandler:
    | ((event: FakeTrackListEvent) => void | Promise<void>)
    | null = null;

  let inputHandler:
    | ((event: FakeTrackListEvent) => void | Promise<void>)
    | null = null;

  let keydownHandler:
    | ((event: FakeTrackListEvent) => void | Promise<void>)
    | null = null;

  let focusoutHandler:
    | ((event: FakeTrackListEvent) => void | Promise<void>)
    | null = null;

  let channelSettings: FakeChannelSetting[] = [];

  let channelSlots: Array<{
    dataset: {
      mixChannel: string;
      trackId: string;
    };
    querySelector(
      selector: string,
    ): { checked?: boolean; value?: string } | null;
  }> = [];

  const loadMixButtonClasses = new Set<string>();

  const loadMixButton = {
    classList: {
      add(className: string) {
        loadMixButtonClasses.add(className);
      },

      remove(className: string) {
        loadMixButtonClasses.delete(className);
      },
    },
  };

  const volumeValueElements = new Map<
    number,
    { textContent: string }
  >();

  function rebuildChannelSlots(): void {
    channelSlots = channelSettings.map((slot) => {
      return {
        dataset: {
          mixChannel: String(slot.channelNumber),
          trackId: slot.trackId,
        },

        querySelector(selector: string) {
          if (selector === "[data-channel-enabled]") {
            return {
              checked: slot.enabled,
            };
          }

          if (selector === "[data-channel-volume]") {
            return {
              value: String(slot.volume),
            };
          }

          return null;
        },
      };
    });
  }

  return {
    innerHTML: "",

    addEventListener(
      eventName: "click" | "input" | "keydown" | "focusout",
      handler: (
        event: FakeTrackListEvent,
      ) => void | Promise<void>,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
      }

      if (eventName === "input") {
        inputHandler = handler;
      }

      if (eventName === "keydown") {
        keydownHandler = handler;
      }

      if (eventName === "focusout") {
        focusoutHandler = handler;
      }
    },

    querySelector(selector: string) {
      if (selector === "[data-load-mix-button]") {
        return loadMixButton;
      }

      const volumeValueMatch = selector.match(
        /\[data-channel-volume-value\]\[data-mix-channel="(\d+)"\]/,
      );

      if (!volumeValueMatch) {
        return null;
      }

      const channelNumber = Number(volumeValueMatch[1]);

      return volumeValueElements.get(channelNumber) ?? null;
    },

    querySelectorAll(selector: string) {
      if (selector === "[data-mix-channel-slot][data-track-id]") {
        return channelSlots;
      }

      return [];
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

    setChannelSlots(slots: FakeChannelSetting[]): void {
      channelSettings = slots.map((slot) => ({ ...slot }));

      volumeValueElements.clear();

      channelSettings.forEach((slot) => {
        volumeValueElements.set(slot.channelNumber, {
          textContent: `${Math.round(slot.volume * 100)}%`,
        });
      });

      rebuildChannelSlots();
    },

    async clickLoadMixButton(): Promise<void> {
      if (!clickHandler) {
        throw new Error("Click handler was not registered.");
      }

      await clickHandler({
        target: {
          closest(selector: string) {
            if (selector !== "[data-load-mix-button]") {
              return null;
            }

            return {};
          },
        } as unknown as EventTarget,
      });
    },

    async inputVolume(
      channelNumber: number,
      volume: number,
    ): Promise<void> {
      if (!inputHandler) {
        throw new Error("Input handler was not registered.");
      }

      const channel = channelSettings.find((setting) => {
        return setting.channelNumber === channelNumber;
      });

      if (!channel) {
        throw new Error(`Channel ${channelNumber} was not found.`);
      }

      channel.volume = volume;
      rebuildChannelSlots();

      await inputHandler({
        target: {
          value: String(volume),
          dataset: {
            channelVolume: "",
            mixChannel: String(channelNumber),
          },
        } as unknown as EventTarget,
      });
    },

    async inputEnabled(
      channelNumber: number,
      enabled: boolean,
    ): Promise<void> {
      if (!inputHandler) {
        throw new Error("Input handler was not registered.");
      }

      const channel = channelSettings.find((setting) => {
        return setting.channelNumber === channelNumber;
      });

      if (!channel) {
        throw new Error(`Channel ${channelNumber} was not found.`);
      }

      channel.enabled = enabled;
      rebuildChannelSlots();

      await inputHandler({
        target: {
          dataset: {
            channelEnabled: "",
            mixChannel: String(channelNumber),
          },
        } as unknown as EventTarget,
      });
    },

    async editTrackNameOnBlur(
      trackId: string,
      name: string,
    ): Promise<string> {
      if (!focusoutHandler) {
        throw new Error("Focusout handler was not registered.");
      }

      const target = {
        textContent: name,
        dataset: {
          trackNameEditor: "",
          trackId,
        },
      };

      await focusoutHandler({
        target: target as unknown as EventTarget,
      });

      return target.textContent;
    },

    async editTrackNameOnEnter(
      trackId: string,
      name: string,
    ): Promise<{
      textContent: string;
      preventDefaultCallCount: number;
      blurCallCount: number;
    }> {
      if (!keydownHandler) {
        throw new Error("Keydown handler was not registered.");
      }

      let preventDefaultCallCount = 0;
      let blurCallCount = 0;

      const target = {
        textContent: name,
        dataset: {
          trackNameEditor: "",
          trackId,
        },
        async blur() {
          blurCallCount += 1;

          if (focusoutHandler) {
            await focusoutHandler({
              target: target as unknown as EventTarget,
            });
          }
        },
      };

      await keydownHandler({
        target: target as unknown as EventTarget,
        key: "Enter",
        preventDefault() {
          preventDefaultCallCount += 1;
        },
      });

      return {
        textContent: target.textContent,
        preventDefaultCallCount,
        blurCallCount,
      };
    },

    getVolumeValueText(channelNumber: number): string {
      return volumeValueElements.get(channelNumber)?.textContent ?? "";
    },

    isLoadMixCurrent(): boolean {
      return loadMixButtonClasses.has(
        "mix-channel-panel__load-button--current",
      );
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

function createFakeEditableTextElement(initialText: string) {
  let keydownHandler:
    | ((event: { key?: string; preventDefault?: () => void }) => void)
    | null = null;

  let blurHandler:
    | ((event: { key?: string; preventDefault?: () => void }) => void)
    | null = null;

  let blurCallCount = 0;

  const element = {
    textContent: initialText,

    addEventListener(
      eventName: "keydown" | "blur",
      handler: (event: {
        key?: string;
        preventDefault?: () => void;
      }) => void,
    ) {
      if (eventName === "keydown") {
        keydownHandler = handler;
      }

      if (eventName === "blur") {
        blurHandler = handler;
      }
    },

    blur() {
      blurCallCount += 1;
      blurHandler?.({});
    },

    pressEnter(text: string) {
      if (!keydownHandler) {
        throw new Error("Keydown handler was not registered.");
      }

      let preventDefaultCallCount = 0;
      element.textContent = text;

      keydownHandler({
        key: "Enter",
        preventDefault() {
          preventDefaultCallCount += 1;
        },
      });

      return {
        preventDefaultCallCount,
        blurCallCount,
      };
    },

    loseFocus(text: string) {
      if (!blurHandler) {
        throw new Error("Blur handler was not registered.");
      }

      element.textContent = text;
      blurHandler({});
    },

    getBlurCallCount() {
      return blurCallCount;
    },
  };

  return element;
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
          throw new Error(
            "deleteTrack should not be called in this test.",
          );
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
          throw new Error(
            "deleteTrack should not be called in this test.",
          );
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
    let stopCallCount = 0;

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
          throw new Error(
            "deleteTrack should not be called in this test.",
          );
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
      audioPlayerController: {
        stop() {
          stopCallCount += 1;
        },
      },
      onProjectDeleted() {
        projectDeletedCallbackWasCalled = true;
      },
    });

    await controller.init();

    await deleteProjectButton.click();

    tester.expect(stopCallCount).toBe(1);
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
    let stopCallCount = 0;

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
          throw new Error(
            "deleteTrack should not be called in this test.",
          );
        },
      },
      projectsApi: {
        async deleteProject() {
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
      audioPlayerController: {
        stop() {
          stopCallCount += 1;
        },
      },
      onProjectDeleted() {
        projectDeletedCallbackWasCalled = true;
      },
    });

    await controller.init();

    await deleteProjectButton.click();

    tester.expect(stopCallCount).toBe(0);
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
          throw new Error(
            "deleteTrack should not be called in this test.",
          );
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

  tester.it("restores saved mix settings when tracks are rendered", async () => {
    const mixSettings: MixSettings = {
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: false,
          volume: 0.4,
        },
      ],
    };

    const trackListElement = createFakeTrackListElement();
    let renderedMixSettings: MixSettings | undefined;

    const controller = createProjectPlayerPageController({
      project: createProject({
        mixSettings,
      }),
      trackListElement,
      tracksApi: {
        async getTracksByProjectId() {
          return [createTrack()];
        },

        async deleteTrack() {
          throw new Error(
            "deleteTrack should not be called in this test.",
          );
        },
      },
      renderTrackList(_tracks, receivedMixSettings) {
        renderedMixSettings = receivedMixSettings;
        return "rendered tracks";
      },
    });

    await controller.init();

    tester.expect(renderedMixSettings).toEqual(mixSettings);
  });

  tester.it("loads enabled channel slots into the audio player mix", async () => {
    const project = createProject();

    const tracks = [
      createTrack(),
      createTrack({
        id: "track-2",
        name: "Bass",
        originalFilename: "bass.wav",
        filePath: "server/uploads/projects/project-1/bass.wav",
      }),
    ];

    const trackListElement = createFakeTrackListElement();
    const statusElement = createFakeStatusElement();

    trackListElement.setChannelSlots([
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume: 0.75,
      },
      {
        channelNumber: 2,
        trackId: "track-2",
        enabled: false,
        volume: 0.25,
      },
    ]);

    let loadedMixChannels: Array<{
      channelNumber: number;
      trackId: string;
      name: string;
      audioUrl: string;
      volume: number;
    }> = [];

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      statusElement,
      tracksApi: {
        getTracksByProjectId: async () => tracks,
        deleteTrack: async () => tracks[0]!,
      },
      renderTrackList: () =>
        '<button data-load-mix-button>Load Mix</button>',
      audioPlayerController: {
        loadMix(channels) {
          loadedMixChannels = channels;
        },
      },
      getTrackAudioUrl(projectId, trackId) {
        return `http://localhost:3000/api/projects/${projectId}/tracks/${trackId}/audio`;
      },
    });

    await controller.init();

    await trackListElement.clickLoadMixButton();

    tester.expect(loadedMixChannels).toEqual([
      {
        channelNumber: 1,
        trackId: "track-1",
        name: "Guitar",
        audioUrl:
          "http://localhost:3000/api/projects/project-1/tracks/track-1/audio",
        volume: 0.75,
      },
    ]);

    tester.expect(statusElement.textContent).toBe(
      "Loaded 1 channel into the mix.",
    );
  });

  tester.it("saves all occupied channel settings when loading the mix", async () => {
    const project = createProject();

    const tracks = [
      createTrack(),
      createTrack({
        id: "track-2",
        name: "Bass",
        originalFilename: "bass.wav",
        filePath: "server/uploads/projects/project-1/bass.wav",
      }),
    ];

    const trackListElement = createFakeTrackListElement();

    trackListElement.setChannelSlots([
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume: 0.75,
      },
      {
        channelNumber: 2,
        trackId: "track-2",
        enabled: false,
        volume: 0.25,
      },
    ]);

    let savedProjectId = "";
    let savedMixSettings: MixSettings | undefined;

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      tracksApi: {
        async getTracksByProjectId() {
          return tracks;
        },

        async deleteTrack() {
          return tracks[0]!;
        },
      },
      projectsApi: {
        async deleteProject() {
          return project;
        },

        async saveMixSettings(projectId, mixSettings) {
          savedProjectId = projectId;
          savedMixSettings = mixSettings;

          return {
            ...project,
            mixSettings,
          };
        },
      },
      renderTrackList() {
        return "tracks";
      },
      audioPlayerController: {
        loadMix() { },
      },
      getTrackAudioUrl(projectId, trackId) {
        return `http://localhost:3000/api/projects/${projectId}/tracks/${trackId}/audio`;
      },
    });

    await controller.init();
    await trackListElement.clickLoadMixButton();

    tester.expect(savedProjectId).toBe("project-1");
    tester.expect(savedMixSettings).toEqual({
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: true,
          volume: 0.75,
        },
        {
          channelNumber: 2,
          trackId: "track-2",
          enabled: false,
          volume: 0.25,
        },
      ],
    });
  });

  tester.it("does not load the mix when saving mix settings fails", async () => {
    const project = createProject();
    const trackListElement = createFakeTrackListElement();
    const statusElement = createFakeStatusElement();

    trackListElement.setChannelSlots([
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume: 0.8,
      },
    ]);

    let loadMixCallCount = 0;

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      statusElement,
      tracksApi: {
        async getTracksByProjectId() {
          return [createTrack()];
        },

        async deleteTrack() {
          return createTrack();
        },
      },
      projectsApi: {
        async deleteProject() {
          return project;
        },

        async saveMixSettings() {
          throw new Error("Save failed.");
        },
      },
      renderTrackList() {
        return "tracks";
      },
      audioPlayerController: {
        loadMix() {
          loadMixCallCount += 1;
        },
      },
      getTrackAudioUrl() {
        return "audio-url";
      },
    });

    await controller.init();
    await trackListElement.clickLoadMixButton();

    tester.expect(loadMixCallCount).toBe(0);
    tester.expect(statusElement.textContent).toBe(
      "Could not save mix settings.",
    );
  });

  tester.it("shows a message when no channels are enabled for the mix", async () => {
    const project = createProject();
    const tracks = [createTrack()];
    const trackListElement = createFakeTrackListElement();
    const statusElement = createFakeStatusElement();

    trackListElement.setChannelSlots([
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: false,
        volume: 1,
      },
    ]);

    let loadMixCallCount = 0;

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      statusElement,
      tracksApi: {
        getTracksByProjectId: async () => tracks,
        deleteTrack: async () => tracks[0]!,
      },
      renderTrackList: () =>
        '<button data-load-mix-button>Load Mix</button>',
      audioPlayerController: {
        loadMix() {
          loadMixCallCount += 1;
        },
      },
      getTrackAudioUrl(projectId, trackId) {
        return `http://localhost:3000/api/projects/${projectId}/tracks/${trackId}/audio`;
      },
    });

    await controller.init();

    await trackListElement.clickLoadMixButton();

    tester.expect(loadMixCallCount).toBe(0);
    tester.expect(statusElement.textContent).toBe(
      "Choose at least one enabled channel.",
    );
  });

  tester.it("updates the volume percentage while the slider changes", async () => {
    const trackListElement = createFakeTrackListElement();

    trackListElement.setChannelSlots([
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume: 1,
      },
    ]);

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      tracksApi: {
        async getTracksByProjectId() {
          return [createTrack()];
        },

        async deleteTrack() {
          return createTrack();
        },
      },
      renderTrackList() {
        return "tracks";
      },
    });

    await controller.init();

    tester.expect(trackListElement.getVolumeValueText(1)).toBe("100%");

    await trackListElement.inputVolume(1, 0.73);

    tester.expect(trackListElement.getVolumeValueText(1)).toBe("73%");
  });

  tester.it("marks the loaded mix current until its settings change", async () => {
    const project = createProject();
    const trackListElement = createFakeTrackListElement();

    trackListElement.setChannelSlots([
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume: 0.75,
      },
    ]);

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      tracksApi: {
        async getTracksByProjectId() {
          return [createTrack()];
        },

        async deleteTrack() {
          return createTrack();
        },
      },
      projectsApi: {
        async deleteProject() {
          return project;
        },

        async saveMixSettings(_projectId, mixSettings) {
          return {
            ...project,
            mixSettings,
          };
        },
      },
      renderTrackList() {
        return "tracks";
      },
      audioPlayerController: {
        loadMix() { },
      },
      getTrackAudioUrl() {
        return "audio-url";
      },
    });

    await controller.init();

    tester.expect(trackListElement.isLoadMixCurrent()).toBe(false);

    await trackListElement.clickLoadMixButton();

    tester.expect(trackListElement.isLoadMixCurrent()).toBe(true);

    await trackListElement.inputVolume(1, 0.5);

    tester.expect(trackListElement.isLoadMixCurrent()).toBe(false);

    await trackListElement.inputVolume(1, 0.75);

    tester.expect(trackListElement.isLoadMixCurrent()).toBe(true);
  });

  tester.it("keeps an edited track name local and uses it when loading the mix", async () => {
    const project = createProject();
    const trackListElement = createFakeTrackListElement();
    const track = createTrack();

    trackListElement.setChannelSlots([
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume: 1,
      },
    ]);

    let loadedTrackName = "";

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      tracksApi: {
        async getTracksByProjectId() {
          return [track];
        },

        async deleteTrack() {
          return track;
        },
      },
      renderTrackList(tracks) {
        return tracks.map((currentTrack) => currentTrack.name).join(", ");
      },
      audioPlayerController: {
        loadMix(channels) {
          loadedTrackName = channels[0]?.name ?? "";
        },
      },
      getTrackAudioUrl() {
        return "audio-url";
      },
    });

    await controller.init();

    const editedText = await trackListElement.editTrackNameOnBlur(
      "track-1",
      "  Lead Guitar  ",
    );

    tester.expect(editedText).toBe("Lead Guitar");

    await trackListElement.clickLoadMixButton();

    tester.expect(loadedTrackName).toBe("Lead Guitar");
  });

  tester.it("ends inline track name editing on Enter", async () => {
    const trackListElement = createFakeTrackListElement();

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      tracksApi: {
        async getTracksByProjectId() {
          return [createTrack()];
        },

        async deleteTrack() {
          return createTrack();
        },
      },
      renderTrackList(tracks) {
        return tracks.map((track) => track.name).join(", ");
      },
    });

    await controller.init();

    const result = await trackListElement.editTrackNameOnEnter(
      "track-1",
      "  Rhythm Guitar  ",
    );

    tester.expect(result.textContent).toBe("Rhythm Guitar");
    tester.expect(result.preventDefaultCallCount).toBe(1);
    tester.expect(result.blurCallCount).toBe(1);
  });

  tester.it("edits the project title and description locally", async () => {
    const trackListElement = createFakeTrackListElement();
    const projectTitleElement = createFakeEditableTextElement("Bass Groove");
    const projectDescriptionElement = createFakeEditableTextElement("Practice loop");

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      projectTitleElement,
      projectDescriptionElement,
      tracksApi: {
        async getTracksByProjectId() {
          return [];
        },

        async deleteTrack() {
          throw new Error("deleteTrack should not be called in this test.");
        },
      },
      renderTrackList() {
        return "tracks";
      },
    });

    await controller.init();

    const titleResult = projectTitleElement.pressEnter("  New Project Title  ");

    tester.expect(projectTitleElement.textContent).toBe("New Project Title");
    tester.expect(titleResult.preventDefaultCallCount).toBe(1);
    tester.expect(titleResult.blurCallCount).toBe(1);

    projectDescriptionElement.loseFocus("  New project description  ");

    tester.expect(projectDescriptionElement.textContent).toBe(
      "New project description",
    );
  });

  tester.it("marks the loaded mix dirty when a channel enabled state changes", async () => {
    const project = createProject();
    const trackListElement = createFakeTrackListElement();

    trackListElement.setChannelSlots([
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume: 1,
      },
    ]);

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      tracksApi: {
        async getTracksByProjectId() {
          return [createTrack()];
        },

        async deleteTrack() {
          return createTrack();
        },
      },
      projectsApi: {
        async deleteProject() {
          return project;
        },

        async saveMixSettings(_projectId, mixSettings) {
          return {
            ...project,
            mixSettings,
          };
        },
      },
      renderTrackList() {
        return "tracks";
      },
      audioPlayerController: {
        loadMix() { },
      },
      getTrackAudioUrl() {
        return "audio-url";
      },
    });

    await controller.init();

    await trackListElement.clickLoadMixButton();

    tester.expect(trackListElement.isLoadMixCurrent()).toBe(true);

    await trackListElement.inputEnabled(1, false);

    tester.expect(trackListElement.isLoadMixCurrent()).toBe(false);

    await trackListElement.inputEnabled(1, true);

    tester.expect(trackListElement.isLoadMixCurrent()).toBe(true);
  });
});
