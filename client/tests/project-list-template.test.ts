import { renderProjectList } from "../src/templates/project-list.js";
import type { Project } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

function createProject(): Project {
    return {
        id: "project-1",
        title: "Bass Groove",
        description: "Practice loop",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}

tester.describe("project list template", () => {
    tester.it("renders an empty state when there are no projects", () => {
        const html = renderProjectList([]);

        tester.expect(html.includes("No projects yet.")).toBe(true);
    });

    tester.it("renders project buttons with project ids", () => {
        const html = renderProjectList([createProject()]);

        tester.expect(html.includes("Bass Groove")).toBe(true);
        tester.expect(html.includes("Practice loop")).toBe(true);
        tester.expect(html.includes('data-project-id="project-1"')).toBe(true);
        tester.expect(html.includes('class="project-card"')).toBe(true);
        tester.expect(html.includes("project-list__open-button")).toBe(true);
        tester.expect(html.includes(">Open<")).toBe(true);
        tester.expect(html.includes("Delete")).toBe(false);
        tester.expect(html.includes("data-project-delete-button")).toBe(false);
    });
});