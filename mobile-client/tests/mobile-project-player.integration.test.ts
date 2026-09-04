import type {
  MixSettings,
  Project,
  StorageProvider,
  Track,
} from "@hugovela/frontend-core";
import { createProjectActionsMenuController } from "../src/page-controllers/project-actions-menu-controller.js";
import { createProjectDetailsScrollController } from "../src/page-controllers/project-details-scroll-controller.js";
import { createProjectPlayerPageController } from "../src/page-controllers/project-player-page-controller.js";
import { renderProjectPlayerPage } from "../src/pages/project-player-page.js";
import { renderMixChannelSlots } from "../src/templates/mix-channel-slots.js";
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
    async clickEditTrack(trackId = "track-1") {
      const editButton = {
        disabled: false,
        dataset: { trackId },
        setAttribute() {},
        removeAttribute() {},
      };

      await handlers.get("click")?.({
        target: {
          closest(selector: string) {
            return selector === "[data-track-edit-button]" ? editButton : null;
          },
        } as unknown as EventTarget,
      });

      return editButton;
    },
    async clickAddTrack() {
      const addButton = {
        disabled: false,
        dataset: {},
        setAttribute() {},
        removeAttribute() {},
      };

      await handlers.get("click")?.({
        target: {
          closest(selector: string) {
            return selector === "[data-track-add-button]" ? addButton : null;
          },
        } as unknown as EventTarget,
      });

      return addButton;
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
  let focusHandler: (() => void) | null = null;
  let focusCallCount = 0;
  let selectCallCount = 0;
  let blurCallCount = 0;

  return {
    value: initialValue,
    addEventListener(eventName: "focus", handler: () => void) {
      if (eventName === "focus") {
        focusHandler = handler;
      }
    },
    focus() {
      focusCallCount += 1;
      focusHandler?.();
    },
    select() {
      selectCallCount += 1;
    },
    blur() {
      blurCallCount += 1;
    },
    getFocusCallCount() {
      return focusCallCount;
    },
    getSelectCallCount() {
      return selectCallCount;
    },
    getBlurCallCount() {
      return blurCallCount;
    },
  };
}

