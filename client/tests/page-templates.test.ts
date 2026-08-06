import { renderConfirmProjectPage } from "../src/pages/confirm-project-page.js";
import { renderCreateProjectPage } from "../src/pages/create-project-page.js";
import { renderProjectMenuPage } from "../src/pages/project-menu-page.js";
import { renderProjectPlayerPage } from "../src/pages/project-player-page.js";
import { tester } from "./test-runner/tester.js";

tester.describe("page templates", () => {
  tester.it("renders the Project Menu page", () => {
    const html = renderProjectMenuPage();

    tester.expect(html.includes("Grooveshare")).toBe(true);
    tester.expect(html.includes("Share tracks. Build songs together.")).toBe(true);
    tester.expect(html.includes("Current Projects")).toBe(true);
    tester.expect(html.includes("Create a New Project")).toBe(true);
    tester.expect(html.includes("project-list")).toBe(true);
    tester.expect(html.includes("add-project-button")).toBe(true);
  });

  tester.it("renders the Create Project page", () => {
    const html = renderCreateProjectPage();

    tester.expect(html.includes("Create Project")).toBe(true);
    tester.expect(html.includes("project-form")).toBe(true);
    tester.expect(html.includes("project-title")).toBe(true);

    tester.expect(html.includes("Add Audio Tracks")).toBe(true);
    tester.expect(html.includes("open-add-tracks-modal-button")).toBe(true);
    tester.expect(html.includes("add-audio-tracks-modal")).toBe(true);
    tester.expect(html.includes("pending-track-form")).toBe(true);
    tester.expect(html.includes("pending-audio-files")).toBe(true);
    tester.expect(html.includes("selected-audio-track-rows")).toBe(true);
    tester.expect(html.includes("tracks-to-include-section")).toBe(true);
    tester.expect(html.includes("Create a New Project")).toBe(true);

    tester.expect(html.includes('id="pending-track-name"')).toBe(false);
    tester.expect(html.includes('id="pending-audio-file"')).toBe(false);
    tester.expect(html.includes("Add track")).toBe(false);
  });

  tester.it("renders the Confirm Project page without a project", () => {
    const html = renderConfirmProjectPage();

    tester.expect(html.includes("Confirm Project")).toBe(true);
    tester.expect(html.includes("confirm-project")).toBe(true);
    tester.expect(html.includes("Project confirmation details will appear here.")).toBe(true);
    tester.expect(html.includes("edit-project-button")).toBe(true);
    tester.expect(html.includes("confirm-project-button")).toBe(true);
    tester.expect(html.includes("confirm-project-panel")).toBe(true);
  });

  tester.it("renders created project details on the Confirm Project page", () => {
    const html = renderConfirmProjectPage({
      project: {
        title: "Bass Groove",
        description: "Practice loop",
      },
      pendingTracks: [],
    });

    tester.expect(html.includes("Bass Groove")).toBe(true);
    tester.expect(html.includes("Practice loop")).toBe(true);
  });

  tester.it("renders pending tracks on the Confirm Project page", () => {
    const html = renderConfirmProjectPage({
      project: {
        title: "Bass Groove",
        description: "Practice loop",
      },
      pendingTracks: [
        {
          id: "pending-track-1",
          trackName: "Lead Guitar",
          audioFile: {
            name: "guitar.wav",
            type: "audio/wav",
            size: 123,
          } as unknown as File,
          originalFilename: "guitar.wav",
          mimeType: "audio/wav",
          fileSize: 123,
        },
      ],
    });

    tester.expect(html.includes("Lead Guitar")).toBe(true);
    tester.expect(html.includes("guitar.wav")).toBe(true);
  });

  tester.it("renders the Project Player page", () => {
    const html = renderProjectPlayerPage();

    tester.expect(html.includes("Project Player")).toBe(true);
    tester.expect(html.includes("Audio Player")).toBe(true);
    tester.expect(html.includes("player-area")).toBe(true);
    tester.expect(html.includes("player-track-list")).toBe(true);
  });

  tester.it("renders selected project details on the Project Player page", () => {
    const html = renderProjectPlayerPage({
      id: "project-1",
      title: "Reggae groove",
      description: "guitar and bass",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    tester.expect(html.includes("Project Player")).toBe(true);
    tester.expect(html.includes("Reggae groove")).toBe(true);
    tester.expect(html.includes("guitar and bass")).toBe(true);
    tester.expect(html.includes("Audio Player")).toBe(true);
    tester.expect(html.includes("player-area")).toBe(true);
    tester.expect(html.includes("player-track-list")).toBe(true);
    tester.expect(html.includes("player-track-upload-form")).toBe(false);
  });
});