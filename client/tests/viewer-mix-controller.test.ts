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

function createTrackListElement() {
  type MixEvent = { target: EventTarget | null };

  let clickHandler: ((event: MixEvent) => void | Promise<void>) | null = null;
  let inputHandler: ((event: MixEvent) => void | Promise<void>) | null = null;
  let changeHandler: ((event: MixEvent) => void | Promise<void>) | null = null;
  let enabled = true;
  let volume = 1;
  const classes = new Set<string>();

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
    querySelector(selector: string) {
      if (selector === "[data-load-mix-button]") {
        return {
          classList: {
            add(className: string) {
              classes.add(className);
            },
            remove(className: string) {
              classes.delete(className);
            },
          },
        };
      }

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

    async clickLoadMix() {
      if (!clickHandler) {
        throw new Error("Click handler was not registered.");
      }

      await clickHandler({
        target: {
          closest(selector: string) {
            return selector === "[data-load-mix-button]" ? {} : null;
          },
        } as unknown as EventTarget,
      });
    },
  };
}

tester.describe("permission-aware mix loading", () => {
  tester.it("lets a Viewer load/play a local mix without saving shared mix settings", async () => {
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
      getTrackAudioUrl: () => "http://localhost/audio.wav",
    });

    await controller.init();
    await trackListElement.clickLoadMix();

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
      getTrackAudioUrl: () => "http://localhost/audio.wav",
    });

    await controller.init();
    await trackListElement.clickLoadMix();

    tester.expect(saveCount).toBe(0);
    tester.expect(loadCount).toBe(1);

    await trackListElement.inputVolume(0.65);

    tester.expect(saveCount).toBe(0);

    await trackListElement.changeVolume(0.65);

    tester.expect(saveCount).toBe(0);

    await controller.flushPendingMixSettings();

    tester.expect(saveCount).toBe(1);
  });

  tester.it("persists Viewer mix settings in localStorage when a control change is committed", async () => {
    const localStorageTest = installLocalStorage();

    try {
      const trackListElement = createTrackListElement();

      const controller = createProjectPlayerPageController({
        project: createProject("viewer"),
        projectRole: "viewer",
        currentUserId: "viewer-1",
        trackListElement,
        tracksApi: {
          getTracksByProjectId: async () => [createTrack()],
          deleteTrack: async () => createTrack(),
        },
        renderTrackList: () => "mix",
        audioPlayerController: {
          loadMix() {},
        },
        getTrackAudioUrl: () => "http://localhost/audio.wav",
      });

      await controller.init();
      await trackListElement.clickLoadMix();

      tester.expect(
        localStorageTest.values.has("grooveshare:viewer-mix:project-1"),
      ).toBe(false);

      await trackListElement.inputVolume(0.7);

      tester.expect(
        localStorageTest.values.has("grooveshare:viewer-mix:project-1"),
      ).toBe(false);

      await trackListElement.changeVolume(0.7);

      const savedValue = localStorageTest.values.get(
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
    } finally {
      localStorageTest.restore();
    }
  });
});
