import type { Project, Track } from "@hugovela/frontend-core";
import { createProjectPlayerPageController } from "../src/page-controllers/project-player-page-controller.js";
import { renderProjectPlayerPage } from "../src/pages/project-player-page.js";
import { renderMixChannelSlots } from "../src/templates/mix-channel-slots.js";
import { tester } from "./test-runner/tester.js";

const ownerProject: Project = { id: "project-1", title: "Desktop Song", description: "Desktop collaboration", role: "owner", mixSettings: { channels: [] }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const ownedTrack: Track = { id: "track-1", projectId: "project-1", name: "Guitar", originalFilename: "guitar.wav", filePath: "uploads/guitar.wav", mimeType: "audio/wav", fileSize: 123, uploadedByUserId: "user-1", createdAt: "2026-01-01T00:00:00.000Z" };

type TrackListEvent = { target: EventTarget | null; key?: string; preventDefault?: () => void };
type TrackListHandler = (event: TrackListEvent) => void | Promise<void>;

function createTrackListElement() {
  const handlers = new Map<string, TrackListHandler>();
  return {
    innerHTML: "",
    addEventListener(eventName: string, handler: TrackListHandler) { handlers.set(eventName, handler); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    async editTrackNameOnEnter(trackId: string, textContent: string) {
      let blurCallCount = 0;
      let preventDefaultCallCount = 0;
      const target = { textContent, dataset: { trackNameEditor: "", trackId }, async blur() { blurCallCount += 1; await handlers.get("focusout")?.({ target: target as unknown as EventTarget }); } };
      await handlers.get("keydown")?.({ target: target as unknown as EventTarget, key: "Enter", preventDefault() { preventDefaultCallCount += 1; } });
      return { textContent: target.textContent, blurCallCount, preventDefaultCallCount };
    },
  };
}

function createEditableTextElement(initialText: string) {
  type Handler = (event: { key?: string; preventDefault?: () => void }) => void | Promise<void>;
  const handlers = new Map<string, Handler>();
  let blurCallCount = 0;
  const element = {
    textContent: initialText,
    addEventListener(eventName: string, handler: Handler) { handlers.set(eventName, handler); },
    async click() { await handlers.get("click")?.({}); },
    async blur() { blurCallCount += 1; await handlers.get("blur")?.({}); },
    async pressEnter(nextText: string) {
      let preventDefaultCallCount = 0;
      element.textContent = nextText;
      await handlers.get("keydown")?.({ key: "Enter", preventDefault() { preventDefaultCallCount += 1; } });
      return { blurCallCount, preventDefaultCallCount };
    },
  };
  return element;
}

tester.describe("desktop Project Player integration", () => {
  tester.it("renders desktop/tablet controls and inline editing without mobile presentation controls", () => {
    const pageMarkup = renderProjectPlayerPage(ownerProject);
    const mixerMarkup = renderMixChannelSlots([ownedTrack], undefined, { role: "owner", currentUserId: "user-1" });
    tester.expect(pageMarkup.includes('id="player-logout-button"')).toBe(true);
    tester.expect(pageMarkup.includes('id="delete-project-button"')).toBe(true);
    tester.expect(pageMarkup.includes('contenteditable="true"')).toBe(true);
    tester.expect(pageMarkup.includes("mobile-nav-home-button")).toBe(false);
    tester.expect(pageMarkup.includes("project-actions-button")).toBe(true);
    tester.expect(pageMarkup.includes("Manage Members")).toBe(true);
    tester.expect(pageMarkup.includes("Collaboration Link")).toBe(true);
    tester.expect(pageMarkup.includes("project-edit-modal")).toBe(false);
    tester.expect(pageMarkup.includes('id="microphone-arm-button"')).toBe(true);
    tester.expect(mixerMarkup.includes("data-track-name-editor")).toBe(true);
    tester.expect(mixerMarkup.includes('contenteditable="true"')).toBe(true);
    tester.expect(mixerMarkup.includes("data-track-edit-button")).toBe(false);
  });

  tester.it("shows microphone recording only to Contributors and Owners", () => {
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

    tester.expect(contributorMarkup.includes('id="microphone-record-button"')).toBe(true);
    tester.expect(viewerMarkup.includes('id="microphone-record-button"')).toBe(false);
    tester.expect(guestMarkup.includes('id="microphone-record-button"')).toBe(false);
  });

  tester.it("persists desktop project editing through the shared project update operation", async () => {
    const project = structuredClone(ownerProject);
    const trackListElement = createTrackListElement();
    const titleElement = createEditableTextElement(project.title);
    const descriptionElement = createEditableTextElement(project.description);
    const statusElement = { textContent: "" as string | null };
    const updates: Array<{ title?: string; description?: string }> = [];
    let selectionCount = 0;
    const controller = createProjectPlayerPageController({
      project, trackListElement, statusElement, projectTitleElement: titleElement, projectDescriptionElement: descriptionElement,
      tracksApi: { async getTracksByProjectId() { return []; }, async deleteTrack() { return ownedTrack; } },
      projectsApi: { async deleteProject() { return project; }, async updateProjectDetails(_projectId, input) { updates.push(input); return { ...project, ...input }; } },
      renderTrackList() { return ""; }, projectRole: "owner", currentUserId: "user-1", selectAllText() { selectionCount += 1; },
    });
    await controller.init();
    await titleElement.click();
    const keyboardResult = await titleElement.pressEnter("  Desktop Song Revised  ");
    tester.expect(selectionCount).toBe(1);
    tester.expect(keyboardResult.preventDefaultCallCount).toBe(1);
    tester.expect(keyboardResult.blurCallCount).toBe(1);
    tester.expect(updates).toEqual([{ title: "Desktop Song Revised" }]);
    tester.expect(project.title).toBe("Desktop Song Revised");
    tester.expect(titleElement.textContent).toBe("Desktop Song Revised");
    tester.expect(statusElement.textContent).toBe("Project title updated.");
  });

  tester.it("persists desktop inline track editing and updates prepared playback metadata", async () => {
    const project = structuredClone(ownerProject);
    const trackListElement = createTrackListElement();
    let savedName = "";
    let playbackName = "";
    const controller = createProjectPlayerPageController({
      project, trackListElement,
      tracksApi: { async getTracksByProjectId() { return [ownedTrack]; }, async deleteTrack() { return ownedTrack; }, async updateTrackName(_projectId, trackId, name) { tester.expect(trackId).toBe("track-1"); savedName = name; return { ...ownedTrack, name }; } },
      renderTrackList() { return "Guitar"; }, projectRole: "owner", currentUserId: "user-1",
      audioPlayerController: { loadMix() {}, setTrackName(trackId, name) { tester.expect(trackId).toBe("track-1"); playbackName = name; return true; } },
      getTrackAudioUrl() { return "/api/projects/project-1/tracks/track-1/audio"; },
    });
    await controller.init();
    const result = await trackListElement.editTrackNameOnEnter("track-1", "  Lead Guitar  ");
    tester.expect(result.preventDefaultCallCount).toBe(1);
    tester.expect(result.blurCallCount).toBe(1);
    tester.expect(result.textContent).toBe("Lead Guitar");
    tester.expect(savedName).toBe("Lead Guitar");
    tester.expect(playbackName).toBe("Lead Guitar");
  });
});
