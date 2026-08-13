import { renderAuthPage } from "../src/pages/auth-page.js";
import { renderCreateProjectPage } from "../src/pages/create-project-page.js";
import { renderProjectMenuPage } from "../src/pages/project-menu-page.js";
import { renderProjectPlayerPage } from "../src/pages/project-player-page.js";
import { tester } from "./test-runner/tester.js";

tester.describe("page templates", () => {
  tester.it("renders login and registration forms", () => {
    const html = renderAuthPage();

    tester.expect(html.includes("Log in")).toBe(true);
    tester.expect(html.includes('id="login-form"')).toBe(true);
    tester.expect(html.includes('id="register-form"')).toBe(true);
    tester.expect(html.includes('id="auth-status"')).toBe(true);
    tester.expect(html.includes('minlength="15"')).toBe(true);
  });

  tester.it("renders the current user and logout control on the Project Menu", () => {
    const html = renderProjectMenuPage({
      id: "user-1",
      email: "musician@example.com",
      displayName: "Musician",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    tester.expect(html.includes("Signed in as")).toBe(true);
    tester.expect(html.includes("Musician")).toBe(true);
    tester.expect(html.includes("musician@example.com")).toBe(true);
    tester.expect(html.includes('id="logout-button"')).toBe(true);
  });

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
    tester.expect(html.includes("open-add-tracks-modal-button")).toBe(false);
    tester.expect(html.includes("add-audio-tracks-button")).toBe(true);
    tester.expect(html.includes("pending-audio-files")).toBe(true);
    tester.expect(html.includes("tracks-to-include-section")).toBe(true);
    tester.expect(html.includes("pending-track-list")).toBe(true);
    tester.expect(html.includes("Create a New Project")).toBe(true);

    tester.expect(html.includes("add-audio-tracks-modal")).toBe(false);
    tester.expect(html.includes("pending-track-form")).toBe(false);
    tester.expect(html.includes("selected-audio-track-rows")).toBe(false);

    tester.expect(html.includes('id="pending-track-name"')).toBe(false);
    tester.expect(html.includes('id="pending-audio-file"')).toBe(false);
    tester.expect(html.includes("Add track")).toBe(false);

    tester.expect(html.includes("create-project-confirmation-modal")).toBe(true);
    tester.expect(html.includes("create-project-confirmation-project-title")).toBe(true);
    tester.expect(html.includes("create-project-confirmation-project-description")).toBe(true);
    tester.expect(html.includes("create-project-confirmation-track-list")).toBe(true);
    tester.expect(html.includes("edit-create-project-button")).toBe(true);
    tester.expect(html.includes("submit-create-project-button")).toBe(true);
  });

  tester.it("renders saved project draft values on the Create Project page", () => {
    const html = renderCreateProjectPage({
      title: "Bass Groove",
      description: "Practice loop",
    });

    tester.expect(html.includes('value="Bass Groove"')).toBe(true);
    tester.expect(html.includes(">Practice loop</textarea>")).toBe(true);
  });

  tester.it("escapes saved project draft values on the Create Project page", () => {
    const html = renderCreateProjectPage({
      title: '<Bass "Groove">',
      description: "<Practice & loop>",
    });

    tester.expect(html.includes("&lt;Bass &quot;Groove&quot;&gt;")).toBe(true);
    tester.expect(html.includes("&lt;Practice &amp; loop&gt;")).toBe(true);
    tester.expect(html.includes('<Bass "Groove">')).toBe(false);
    tester.expect(html.includes("<Practice & loop>")).toBe(false);
  });

  tester.it("renders the Project Player page", () => {
    const html = renderProjectPlayerPage();

    tester.expect(html.includes("Project Player")).toBe(true);
    tester.expect(html.includes("Audio Player")).toBe(true);
    tester.expect(html.includes("player-area")).toBe(true);
    tester.expect(html.includes("player-track-list")).toBe(true);
    tester.expect(html.includes('id="player-logout-button"')).toBe(true);
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
    tester.expect(html.includes("data-project-title-editor")).toBe(true);
    tester.expect(html.includes("data-project-description-editor")).toBe(true);
    tester.expect(html.includes('contenteditable="true"')).toBe(true);
    tester.expect(html.includes("project-player-editable__icon")).toBe(false);
    tester.expect(html.includes("✎")).toBe(false);
    tester.expect(html.includes("Audio Player")).toBe(true);
    tester.expect(html.includes("player-area")).toBe(true);
    tester.expect(html.includes("player-track-list")).toBe(true);
    tester.expect(html.includes("player-track-upload-form")).toBe(false);
  });
});