function createProjectEditTracksElement() {
  const handlers = new Map<string, (event: { target: EventTarget | null }) => void | Promise<void>>();
  const values = new Map<string, string>();
  const focusCounts = new Map<string, number>();
  let markup = "";

  return {
    get innerHTML() {
      return markup;
    },
    set innerHTML(value: string) {
      markup = value;
    },
    setAttribute() {},
    removeAttribute() {},
    addEventListener(
      eventName: "input" | "click",
      handler: (event: { target: EventTarget | null }) => void | Promise<void>,
    ) {
      handlers.set(eventName, handler);
    },
    querySelector(selector: string) {
      const trackId = selector.match(/data-track-id="([^"]+)"/)?.[1];
      if (!trackId) return null;
      return {
        focus() {
          focusCounts.set(trackId, (focusCounts.get(trackId) ?? 0) + 1);
        },
      };
    },
    async inputTrackName(trackId: string, value: string) {
      values.set(trackId, value);
      await handlers.get("input")?.({
        target: {
          value,
          dataset: { projectEditTrackName: "", trackId },
        } as unknown as EventTarget,
      });
    },
    async clickDeleteTrack(trackId: string) {
      const deleteButton = {
        disabled: false,
        dataset: { trackId },
        setAttribute() {},
        removeAttribute() {},
      };
      await handlers.get("click")?.({
        target: {
          closest(selector: string) {
            return selector === "[data-project-edit-track-delete]"
              ? deleteButton
              : null;
          },
        } as unknown as EventTarget,
      });
      return deleteButton;
    },
    getInputValue(trackId: string) {
      return values.get(trackId) ?? null;
    },
    getFocusCount(trackId: string) {
      return focusCounts.get(trackId) ?? 0;
    },
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
  tester.it("renders four independent horizontal mixer strips and approved navigation labels", () => {
    const tracks = [
      track,
      { ...track, id: "track-2", name: "Drums" },
      { ...track, id: "track-3", name: "Guitar" },
      { ...track, id: "track-4", name: "Vocals" },
    ];
    const mixSettings: MixSettings = {
      channels: tracks.map((currentTrack, index) => ({
        channelNumber: index + 1,
        trackId: currentTrack.id,
        enabled: index !== 2,
        volume: [0, 0.5, 0.75, 1][index]!,
      })),
    };
    const mixerMarkup = renderMixChannelSlots(tracks, mixSettings, {
      role: "contributor",
      currentUserId: "user-1",
    });
    const pageMarkup = renderProjectPlayerPage(ownerProject, {
      currentUser: {
        id: "user-1",
        email: "player@example.com",
        displayName: "Player",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    tester.expect((mixerMarkup.match(/data-mix-channel-slot/g) ?? []).length).toBe(4);
    tester.expect(mixerMarkup.includes(">0%</span>")).toBe(true);
    tester.expect(mixerMarkup.includes(">50%</span>")).toBe(true);
    tester.expect(mixerMarkup.includes(">75%</span>")).toBe(true);
    tester.expect(mixerMarkup.includes(">100%</span>")).toBe(true);
    tester.expect((mixerMarkup.match(/ checked/g) ?? []).length).toBe(3);
    for (const label of ["Projects", "People", "Library", "Logout"]) {
      tester.expect(pageMarkup.includes(`>${label}</span>`)).toBe(true);
    }
  });

  tester.it("shows microphone recording only to Contributors and Owners", () => {
    const ownerMarkup = renderProjectPlayerPage(ownerProject);
    const contributorMarkup = renderProjectPlayerPage({
      ...ownerProject,
      role: "contributor",
    });
    const viewerMarkup = renderProjectPlayerPage({
      ...ownerProject,
      role: "viewer",
    });
    const guestMarkup = renderProjectPlayerPage({
      ...ownerProject,
      role: null,
      access: "guest",
    });

    tester.expect(ownerMarkup.includes('id="microphone-arm-button"')).toBe(true);
    tester.expect(ownerMarkup.includes("audio-player__transport--without-microphone")).toBe(false);
    const headerMarkup = ownerMarkup.slice(
      ownerMarkup.indexOf('<header class="page-header project-player-header">'),
      ownerMarkup.indexOf("</header>") + "</header>".length,
    );
    tester.expect(headerMarkup.includes('id="player-back-button"')).toBe(true);
    tester.expect(headerMarkup.includes('class="project-player-identity"')).toBe(true);
    tester.expect(headerMarkup.includes('id="project-actions-button"')).toBe(true);
    tester.expect((ownerMarkup.match(/class="project-player-identity"/g) ?? []).length).toBe(1);
    const identitySummaryMarkup = headerMarkup.slice(
      headerMarkup.indexOf('<summary class="project-player-identity__summary">'),
      headerMarkup.indexOf("</summary>") + "</summary>".length,
    );
    const identityDetailsMarkup = headerMarkup.slice(
      headerMarkup.indexOf('<div class="project-player-identity__details">'),
      headerMarkup.indexOf("</details>"),
    );
    tester.expect(identitySummaryMarkup.includes("Mobile Song")).toBe(true);
    tester.expect(identitySummaryMarkup.includes("Owner")).toBe(false);
    tester.expect(identitySummaryMarkup.indexOf("Mobile Song") < identitySummaryMarkup.indexOf("project-player-identity__disclosure")).toBe(true);
    tester.expect(identityDetailsMarkup.includes("Owner")).toBe(true);
    tester.expect(ownerMarkup.includes("Phone collaboration")).toBe(true);
    tester.expect(ownerMarkup.includes("120 BPM · 4/4")).toBe(true);
    tester.expect(ownerMarkup.includes("Bar 1 at project start")).toBe(false);
    tester.expect(ownerMarkup.includes('id="project-details-track-names"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="project-details-edit-button"')).toBe(true);
    tester.expect((ownerMarkup.match(/class="project-player-edit-section" open/g) ?? []).length).toBe(1);
    tester.expect(ownerMarkup.includes("<summary>Project details</summary>")).toBe(true);
    tester.expect(ownerMarkup.includes("<summary>Tracks</summary>")).toBe(true);
    tester.expect(ownerMarkup.includes('<details class="project-player-edit-section">\n            <summary>Tracks</summary>')).toBe(true);
    tester.expect(ownerMarkup.includes('id="project-edit-track-list"')).toBe(true);
    tester.expect(ownerMarkup.includes("Save Changes")).toBe(true);
    tester.expect(contributorMarkup.includes('id="project-details-edit-button"')).toBe(false);
    tester.expect(ownerMarkup.includes('id="microphone-review-view"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-review-recovered"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-recovery-view"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-recovery-retry-button"')).toBe(true);
    tester.expect(ownerMarkup.includes("Draft recovered")).toBe(true);
    tester.expect(ownerMarkup.includes("Take ready")).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-audition-volume"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-alignment-disclosure"')).toBe(false);
    tester.expect(ownerMarkup.includes('role="tablist"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-alignment-tab"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-playback-mix-tab"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-alignment-panel"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-playback-mix-panel"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-review-mix-track-list"')).toBe(true);
    tester.expect(ownerMarkup.includes('aria-label="Review playback mix tracks"')).toBe(true);
    tester.expect(ownerMarkup.includes('tabindex="0"')).toBe(true);
    tester.expect(ownerMarkup.includes("Synchronize")).toBe(true);
    tester.expect(ownerMarkup.includes("Mix")).toBe(true);
    tester.expect(ownerMarkup.includes("Sync your recording to playback in milliseconds")).toBe(true);
    tester.expect(ownerMarkup.includes("Align your recording to playback in milliseconds")).toBe(false);
    tester.expect(ownerMarkup.includes("← Move earlier")).toBe(true);
    tester.expect(ownerMarkup.includes("Move later →")).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-alignment-heading"')).toBe(false);
    tester.expect(ownerMarkup.includes('id="microphone-keep-dialog"')).toBe(true);
    tester.expect(ownerMarkup.includes("<strong>Playback Mix</strong>")).toBe(false);
    tester.expect(ownerMarkup.includes("microphone-recording__playback-mix-heading")).toBe(false);
    const keepDialogMarkup = ownerMarkup.slice(
      ownerMarkup.indexOf('id="microphone-keep-dialog"'),
      ownerMarkup.indexOf('id="microphone-discard-dialog"'),
    );
    tester.expect(keepDialogMarkup.includes("microphone-recording__phase-label")).toBe(false);
    tester.expect(ownerMarkup.includes('id="microphone-discard-dialog"')).toBe(true);
    tester.expect(ownerMarkup.includes("Discard Take")).toBe(true);
    const reviewActionsMarkup = ownerMarkup.slice(
      ownerMarkup.indexOf('class="microphone-recording__review-actions"'),
      ownerMarkup.indexOf('class="microphone-recording__audition-volume"'),
    );
    tester.expect(reviewActionsMarkup.includes('id="microphone-discard-button"')).toBe(true);
    tester.expect(reviewActionsMarkup.includes('aria-label="Discard Take"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-preparing-view"')).toBe(true);
    tester.expect(ownerMarkup.includes("Preparing microphone")).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-ready-view"')).toBe(true);
    tester.expect(ownerMarkup.includes("Microphone ready")).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-count-in-view"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-active-recording-view"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-processing-view"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-start-position-button"')).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-recording-start-status"')).toBe(true);
    tester.expect(ownerMarkup.includes("Start recording")).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-failure-view"')).toBe(true);
    tester.expect(ownerMarkup.includes("Try again")).toBe(true);
    tester.expect(ownerMarkup.includes('id="microphone-audition-button"')).toBe(true);
    tester.expect(contributorMarkup.includes('id="microphone-record-button"')).toBe(true);
    tester.expect(contributorMarkup.includes('id="microphone-retry-button"')).toBe(true);
    tester.expect(contributorMarkup.includes('id="microphone-discard-button"')).toBe(true);
    tester.expect(viewerMarkup.includes('id="microphone-record-button"')).toBe(false);
    tester.expect(viewerMarkup.includes("audio-player__transport--without-microphone")).toBe(true);
    tester.expect(viewerMarkup.includes('id="microphone-preparing-view"')).toBe(false);
    tester.expect(viewerMarkup.includes('id="microphone-count-in-view"')).toBe(false);
    tester.expect(guestMarkup.includes('id="microphone-record-button"')).toBe(false);
    tester.expect(guestMarkup.includes('id="microphone-preparing-view"')).toBe(false);
  });

  tester.it("collapses expanded project details when the page reaches the bottom", () => {
    const detailsElement = { open: true };
    const listeners: { scroll?: () => void } = {};
    let pageAtBottom = false;
    const scrollTarget = {
      addEventListener(_type: "scroll", listener: () => void) {
        listeners.scroll = listener;
      },
      removeEventListener(_type: "scroll", listener: () => void) {
        if (listeners.scroll === listener) {
          delete listeners.scroll;
        }
      },
    };
    const controller = createProjectDetailsScrollController({
      detailsElement,
      scrollTarget,
      isPageAtBottom: () => pageAtBottom,
    });

    controller.init();
    listeners.scroll?.();
    tester.expect(detailsElement.open).toBe(true);

    pageAtBottom = true;
    listeners.scroll?.();
    tester.expect(detailsElement.open).toBe(false);

    detailsElement.open = true;
    controller.destroy();
    tester.expect(listeners.scroll).toBe(undefined);
  });

  tester.it("loads project tracks and prepares playback through the shared playback boundary", async () => {
    const pageMarkup = renderProjectPlayerPage(ownerProject);
    tester.expect(pageMarkup.includes("mobile-nav-home-button")).toBe(true);
    tester.expect(pageMarkup.includes("project-actions-button")).toBe(true);
    tester.expect(pageMarkup.includes("player-logout-button")).toBe(false);
    tester.expect(pageMarkup.includes("data-project-title-display")).toBe(false);

    const trackListElement = createTrackListElement();
    const loadingElement = { hidden: false };
    const contentElement = { hidden: true };
    const projectDetailsTrackNamesElement = { textContent: "Loading tracks…" as string | null };
    let loadedChannels: unknown[] = [];

    const controller = createProjectPlayerPageController({
      project: structuredClone(ownerProject),
      trackListElement,
      loadingElement,
      contentElement,
      projectDetailsTrackNamesElement,
      tracksApi: createNoopTracksApi([track]),
      renderTrackList() {
        return '<div data-mobile-mixer="true">Guitar</div>';
      },
      audioPlayerController: {
        loadMix(channels) {
          loadedChannels = channels;
        },
      },
      getTrackMediaSources(track) {
        return {
          playbackDerivativeUrl:
            `/api/projects/${track.projectId}/tracks/${track.id}/playback-derivative`,
          originalAudioUrl:
            `/api/projects/${track.projectId}/tracks/${track.id}/audio`,
        };
      },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();

    tester.expect(trackListElement.innerHTML.includes("Guitar")).toBe(true);
    tester.expect(projectDetailsTrackNamesElement.textContent).toBe("Guitar");
    tester.expect(loadingElement.hidden).toBe(true);
    tester.expect(contentElement.hidden).toBe(false);
    tester.expect(loadedChannels).toEqual([
      {
        channelNumber: 1,
        trackId: "track-1",
        name: "Guitar",
        playbackDerivativeUrl:
          "/api/projects/project-1/tracks/track-1/playback-derivative",
        originalAudioUrl: "/api/projects/project-1/tracks/track-1/audio",
        volume: 0.8,
        enabled: true,
      },
    ]);
  });

  tester.it("uploads a phone-originated m4a track through the mobile Add Track flow", async () => {
    const project: Project = {
      ...structuredClone(ownerProject),
      role: "contributor",
      mixSettings: { channels: [] },
    };
    const trackListElement = createTrackListElement();
    const statusElement = { textContent: "" as string | null };
    const audioFile = new File(["phone audio"], "voice-memo.m4a", {
      type: "audio/x-m4a",
    });
    let uploadCallCount = 0;
    let currentTracks: Track[] = [];

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      statusElement,
      tracksApi: {
        async getTracksByProjectId() {
          return currentTracks;
        },
        async deleteTrack() {
          return track;
        },
        async uploadTrack(input) {
          uploadCallCount += 1;
          const uploadedTrack: Track = {
            ...track,
            id: "track-m4a",
            name: input.trackName,
            originalFilename: input.audioFile.name,
            mimeType: input.audioFile.type,
          };
          currentTracks = [uploadedTrack];
          return uploadedTrack;
        },
      },
      renderTrackList(tracks) {
        return tracks.map((currentTrack) => currentTrack.name).join(",");
      },
      projectRole: "contributor",
      currentUserId: "user-1",
      chooseAudioFile: async () => audioFile,
    });

    await controller.init();
    await trackListElement.clickAddTrack();

    tester.expect(uploadCallCount).toBe(1);
    tester.expect(trackListElement.innerHTML.includes("voice-memo")).toBe(true);
    tester.expect(statusElement.textContent).toBe("Track added.");
  });

  tester.it("edits a project through the mobile three-dot menu and modal", async () => {
    const project = structuredClone(ownerProject);
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const form = createForm();
    const titleInput = createTextInput();
    const descriptionInput = createTextInput();
    const editTracksElement = { innerHTML: "" };
    const mobileTitleElement = { textContent: project.title as string | null };
    const saveButton = createControllerButton();
    const detailsEditButton = createControllerButton();
    let updateCallCount = 0;

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      projectMobileTitleElement: mobileTitleElement,
      projectEditModal: modal,
      projectEditForm: form,
      projectEditTitleInput: titleInput,
      projectEditDescriptionInput: descriptionInput,
      projectEditTracksElement: editTracksElement,
      projectEditSaveButton: saveButton,
      projectDetailsEditButton: detailsEditButton,
      tracksApi: createNoopTracksApi([track]),
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

    await detailsEditButton.click();
    tester.expect(modal.hidden).toBe(false);
    tester.expect(titleInput.value).toBe("Mobile Song");
    tester.expect(editTracksElement.innerHTML.includes("Track 1")).toBe(true);
    tester.expect(editTracksElement.innerHTML.includes('value="Guitar"')).toBe(true);
    tester.expect(editTracksElement.innerHTML.includes("Delete Track")).toBe(true);
    tester.expect(editTracksElement.innerHTML.includes("Start bar")).toBe(false);
    modal.hidden = true;

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
    tester.expect(titleInput.getFocusCallCount()).toBe(0);
    tester.expect(titleInput.getSelectCallCount()).toBe(0);

    titleInput.focus();
    tester.expect(titleInput.getSelectCallCount()).toBe(1);

    titleInput.value = "Mobile Song Revised";
    descriptionInput.value = "Updated from the phone modal";
    await form.submit();

    tester.expect(updateCallCount).toBe(1);
    tester.expect(modal.hidden).toBe(true);
    tester.expect(mobileTitleElement.textContent).toBe("Mobile Song Revised");
    tester.expect(project.title).toBe("Mobile Song Revised");
    tester.expect(titleInput.getBlurCallCount()).toBe(1);
    tester.expect(descriptionInput.getBlurCallCount()).toBe(1);
  });

  tester.it("saves only changed track names without modifying timing metadata", async () => {
    const project = structuredClone(ownerProject);
    const placedTrack: Track = {
      ...track,
      musicalPlacement: {
        start: { bar: 3, beat: 2 },
        spanBeats: 12,
      },
    };
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const form = createForm();
    const titleInput = createTextInput();
    const descriptionInput = createTextInput();
    const editTracksElement = createProjectEditTracksElement();
    const updateDetailsCalls: Array<{ trackId: string; details: { name?: string; musicalPlacement?: unknown } }> = [];
    let projectUpdateCount = 0;

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      projectEditModal: modal,
      projectEditForm: form,
      projectEditTitleInput: titleInput,
      projectEditDescriptionInput: descriptionInput,
      projectEditTracksElement: editTracksElement,
      projectEditSaveButton: createControllerButton(),
      tracksApi: {
        async getTracksByProjectId() {
          return [placedTrack];
        },
        async deleteTrack() {
          return placedTrack;
        },
        async updateTrackDetails(_projectId, trackId, details) {
          updateDetailsCalls.push({ trackId, details });
          return { ...placedTrack, name: details.name ?? placedTrack.name };
        },
      },
      projectsApi: {
        async deleteProject() {
          return project;
        },
        async updateProjectDetails() {
          projectUpdateCount += 1;
          return project;
        },
      },
      renderTrackList(tracks) {
        return tracks.map((currentTrack) => currentTrack.name).join(", ");
      },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    await editTracksElement.inputTrackName(placedTrack.id, "  Lead   Guitar  ");
    await form.submit();

    tester.expect(projectUpdateCount).toBe(0);
    tester.expect(updateDetailsCalls).toEqual([
      { trackId: placedTrack.id, details: { name: "Lead Guitar" } },
    ]);
    tester.expect(updateDetailsCalls[0]!.details.musicalPlacement).toBe(undefined);
    tester.expect(trackListElement.innerHTML).toBe("Lead Guitar");
    tester.expect(modal.hidden).toBe(true);
  });

  tester.it("saves combined project and changed-track edits while skipping unchanged tracks", async () => {
    const project = structuredClone(ownerProject);
    const tracks = [
      track,
      { ...track, id: "track-2", name: "Drums" },
      { ...track, id: "track-3", name: "Bass" },
    ];
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const form = createForm();
    const titleInput = createTextInput();
    const descriptionInput = createTextInput();
    const editTracksElement = createProjectEditTracksElement();
    const updatedTrackIds: string[] = [];
    let projectUpdateCount = 0;

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      projectEditModal: modal,
      projectEditForm: form,
      projectEditTitleInput: titleInput,
      projectEditDescriptionInput: descriptionInput,
      projectEditTracksElement: editTracksElement,
      projectEditSaveButton: createControllerButton(),
      tracksApi: {
        async getTracksByProjectId() {
          return tracks;
        },
        async deleteTrack() {
          return track;
        },
        async updateTrackDetails(_projectId, trackId, details) {
          updatedTrackIds.push(trackId);
          const currentTrack = tracks.find((candidate) => candidate.id === trackId)!;
          return { ...currentTrack, name: details.name ?? currentTrack.name };
        },
      },
      projectsApi: {
        async deleteProject() {
          return project;
        },
        async updateProjectDetails(_projectId, input) {
          projectUpdateCount += 1;
          return {
            ...project,
            title: input.title ?? project.title,
            description: input.description ?? project.description,
          };
        },
      },
      renderTrackList(currentTracks) {
        return currentTracks.map((currentTrack) => currentTrack.name).join(", ");
      },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    titleInput.value = "Revised Project";
    descriptionInput.value = "Revised description";
    await editTracksElement.inputTrackName("track-1", "Electric Guitar");
    await editTracksElement.inputTrackName("track-2", "Live Drums");
    await form.submit();

    tester.expect(projectUpdateCount).toBe(1);
    tester.expect(updatedTrackIds).toEqual(["track-1", "track-2"]);
    tester.expect(updatedTrackIds.includes("track-3")).toBe(false);
    tester.expect(project.title).toBe("Revised Project");
    tester.expect(trackListElement.innerHTML).toBe("Electric Guitar, Live Drums, Bass");
    tester.expect(modal.hidden).toBe(true);
  });

  tester.it("rejects blank staged track names and keeps the editor open", async () => {
    const project = structuredClone(ownerProject);
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const form = createForm();
    const editTracksElement = createProjectEditTracksElement();
    const editStatus = { textContent: "" as string | null };
    let trackUpdateCount = 0;
    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      projectEditModal: modal,
      projectEditForm: form,
      projectEditTitleInput: createTextInput(),
      projectEditDescriptionInput: createTextInput(),
      projectEditTracksElement: editTracksElement,
      projectEditSaveButton: createControllerButton(),
      projectEditStatusElement: editStatus,
      tracksApi: {
        async getTracksByProjectId() { return [track]; },
        async deleteTrack() { return track; },
        async updateTrackName(_projectId, _trackId, name) {
          trackUpdateCount += 1;
          return { ...track, name };
        },
      },
      renderTrackList() { return "Guitar"; },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    await editTracksElement.inputTrackName(track.id, "   ");
    await form.submit();

    tester.expect(trackUpdateCount).toBe(0);
    tester.expect(modal.hidden).toBe(false);
    tester.expect(editStatus.textContent).toBe('Track name for "Guitar" is required.');
    tester.expect(editTracksElement.getFocusCount(track.id)).toBe(1);
  });

  tester.it("keeps confirmed partial saves consistent when a later track update fails", async () => {
    const project = structuredClone(ownerProject);
    const tracks = [track, { ...track, id: "track-2", name: "Drums" }];
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const form = createForm();
    const editTracksElement = createProjectEditTracksElement();
    const editStatus = { textContent: "" as string | null };
    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      projectEditModal: modal,
      projectEditForm: form,
      projectEditTitleInput: createTextInput(),
      projectEditDescriptionInput: createTextInput(),
      projectEditTracksElement: editTracksElement,
      projectEditSaveButton: createControllerButton(),
      projectEditStatusElement: editStatus,
      tracksApi: {
        async getTracksByProjectId() { return tracks; },
        async deleteTrack() { return track; },
        async updateTrackName(_projectId, trackId, name) {
          if (trackId === "track-2") throw new Error("Save failed");
          return { ...track, name };
        },
      },
      renderTrackList(currentTracks) {
        return currentTracks.map((currentTrack) => currentTrack.name).join(", ");
      },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    await editTracksElement.inputTrackName("track-1", "Lead Guitar");
    await editTracksElement.inputTrackName("track-2", "Live Drums");
    await form.submit();

    tester.expect(modal.hidden).toBe(false);
    tester.expect(trackListElement.innerHTML).toBe("Lead Guitar, Drums");
    tester.expect(editTracksElement.getInputValue("track-2")).toBe("Live Drums");
    tester.expect(editStatus.textContent?.includes("remaining edits are still here")).toBe(true);
  });

  tester.it("does not submit track changes when the preceding project update fails", async () => {
    const project = structuredClone(ownerProject);
    const modal = { hidden: true };
    const form = createForm();
    const titleInput = createTextInput();
    const editTracksElement = createProjectEditTracksElement();
    const editStatus = { textContent: "" as string | null };
    let trackUpdateCount = 0;
    const controller = createProjectPlayerPageController({
      project,
      trackListElement: createTrackListElement(),
      projectEditModal: modal,
      projectEditForm: form,
      projectEditTitleInput: titleInput,
      projectEditDescriptionInput: createTextInput(),
      projectEditTracksElement: editTracksElement,
      projectEditSaveButton: createControllerButton(),
      projectEditStatusElement: editStatus,
      tracksApi: {
        async getTracksByProjectId() { return [track]; },
        async deleteTrack() { return track; },
        async updateTrackName(_projectId, _trackId, name) {
          trackUpdateCount += 1;
          return { ...track, name };
        },
      },
      projectsApi: {
        async deleteProject() { return project; },
        async updateProjectDetails() { throw new Error("Project save failed"); },
      },
      renderTrackList() { return "Guitar"; },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    titleInput.value = "Unsaved title";
    await editTracksElement.inputTrackName(track.id, "Unsaved Guitar");
    await form.submit();

    tester.expect(trackUpdateCount).toBe(0);
    tester.expect(modal.hidden).toBe(false);
    tester.expect(editStatus.textContent).toBe(
      "Could not save project details. Track name changes were not submitted.",
    );
  });

  tester.it("blocks duplicate Save Changes submissions while requests are pending", async () => {
    const project = structuredClone(ownerProject);
    const form = createForm();
    const editTracksElement = createProjectEditTracksElement();
    let updateCount = 0;
    const deferredUpdate: { finish: (() => void) | null } = { finish: null };
    const controller = createProjectPlayerPageController({
      project,
      trackListElement: createTrackListElement(),
      projectEditModal: { hidden: true },
      projectEditForm: form,
      projectEditTitleInput: createTextInput(),
      projectEditDescriptionInput: createTextInput(),
      projectEditTracksElement: editTracksElement,
      projectEditSaveButton: createControllerButton(),
      tracksApi: {
        async getTracksByProjectId() { return [track]; },
        async deleteTrack() { return track; },
        updateTrackName(_projectId, _trackId, name) {
          updateCount += 1;
          return new Promise<Track>((resolve) => {
            deferredUpdate.finish = () => resolve({ ...track, name });
          });
        },
      },
      renderTrackList() { return "Guitar"; },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    await editTracksElement.inputTrackName(track.id, "Lead Guitar");
    const firstSave = form.submit();
    const duplicateSave = form.submit();

    tester.expect(updateCount).toBe(1);
    deferredUpdate.finish?.();
    await Promise.all([firstSave, duplicateSave]);
    tester.expect(updateCount).toBe(1);
  });

  tester.it("cancels Edit Project track deletion without changing staged edits", async () => {
    const project = structuredClone(ownerProject);
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const editTracksElement = createProjectEditTracksElement();
    let deleteCount = 0;
    let confirmationMessage = "";
    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      projectEditModal: modal,
      projectEditTitleInput: createTextInput(),
      projectEditDescriptionInput: createTextInput(),
      projectEditTracksElement: editTracksElement,
      tracksApi: {
        async getTracksByProjectId() { return [track]; },
        async deleteTrack() {
          deleteCount += 1;
          return track;
        },
      },
      renderTrackList() { return "Guitar"; },
      confirmDeleteTrack(message) {
        confirmationMessage = message;
        return false;
      },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    await editTracksElement.inputTrackName(track.id, "Unsaved Guitar");
    await editTracksElement.clickDeleteTrack(track.id);

    tester.expect(confirmationMessage).toBe('Delete "Guitar" from this project?');
    tester.expect(deleteCount).toBe(0);
    tester.expect(editTracksElement.getInputValue(track.id)).toBe("Unsaved Guitar");
    tester.expect(modal.hidden).toBe(false);
  });

  tester.it("deletes a track immediately and preserves unrelated unsaved modal fields", async () => {
    const project = structuredClone(ownerProject);
    const drums = { ...track, id: "track-2", name: "Drums" };
    let currentTracks = [track, drums];
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const titleInput = createTextInput();
    const descriptionInput = createTextInput();
    const editTracksElement = createProjectEditTracksElement();
    const detailsNames = { textContent: "" as string | null };
    let deleteCount = 0;
    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      projectDetailsTrackNamesElement: detailsNames,
      projectEditModal: modal,
      projectEditTitleInput: titleInput,
      projectEditDescriptionInput: descriptionInput,
      projectEditTracksElement: editTracksElement,
      tracksApi: {
        async getTracksByProjectId() { return currentTracks; },
        async deleteTrack(_projectId, trackId) {
          deleteCount += 1;
          const deletedTrack = currentTracks.find((candidate) => candidate.id === trackId)!;
          currentTracks = currentTracks.filter((candidate) => candidate.id !== trackId);
          return deletedTrack;
        },
      },
      renderTrackList(tracks) {
        return tracks.map((currentTrack) => currentTrack.name).join(", ");
      },
      confirmDeleteTrack() { return true; },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    titleInput.value = "Unsaved Project Title";
    descriptionInput.value = "Unsaved project description";
    await editTracksElement.inputTrackName(drums.id, "Unsaved Live Drums");
    await editTracksElement.clickDeleteTrack(track.id);

    tester.expect(deleteCount).toBe(1);
    tester.expect(modal.hidden).toBe(false);
    tester.expect(titleInput.value).toBe("Unsaved Project Title");
    tester.expect(descriptionInput.value).toBe("Unsaved project description");
    tester.expect(editTracksElement.innerHTML.includes('data-track-id="track-1"')).toBe(false);
    tester.expect(editTracksElement.innerHTML.includes('value="Unsaved Live Drums"')).toBe(true);
    tester.expect(trackListElement.innerHTML).toBe("Drums");
    tester.expect(detailsNames.textContent).toBe("Drums");
  });

  tester.it("keeps Edit Project usable with staged values after track deletion fails", async () => {
    const project = structuredClone(ownerProject);
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const titleInput = createTextInput();
    const editTracksElement = createProjectEditTracksElement();
    const editStatus = { textContent: "" as string | null };
    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      projectEditModal: modal,
      projectEditTitleInput: titleInput,
      projectEditDescriptionInput: createTextInput(),
      projectEditTracksElement: editTracksElement,
      projectEditStatusElement: editStatus,
      tracksApi: {
        async getTracksByProjectId() { return [track]; },
        async deleteTrack() { throw new Error("Delete failed"); },
      },
      renderTrackList() { return "Guitar"; },
      confirmDeleteTrack() { return true; },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    titleInput.value = "Unsaved title";
    await editTracksElement.inputTrackName(track.id, "Unsaved Guitar");
    const deleteButton = await editTracksElement.clickDeleteTrack(track.id);

    tester.expect(modal.hidden).toBe(false);
    tester.expect(titleInput.value).toBe("Unsaved title");
    tester.expect(editTracksElement.getInputValue(track.id)).toBe("Unsaved Guitar");
    tester.expect(deleteButton.disabled).toBe(false);
    tester.expect(editStatus.textContent).toBe("Could not delete track. Your edits are still here.");
  });

  tester.it("blocks unauthorized Edit Project track deletion", async () => {
    const project: Project = { ...structuredClone(ownerProject), role: "contributor" };
    const protectedTrack = { ...track, uploadedByUserId: "another-user" };
    const editTracksElement = createProjectEditTracksElement();
    const editStatus = { textContent: "" as string | null };
    let deleteCount = 0;
    const controller = createProjectPlayerPageController({
      project,
      trackListElement: createTrackListElement(),
      projectEditModal: { hidden: true },
      projectEditTitleInput: createTextInput(),
      projectEditDescriptionInput: createTextInput(),
      projectEditTracksElement: editTracksElement,
      projectEditStatusElement: editStatus,
      tracksApi: {
        async getTracksByProjectId() { return [protectedTrack]; },
        async deleteTrack() {
          deleteCount += 1;
          return protectedTrack;
        },
      },
      renderTrackList() { return "Guitar"; },
      confirmDeleteTrack() { return true; },
      projectRole: "contributor",
      currentUserId: "user-1",
    });

    await controller.init();
    controller.openProjectEditor();
    tester.expect(editTracksElement.innerHTML).toBe("");
    await editTracksElement.clickDeleteTrack(protectedTrack.id);

    tester.expect(deleteCount).toBe(0);
    tester.expect(editStatus.textContent).toBe("Track access denied.");
  });

  tester.it("opens track editing without forcing the keyboard and selects the name after deliberate focus", async () => {
    const project = structuredClone(ownerProject);
    const trackListElement = createTrackListElement();
    const modal = { hidden: true };
    const form = createForm();
    const nameInput = createTextInput();
    const saveButton = createControllerButton();

    const controller = createProjectPlayerPageController({
      project,
      trackListElement,
      trackEditModal: modal,
      trackEditForm: form,
      trackEditNameInput: nameInput,
      trackEditSaveButton: saveButton,
      tracksApi: {
        async getTracksByProjectId() {
          return [track];
        },
        async deleteTrack() {
          return track;
        },
        async updateTrackName(_projectId, _trackId, name) {
          return { ...track, name };
        },
      },
      renderTrackList() {
        return "Guitar";
      },
      projectRole: "owner",
      currentUserId: "user-1",
    });

    await controller.init();
    await trackListElement.clickEditTrack();

    tester.expect(modal.hidden).toBe(false);
    tester.expect(nameInput.value).toBe("Guitar");
    tester.expect(nameInput.getFocusCallCount()).toBe(0);
    tester.expect(nameInput.getSelectCallCount()).toBe(0);

    nameInput.focus();
    tester.expect(nameInput.getSelectCallCount()).toBe(1);
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
      getTrackMediaSources() {
        return { playbackDerivativeUrl: "/derivative/track-1" };
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
