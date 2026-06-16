import { renderConfirmProjectPage } from "../src/pages/confirm-project-page.js";
import { renderCreateProjectPage } from "../src/pages/create-project-page.js";
import { renderProjectMenuPage } from "../src/pages/project-menu-page.js";
import { renderProjectPlayerPage } from "../src/pages/project-player-page.js";
import { tester } from "./test-runner/tester.js";

tester.describe("page templates", () => {
  tester.it("renders the Project Menu page", () => {
    const html = renderProjectMenuPage();

    tester.expect(html.includes("Project Menu")).toBe(true);
    tester.expect(html.includes("Add Project")).toBe(true);
    tester.expect(html.includes("project-list")).toBe(true);
  });

  tester.it("renders the Create Project page", () => {
    const html = renderCreateProjectPage();

    tester.expect(html.includes("Create Project")).toBe(true);
    tester.expect(html.includes("project-form")).toBe(true);
    tester.expect(html.includes("project-title")).toBe(true);
    tester.expect(html.includes("track-upload-form")).toBe(true);
  });

  tester.it("renders the Confirm Project page", () => {
    const html = renderConfirmProjectPage();

    tester.expect(html.includes("Confirm Project")).toBe(true);
    tester.expect(html.includes("confirm-project")).toBe(true);
  });

  tester.it("renders the Project Player page", () => {
    const html = renderProjectPlayerPage();

    tester.expect(html.includes("Project Player")).toBe(true);
    tester.expect(html.includes("player-track-list")).toBe(true);
    tester.expect(html.includes("player-area")).toBe(true);
  });
});