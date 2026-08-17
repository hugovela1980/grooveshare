import type {
  MixSettings,
  Project,
  StorageProvider,
  Track,
} from "@hugovela/frontend-core";
import { createProjectActionsMenuController } from "../src/page-controllers/project-actions-menu-controller.js";
import { createProjectPlayerPageController } from "../src/page-controllers/project-player-page-controller.js";
import { renderProjectPlayerPage } from "../src/pages/project-player-page.js";
import { tester } from "./test-runner/tester.js";

const ownerProject: Project = {
  id: "project-1",
  title: "Mobile Song",
  description: "Phone collaboration",
  role: "owner",
  mixSettings: {
    channels: [
      {
        channelNumber: 1,
        trackId: "track-1",
        enabled: true,
        volume: 0.8,
      },
    ],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const track: Track = {
  id: "track-1",
  projectId: "project-1",
  name: "Guitar",
  originalFilename: "guitar.wav",
  filePath: "uploads/guitar.wav",
  mimeType: "audio/wav",
  fileSize: 123,
  uploadedByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

type TrackListEvent = {
  target: EventTarget | null;
};

type TrackListHandler = (
  event: TrackListEvent,
) => void | Promise<void>;

function createTrackListElement({
  initialVolume = 0.8,
  enabled = true,
}: {
  initialVolume?: number;
  enabled?: boolean;
} = {}) {
  const handlers = new Map<string, TrackListHandler>();
  let volume = initialVolume;

  const channelSlot = {
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
    addEventListener(eventName: string, handler: TrackListHandler) {
      handlers.set(eventName, handler);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [channelSlot];
    },
    async inputVolume(nextVolume: number) {
      volume = nextVolume;
      await handlers.get("input")?.({
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
      volume = nextVolume;
      await handlers.get("change")?.({
        target: {
          value: String(nextVolume),
          dataset: {
            channelVolume: "",
            mixChannel: "1",
          },
        } as unknown as EventTarget,
      });
    },
  };
}

function createForm() {
  let submitHandler:
    | ((event: { preventDefault(): void }) => void | Promise<void>)
    | null = null;

  return {
    addEventListener(
      eventName: "submit",
      handler: (event: { preventDefault(): void }) => void | Promise<void>,
    ) {
      if (eventName === "submit") {
        submitHandler = handler;
      }
    },
    async submit() {
      await submitHandler?.({ preventDefault() {} });
    },
  };
}

function createControllerButton() {
  let clickHandler: (() => void | Promise<void>) | null = null;

  return {
    disabled: false,
    addEventListener(
      eventName: "click",
      handler: () => void | Promise<void>,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },
    click() {
      return clickHandler?.();
    },
  };
}

function createMenuButton() {
  let clickHandler:
    | ((event: { target: EventTarget | null }) => void)
    | null = null;
  const attributes = new Map<string, string>();

  return {
    addEventListener(
      eventName: "click",
      handler: (event: { target: EventTarget | null }) => void,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    contains() {
      return false;
    },
    click() {
      clickHandler?.({ target: null });
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
  };
}

function createTextInput(initialValue = "") {
  return {
    value: initialValue,
    focus() {},
    select() {},
  };
}

function createNoopTracksApi(tracks: Track[] = []) {
  return {
    async getTracksByProjectId() {
      return tracks;
    },
    async deleteTrack() {
      return track;
    },
  };
}

tester.describe("mobile Project Player integration", () => {
  tester.it("loads project tracks and prepares playback through the shared playback boundary", async () => {
    const pageMarkup = renderProjectPlayerPage(ownerProject);
    tester.expect(pageMarkup.includes("mobile-nav-home-button")).toBe(true);
    tester.expect(pageMarkup.includes("project-actions-button")).toBe(true);
    tester.expect(pageMarkup.includes("player-logout-button")).toBe(false);
    tester.expect(pageMarkup.includes("data-project-title-display")).toBe(false);

    const trackListElement = createTrackListElement();
    const loadingElement = { hidden: false };
    const contentElement = { hidden: true };
    let loadedChannels: unknown[] = [];

    const controller = createProjectPlayerPageController({
      project: structuredClone(ownerProject),
      trackListElement,
      loadingElement,
      contentElement,
      tracksApi: createNoopTracksApi([track]),
      renderTrackList() {
        return '<div data-mobile-mixer="true">Guitar</div>';
      },
      audioPlayerController: {
        loadMix(channels) {
          loadedChannels = channels;
        },
      },
      getTrackAudioUrl(projectId, trackId) {
        return `/api/projects/${projectId}/tracks/${trackId}/audio`;
      },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();

    tester.expect(trackListElement.innerHTML.includes("Guitar")).toBe(true);
    tester.expect(loadingElement.hidden).toBe(true);
    tester.expect(contentElement.hidden).toBe(false);
    tester.expect(loadedChannels).toEqual([
      {
        channelNumber: 1,
        trackId: "track-1",
        name: "Guitar",
        audioUrl: "/api/projects/project-1/tracks/track-1/audio",
        volume: 0.8,
        enabled: true,
      },
    ]);
  });

  tester.it("edits a project through the mobile three-dot menu and modal", async () => {
    const project = structuredClone(ownerProject);
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const form = createForm();
    const titleInput = createTextInput();
    const descriptionInput = createTextInput();
    const mobileTitleElement = { textContent: project.title as string | null };
    const saveButton = createControllerButton();
    let updateCallCount = 0;

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      projectMobileTitleElement: mobileTitleElement,
      projectEditModal: modal,
      projectEditForm: form,
      projectEditTitleInput: titleInput,
      projectEditDescriptionInput: descriptionInput,
      projectEditSaveButton: saveButton,
      tracksApi: createNoopTracksApi(),
      projectsApi: {
        async deleteProject() {
          return project;
        },
        async updateProjectDetails(_projectId, input) {
          updateCallCount += 1;

          return {
            ...project,
            title: input.title ?? project.title,
            description: input.description ?? project.description,
          };
        },
      },
      renderTrackList() {
        return "";
      },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();

    const triggerButton = createMenuButton();
    const editProjectButton = createMenuButton();
    const menuElement = { hidden: true };
    const actionsController = createProjectActionsMenuController({
      triggerButton,
      menuElement,
      editProjectButton,
      onEditProject: controller.openProjectEditor,
      documentTarget: null,
    });

    actionsController.init();
    triggerButton.click();
    tester.expect(menuElement.hidden).toBe(false);

    editProjectButton.click();
    tester.expect(menuElement.hidden).toBe(true);
    tester.expect(modal.hidden).toBe(false);
    tester.expect(titleInput.value).toBe("Mobile Song");

    titleInput.value = "Mobile Song Revised";
    descriptionInput.value = "Updated from the phone modal";
    await form.submit();

    tester.expect(updateCallCount).toBe(1);
    tester.expect(modal.hidden).toBe(true);
    tester.expect(mobileTitleElement.textContent).toBe("Mobile Song Revised");
    tester.expect(project.title).toBe("Mobile Song Revised");
  });

  tester.it("applies mixer input to playback immediately and schedules shared persistence on change", async () => {
    const project: Project = {
      ...structuredClone(ownerProject),
      role: "contributor",
    };
    const trackListElement = createTrackListElement();
    const storageValues = new Map<string, string>();
    const storageProvider: StorageProvider = {
      getItem(key) {
        return storageValues.get(key) ?? null;
      },
      setItem(key, value) {
        storageValues.set(key, value);
      },
      removeItem(key) {
        storageValues.delete(key);
      },
    };

    let persistenceWasScheduled = false;
    let runScheduledPersistence: () => void = () => {
      throw new Error("Expected mix persistence to be scheduled.");
    };
    let serverSaveCount = 0;
    const playbackVolumeCalls: Array<[number, number]> = [];

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      tracksApi: createNoopTracksApi([track]),
      projectsApi: {
        async deleteProject() {
          return project;
        },
        async saveMixSettings(_projectId, mixSettings: MixSettings) {
          serverSaveCount += 1;
          return {
            ...project,
            mixSettings,
          };
        },
      },
      renderTrackList() {
        return "Guitar";
      },
      audioPlayerController: {
        loadMix() {},
        setChannelVolume(channelNumber, volume) {
          playbackVolumeCalls.push([channelNumber, volume]);
          return true;
        },
      },
      getTrackAudioUrl() {
        return "/audio/track-1";
      },
      projectRole: "contributor",
      currentUserId: "user-1",
      storageProvider,
      mixPersistenceDelayMs: 2000,
      scheduleTimeout(handler) {
        persistenceWasScheduled = true;
        runScheduledPersistence = handler;
        return 1 as unknown as ReturnType<typeof globalThis.setTimeout>;
      },
      clearScheduledTimeout() {
        persistenceWasScheduled = false;
      },
    });

    await controller.init();

    await trackListElement.inputVolume(0.44);
    tester.expect(playbackVolumeCalls).toEqual([[1, 0.44]]);
    tester.expect(serverSaveCount).toBe(0);

    await trackListElement.changeVolume(0.44);

    const recoveryKey = "grooveshare:pending-mix:user-1:project-1";
    tester.expect(storageValues.has(recoveryKey)).toBe(true);
    tester.expect(persistenceWasScheduled).toBe(true);
    tester.expect(serverSaveCount).toBe(0);

    runScheduledPersistence();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    tester.expect(serverSaveCount).toBe(1);
  });
});
