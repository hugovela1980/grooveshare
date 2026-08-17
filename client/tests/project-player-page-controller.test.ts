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

  let changeHandler:
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

  const volumeValueElements = new Map<
    number,
    { textContent: string }
  >();
  const attributes = new Map<string, string>();

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

    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },

    removeAttribute(name: string) {
      attributes.delete(name);
    },

    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },

    addEventListener(
      eventName: "click" | "input" | "change" | "keydown" | "focusout",
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

      if (eventName === "change") {
        changeHandler = handler;
      }

      if (eventName === "keydown") {
        keydownHandler = handler;
      }

      if (eventName === "focusout") {
        focusoutHandler = handler;
      }
    },

    querySelector(selector: string) {
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

    async changeVolume(
      channelNumber: number,
      volume: number,
    ): Promise<void> {
      if (!changeHandler) {
        throw new Error("Change handler was not registered.");
      }

      const channel = channelSettings.find((setting) => {
        return setting.channelNumber === channelNumber;
      });

      if (!channel) {
        throw new Error(`Channel ${channelNumber} was not found.`);
      }

      channel.volume = volume;
      rebuildChannelSlots();

      await changeHandler({
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
          checked: enabled,
          dataset: {
            channelEnabled: "",
            mixChannel: String(channelNumber),
          },
        } as unknown as EventTarget,
      });
    },

    async changeEnabled(
      channelNumber: number,
      enabled: boolean,
    ): Promise<void> {
      if (!changeHandler) {
        throw new Error("Change handler was not registered.");
      }

      const channel = channelSettings.find((setting) => {
        return setting.channelNumber === channelNumber;
      });

      if (!channel) {
        throw new Error(`Channel ${channelNumber} was not found.`);
      }

      channel.enabled = enabled;
      rebuildChannelSlots();

      await changeHandler({
        target: {
          checked: enabled,
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

    async clickTrackName(trackId: string): Promise<unknown> {
      if (!clickHandler) {
        throw new Error("Click handler was not registered.");
      }

      const target = {
        textContent: "Track name",
        dataset: {
          trackNameEditor: "",
          trackId,
        },
      };

      await clickHandler({
        target: target as unknown as EventTarget,
      });

      return target;
    },

    getVolumeValueText(channelNumber: number): string {
      return volumeValueElements.get(channelNumber)?.textContent ?? "";
    },
  };
}

function createFakeStatusElement() {
  return {
    textContent: "",
  };
}

function installLocalStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));
  const previousLocalStorage = globalThis.localStorage;

  const storage = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    get length() {
      return values.size;
    },
  } as Storage;

  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });

  return {
    values,
    restore() {
      if (previousLocalStorage === undefined) {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      } else {
        Object.defineProperty(globalThis, "localStorage", {
          value: previousLocalStorage,
          configurable: true,
        });
      }
    },
  };
}

