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
  let clickHandler: ((event: { target: EventTarget | null }) => void | Promise<void>) | null = null;
  const classes = new Set<string>();

  const slot = {
    dataset: {
      mixChannel: "1",
      trackId: "track-1",
    },
    querySelector(selector: string) {
      if (selector === "[data-channel-enabled]") {
        return { checked: true };
      }

      if (selector === "[data-channel-volume]") {
        return { value: "1" };
      }

      return null;
    },
  };

  return {
    innerHTML: "",
    addEventListener(
      eventName: "click" | "input" | "keydown" | "focusout",
      handler: (event: { target: EventTarget | null }) => void | Promise<void>,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
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

  tester.it("still persists Contributor mix settings before loading", async () => {
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

    tester.expect(saveCount).toBe(1);
    tester.expect(loadCount).toBe(1);
  });


  tester.it("persists Viewer mix settings in localStorage", async () => {
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
            volume: 1,
          },
        ],
      });
    } finally {
      localStorageTest.restore();
    }
  });
});
