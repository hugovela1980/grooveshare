import { createProjectPlayerPageController } from "../src/page-controllers/project-player-page-controller.js";
import type { Project, Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

function createTrack(): Track {
  return {
    id: "track-1",
    projectId: "project-1",
    name: "Guitar",
    originalFilename: "guitar.wav",
    filePath: "uploads/guitar.wav",
    mimeType: "audio/wav",
    fileSize: 123,
    uploadedByUserId: "owner-1",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function createProject(role: "viewer" | "contributor"): Project {
  return {
    id: "project-1",
    title: "Role Demo",
    description: "Permission test",
    role,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}


function createStorageProvider(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    values,
    storageProvider: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
    },
  };
}

function createTrackListElement() {
  type MixEvent = { target: EventTarget | null };

  let clickHandler: ((event: MixEvent) => void | Promise<void>) | null = null;
  let inputHandler: ((event: MixEvent) => void | Promise<void>) | null = null;
  let changeHandler: ((event: MixEvent) => void | Promise<void>) | null = null;
  let enabled = true;
  let volume = 1;
  const slot = {
    dataset: {
      mixChannel: "1",
      trackId: "track-1",
    },
    querySelector(selector: string) {
      if (selector === "[data-channel-enabled]") {
        return { checked: enabled };
      }

      if (selector === "[data-channel-volume]") {
        return { value: String(volume) };
      }

      return null;
    },
  };

  return {
    innerHTML: "",
    addEventListener(
      eventName: "click" | "input" | "change" | "keydown" | "focusout",
      handler: (event: MixEvent) => void | Promise<void>,
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
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [slot];
    },
    async inputVolume(nextVolume: number) {
      if (!inputHandler) {
        throw new Error("Input handler was not registered.");
      }

      volume = nextVolume;

      await inputHandler({
        target: {
          value: String(nextVolume),
          dataset: {
            channelVolume: "",
            mixChannel: "1",
          },
        } as unknown as EventTarget,
      });
    },

    async changeVolume(nextVolume: number) {
      if (!changeHandler) {
        throw new Error("Change handler was not registered.");
      }

      volume = nextVolume;

      await changeHandler({
        target: {
          value: String(nextVolume),
          dataset: {
            channelVolume: "",
            mixChannel: "1",
          },
        } as unknown as EventTarget,
      });
    },

    async changeEnabled(nextEnabled: boolean) {
      if (!changeHandler) {
        throw new Error("Change handler was not registered.");
      }

      enabled = nextEnabled;

      await changeHandler({
        target: {
          dataset: {
            channelEnabled: "",
            mixChannel: "1",
          },
        } as unknown as EventTarget,
      });
    },

  };
}

tester.describe("permission-aware mix loading", () => {
  tester.it("automatically prepares a Viewer local mix without saving shared mix settings", async () => {
    const trackListElement = createTrackListElement();
    let saveCount = 0;
    let loadCount = 0;

    const controller = createProjectPlayerPageController({
      project: createProject("viewer"),
      projectRole: "viewer",
      currentUserId: "viewer-1",
      trackListElement,
      tracksApi: {
        getTracksByProjectId: async () => [createTrack()],
        deleteTrack: async () => createTrack(),
      },
      projectsApi: {
        deleteProject: async () => createProject("viewer"),
        saveMixSettings: async () => {
          saveCount += 1;
          return createProject("viewer");
        },
      },
      renderTrackList: () => "mix",
      audioPlayerController: {
        loadMix() {
          loadCount += 1;
        },
      },
      getTrackMediaSources: () => ({ playbackDerivativeUrl: "http://localhost/derivative.opus" }),
    });

    await controller.init();

    tester.expect(saveCount).toBe(0);
    tester.expect(loadCount).toBe(1);
  });

  tester.it("defers Contributor server persistence until the pending mix is flushed", async () => {
    const trackListElement = createTrackListElement();
    let saveCount = 0;
    let loadCount = 0;

    const controller = createProjectPlayerPageController({
      project: createProject("contributor"),
      projectRole: "contributor",
      currentUserId: "contributor-1",
      trackListElement,
      tracksApi: {
        getTracksByProjectId: async () => [createTrack()],
        deleteTrack: async () => createTrack(),
      },
      projectsApi: {
        deleteProject: async () => createProject("contributor"),
        saveMixSettings: async (_projectId, mixSettings) => {
          saveCount += 1;
          return {
            ...createProject("contributor"),
            mixSettings,
          };
        },
      },
      renderTrackList: () => "mix",
      audioPlayerController: {
        loadMix() {
          loadCount += 1;
        },
      },
      getTrackMediaSources: () => ({ playbackDerivativeUrl: "http://localhost/derivative.opus" }),
    });

    await controller.init();

    tester.expect(saveCount).toBe(0);
    tester.expect(loadCount).toBe(1);

    await trackListElement.inputVolume(0.65);

    tester.expect(saveCount).toBe(0);

    await trackListElement.changeVolume(0.65);

    tester.expect(saveCount).toBe(0);

    await controller.flushPendingMixSettings();

    tester.expect(saveCount).toBe(1);
  });

  tester.it("persists Viewer mix settings through the injected storage provider when a control change is committed", async () => {
    const storageTest = createStorageProvider();
    const trackListElement = createTrackListElement();

    const controller = createProjectPlayerPageController({
      project: createProject("viewer"),
      projectRole: "viewer",
      currentUserId: "viewer-1",
      storageProvider: storageTest.storageProvider,
      trackListElement,
      tracksApi: {
        getTracksByProjectId: async () => [createTrack()],
        deleteTrack: async () => createTrack(),
      },
      renderTrackList: () => "mix",
      audioPlayerController: {
        loadMix() {},
      },
      getTrackMediaSources: () => ({ playbackDerivativeUrl: "http://localhost/derivative.opus" }),
    });

    await controller.init();

    tester.expect(
      storageTest.values.has("grooveshare:viewer-mix:project-1"),
    ).toBe(false);

    await trackListElement.inputVolume(0.7);

    tester.expect(
      storageTest.values.has("grooveshare:viewer-mix:project-1"),
    ).toBe(false);

    await trackListElement.changeVolume(0.7);

    const savedValue = storageTest.values.get(
      "grooveshare:viewer-mix:project-1",
    );

    tester.expect(typeof savedValue).toBe("string");
    tester.expect(JSON.parse(savedValue ?? "null")).toEqual({
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: true,
          volume: 0.7,
        },
      ],
    });
  });
});