function createFakePersistenceScheduler() {
  type TimeoutId = ReturnType<typeof setTimeout>;

  let nextId = 1;
  const scheduledHandlers = new Map<TimeoutId, () => void>();
  let clearCallCount = 0;

  return {
    scheduleTimeout(handler: () => void, _delayMs: number): TimeoutId {
      const timeoutId = nextId as unknown as TimeoutId;
      nextId += 1;
      scheduledHandlers.set(timeoutId, handler);
      return timeoutId;
    },

    clearScheduledTimeout(timeoutId: TimeoutId): void {
      clearCallCount += 1;
      scheduledHandlers.delete(timeoutId);
    },

    runLatest(): void {
      const entries = Array.from(scheduledHandlers.entries());
      const latest = entries.at(-1);

      if (!latest) {
        throw new Error("No persistence callback was scheduled.");
      }

      scheduledHandlers.delete(latest[0]);
      latest[1]();
    },

    getPendingCount(): number {
      return scheduledHandlers.size;
    },

    getClearCallCount(): number {
      return clearCallCount;
    },
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
  type FakeEditableEvent = {
    key?: string;
    preventDefault?: () => void;
  };

  let clickHandler:
    | ((event: FakeEditableEvent) => void | Promise<void>)
    | null = null;

  let keydownHandler:
    | ((event: FakeEditableEvent) => void | Promise<void>)
    | null = null;

  let blurHandler:
    | ((event: FakeEditableEvent) => void | Promise<void>)
    | null = null;

  let blurCallCount = 0;

  const element = {
    textContent: initialText,

    addEventListener(
      eventName: "click" | "keydown" | "blur",
      handler: (event: FakeEditableEvent) => void | Promise<void>,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
      }

      if (eventName === "keydown") {
        keydownHandler = handler;
      }

      if (eventName === "blur") {
        blurHandler = handler;
      }
    },

    async click(): Promise<void> {
      if (!clickHandler) {
        throw new Error("Click handler was not registered.");
      }

      await clickHandler({});
    },

    async blur(): Promise<void> {
      blurCallCount += 1;
      await blurHandler?.({});
    },

    async pressEnter(text: string): Promise<{
      preventDefaultCallCount: number;
      blurCallCount: number;
    }> {
      if (!keydownHandler) {
        throw new Error("Keydown handler was not registered.");
      }

      let preventDefaultCallCount = 0;
      element.textContent = text;

      await keydownHandler({
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

    async loseFocus(text: string): Promise<void> {
      if (!blurHandler) {
        throw new Error("Blur handler was not registered.");
      }

      element.textContent = text;
      await blurHandler({});
    },

    getBlurCallCount() {
      return blurCallCount;
    },
  };

  return element;
}

tester.describe("project player page controller", () => {
  tester.it("keeps the player shell loading until initial tracks finish loading", async () => {
    const trackListElement = createFakeTrackListElement();
    const loadingElement = { hidden: false as boolean | string };
    const contentElement = { hidden: true as boolean | string };
    let resolveTracks!: (tracks: Track[]) => void;

    const tracksPromise = new Promise<Track[]>((resolve) => {
      resolveTracks = resolve;
    });

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      loadingElement,
      contentElement,
      tracksApi: {
        async getTracksByProjectId() {
          return tracksPromise;
        },
        async deleteTrack() {
          return createTrack();
        },
      },
      renderTrackList(tracks) {
        return tracks.map((track) => track.name).join(", ");
      },
    });

    const pendingInit = controller.init();

    tester.expect(loadingElement.hidden).toBe(false);
    tester.expect(contentElement.hidden).toBe(true);
    tester.expect(trackListElement.getAttribute("aria-busy")).toBe("true");

    resolveTracks([createTrack()]);
    await pendingInit;

    tester.expect(loadingElement.hidden).toBe(true);
    tester.expect(contentElement.hidden).toBe(false);
    tester.expect(trackListElement.getAttribute("aria-busy")).toBe(null);
  });

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

  tester.it("prepares all occupied channels automatically on init while preserving enabled state", async () => {
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
      enabled: boolean;
    }> = [];

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      statusElement,
      tracksApi: {
        getTracksByProjectId: async () => tracks,
        deleteTrack: async () => tracks[0]!,
      },
      renderTrackList: () => "tracks",
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

    tester.expect(loadedMixChannels).toEqual([
      {
        channelNumber: 1,
        trackId: "track-1",
        name: "Guitar",
        audioUrl:
          "http://localhost:3000/api/projects/project-1/tracks/track-1/audio",
        volume: 0.75,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "track-2",
        name: "Bass",
        audioUrl:
          "http://localhost:3000/api/projects/project-1/tracks/track-2/audio",
        volume: 0.25,
        enabled: false,
      },
    ]);

    tester.expect(statusElement.textContent).toBe("");
  });

  tester.it("queues occupied channel settings on change and flushes them to the server", async () => {
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

    let saveCallCount = 0;
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
          saveCallCount += 1;
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
    });

    await controller.init();

    await trackListElement.inputVolume(1, 0.6);

    tester.expect(saveCallCount).toBe(0);

    await trackListElement.changeVolume(1, 0.6);

    tester.expect(saveCallCount).toBe(0);

    await controller.flushPendingMixSettings();

    tester.expect(saveCallCount).toBe(1);
    tester.expect(savedProjectId).toBe("project-1");
    tester.expect(savedMixSettings).toEqual({
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: true,
          volume: 0.6,
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

  tester.it("reports deferred persistence failures without rebuilding the prepared mix", async () => {
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

    tester.expect(loadMixCallCount).toBe(1);

    await trackListElement.changeVolume(1, 0.8);
    await controller.flushPendingMixSettings();

    tester.expect(statusElement.textContent).toBe(
      "Could not save mix settings.",
    );
    tester.expect(loadMixCallCount).toBe(1);
  });

  tester.it("automatically prepares occupied channels even when all are disabled", async () => {
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

    let loadedMixChannels: Array<{
      channelNumber: number;
      trackId: string;
      name: string;
      audioUrl: string;
      volume: number;
      enabled: boolean;
    }> = [];

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      statusElement,
      tracksApi: {
        getTracksByProjectId: async () => tracks,
        deleteTrack: async () => tracks[0]!,
      },
      renderTrackList: () => "tracks",
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

    tester.expect(loadedMixChannels).toEqual([
      {
        channelNumber: 1,
        trackId: "track-1",
        name: "Guitar",
        audioUrl:
          "http://localhost:3000/api/projects/project-1/tracks/track-1/audio",
        volume: 1,
        enabled: false,
      },
    ]);
    tester.expect(statusElement.textContent).toBe("");
  });

  tester.it("updates loaded channel volume live while slider input stays separate from persistence", async () => {
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

    let saveCallCount = 0;
    const liveVolumeUpdates: Array<{
      channelNumber: number;
      volume: number;
    }> = [];

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
          saveCallCount += 1;

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
        loadMix() {},
        setChannelVolume(channelNumber, volume) {
          liveVolumeUpdates.push({ channelNumber, volume });
          return true;
        },
      },
      getTrackAudioUrl() {
        return "audio-url";
      },
    });

    await controller.init();

    tester.expect(trackListElement.getVolumeValueText(1)).toBe("100%");

    await trackListElement.inputVolume(1, 0.73);

    tester.expect(trackListElement.getVolumeValueText(1)).toBe("73%");
    tester.expect(liveVolumeUpdates).toEqual([
      {
        channelNumber: 1,
        volume: 0.73,
      },
    ]);
    tester.expect(saveCallCount).toBe(0);

    await trackListElement.changeVolume(1, 0.73);

    tester.expect(saveCallCount).toBe(0);

    await controller.flushPendingMixSettings();

    tester.expect(saveCallCount).toBe(1);
  });

  tester.it("updates live volume without rebuilding the automatically prepared mix", async () => {
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

    let loadMixCallCount = 0;
    let liveVolumeCallCount = 0;

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
        loadMix() {
          loadMixCallCount += 1;
        },
        setChannelVolume() {
          liveVolumeCallCount += 1;
          return true;
        },
      },
      getTrackAudioUrl() {
        return "audio-url";
      },
    });

    await controller.init();

    tester.expect(loadMixCallCount).toBe(1);

    await trackListElement.inputVolume(1, 0.5);

    tester.expect(liveVolumeCallCount).toBe(1);
    tester.expect(loadMixCallCount).toBe(1);
  });

  tester.it("persists an edited track name and updates the prepared mix label live", async () => {
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

    let savedTrackName = "";
    let initiallyLoadedTrackName = "";
    let liveTrackName = "";

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

        async updateTrackName(projectId, trackId, name) {
          tester.expect(projectId).toBe("project-1");
          tester.expect(trackId).toBe("track-1");
          savedTrackName = name;

          return {
            ...track,
            name,
          };
        },
      },
      renderTrackList(tracks) {
        return tracks.map((currentTrack) => currentTrack.name).join(", ");
      },
      audioPlayerController: {
        loadMix(channels) {
          initiallyLoadedTrackName = channels[0]?.name ?? "";
        },
        setTrackName(trackId, name) {
          tester.expect(trackId).toBe("track-1");
          liveTrackName = name;
          return true;
        },
      },
      getTrackAudioUrl() {
        return "audio-url";
      },
    });

    await controller.init();

    tester.expect(initiallyLoadedTrackName).toBe("Guitar");

    const editedText = await trackListElement.editTrackNameOnBlur(
      "track-1",
      "  Lead Guitar  ",
    );

    tester.expect(editedText).toBe("Lead Guitar");
    tester.expect(savedTrackName).toBe("Lead Guitar");
    tester.expect(liveTrackName).toBe("Lead Guitar");
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

  tester.it("persists edited project title and description", async () => {
    const project = createProject();
    const trackListElement = createFakeTrackListElement();
    const projectTitleElement = createFakeEditableTextElement("Bass Groove");
    const projectDescriptionElement = createFakeEditableTextElement("Practice loop");
    const projectDetailUpdates: Array<{
      title?: string;
      description?: string;
    }> = [];

    const controller = createProjectPlayerPageController({
      project,
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
      projectsApi: {
        async deleteProject() {
          return project;
        },

        async updateProjectDetails(_projectId, projectInput) {
          projectDetailUpdates.push(projectInput);

          return {
            ...project,
            ...projectInput,
          };
        },
      },
      renderTrackList() {
        return "tracks";
      },
    });

    await controller.init();

    const titleResult = await projectTitleElement.pressEnter(
      "  New Project Title  ",
    );

    tester.expect(projectTitleElement.textContent).toBe("New Project Title");
    tester.expect(titleResult.preventDefaultCallCount).toBe(1);
    tester.expect(titleResult.blurCallCount).toBe(1);

    await projectDescriptionElement.loseFocus(
      "  New project description  ",
    );

    tester.expect(projectDescriptionElement.textContent).toBe(
      "New project description",
    );

    tester.expect(projectDetailUpdates).toEqual([
      {
        title: "New Project Title",
      },
      {
        description: "New project description",
      },
    ]);
  });

  tester.it("selects all inline editable text when it is clicked", async () => {
    const trackListElement = createFakeTrackListElement();
    const projectTitleElement = createFakeEditableTextElement("Bass Groove");
    const projectDescriptionElement = createFakeEditableTextElement("Practice loop");
    const selectedElements: unknown[] = [];

    const controller = createProjectPlayerPageController({
      project: createProject(),
      trackListElement,
      projectTitleElement,
      projectDescriptionElement,
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
      selectAllText(element) {
        selectedElements.push(element);
      },
    });

    await controller.init();

    await projectTitleElement.click();
    await projectDescriptionElement.click();
    const trackNameTarget = await trackListElement.clickTrackName("track-1");

    tester.expect(selectedElements.length).toBe(3);
    tester.expect(selectedElements[0]).toBe(projectTitleElement);
    tester.expect(selectedElements[1]).toBe(projectDescriptionElement);
    tester.expect(selectedElements[2]).toBe(trackNameTarget);
  });

  tester.it("queues a channel enabled state until pending mix settings are flushed", async () => {
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

    let saveCallCount = 0;
    let savedMixSettings: MixSettings | undefined;

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
          saveCallCount += 1;
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
    });

    await controller.init();

    await trackListElement.inputEnabled(1, false);

    tester.expect(saveCallCount).toBe(0);

    await trackListElement.changeEnabled(1, false);

    tester.expect(saveCallCount).toBe(0);

    await controller.flushPendingMixSettings();

    tester.expect(saveCallCount).toBe(1);
    tester.expect(savedMixSettings).toEqual({
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: false,
          volume: 1,
        },
      ],
    });
  });

  tester.it("updates live enabled state without rebuilding the automatically prepared mix", async () => {
    const project = createProject();
    const trackListElement = createFakeTrackListElement();
    const liveEnabledUpdates: Array<{
      channelNumber: number;
      enabled: boolean;
    }> = [];
    let loadMixCallCount = 0;

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
        loadMix() {
          loadMixCallCount += 1;
        },
        setChannelEnabled(channelNumber, enabled) {
          liveEnabledUpdates.push({ channelNumber, enabled });
          return true;
        },
      },
      getTrackAudioUrl() {
        return "audio-url";
      },
    });

    await controller.init();

    tester.expect(loadMixCallCount).toBe(1);

    await trackListElement.inputEnabled(1, false);

    tester.expect(liveEnabledUpdates).toEqual([
      {
        channelNumber: 1,
        enabled: false,
      },
    ]);
    tester.expect(loadMixCallCount).toBe(1);

    await trackListElement.inputEnabled(1, true);

    tester.expect(liveEnabledUpdates).toEqual([
      {
        channelNumber: 1,
        enabled: false,
      },
      {
        channelNumber: 1,
        enabled: true,
      },
    ]);
    tester.expect(loadMixCallCount).toBe(1);
  });

  tester.it("debounces repeated committed mixer changes into one server save", async () => {
    const project = createProject();
    const trackListElement = createFakeTrackListElement();
    const scheduler = createFakePersistenceScheduler();

    trackListElement.setChannelSlots([
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume: 1,
      },
    ]);

    let saveCallCount = 0;
    let savedMixSettings: MixSettings | undefined;

    const controller = createProjectPlayerPageController({
      project,
      currentUserId: "owner-1",
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
          saveCallCount += 1;
          savedMixSettings = mixSettings;
          return { ...project, mixSettings };
        },
      },
      renderTrackList() {
        return "tracks";
      },
      scheduleTimeout: scheduler.scheduleTimeout,
      clearScheduledTimeout: scheduler.clearScheduledTimeout,
    });

    await controller.init();
    await trackListElement.changeVolume(1, 0.8);
    await trackListElement.changeVolume(1, 0.7);
    await trackListElement.changeVolume(1, 0.65);

    tester.expect(saveCallCount).toBe(0);
    tester.expect(scheduler.getPendingCount()).toBe(1);
    tester.expect(scheduler.getClearCallCount()).toBe(2);

    scheduler.runLatest();

    tester.expect(saveCallCount).toBe(1);
    tester.expect(savedMixSettings).toEqual({
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: true,
          volume: 0.65,
        },
      ],
    });
  });

  tester.it("keeps a local recovery copy until a pending server mix is saved", async () => {
    const localStorageTest = installLocalStorage();

    try {
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
        currentUserId: "owner-1",
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
            return { ...project, mixSettings };
          },
        },
        renderTrackList() {
          return "tracks";
        },
      });

      await controller.init();
      await trackListElement.changeVolume(1, 0.58);

      const storageKey = "grooveshare:pending-mix:owner-1:project-1";
      const pendingValue = localStorageTest.values.get(storageKey);

      tester.expect(typeof pendingValue).toBe("string");
      tester.expect(JSON.parse(pendingValue ?? "null")).toEqual({
        channels: [
          {
            channelNumber: 1,
            trackId: "track-1",
            enabled: true,
            volume: 0.58,
          },
        ],
      });

      await controller.flushPendingMixSettings();
      tester.expect(localStorageTest.values.has(storageKey)).toBe(false);
    } finally {
      localStorageTest.restore();
    }
  });

  tester.it("restores an unsynced local mix and flushes it on the next project visit", async () => {
    const pendingMixSettings: MixSettings = {
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: true,
          volume: 0.47,
        },
      ],
    };

    const storageKey = "grooveshare:pending-mix:owner-1:project-1";
    const localStorageTest = installLocalStorage({
      [storageKey]: JSON.stringify(pendingMixSettings),
    });

    try {
      const project = createProject({
        mixSettings: {
          channels: [
            {
              channelNumber: 1,
              trackId: "track-1",
              enabled: true,
              volume: 1,
            },
          ],
        },
      });
      const trackListElement = createFakeTrackListElement();
      let renderedMixSettings: MixSettings | undefined;
      let savedMixSettings: MixSettings | undefined;

      const controller = createProjectPlayerPageController({
        project,
        currentUserId: "owner-1",
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
            savedMixSettings = mixSettings;
            return { ...project, mixSettings };
          },
        },
        renderTrackList(_tracks, mixSettings) {
          renderedMixSettings = mixSettings;
          return "tracks";
        },
      });

      await controller.init();
      tester.expect(renderedMixSettings).toEqual(pendingMixSettings);

      await controller.flushPendingMixSettings();
      tester.expect(savedMixSettings).toEqual(pendingMixSettings);
      tester.expect(localStorageTest.values.has(storageKey)).toBe(false);
    } finally {
      localStorageTest.restore();
    }
  });

});
