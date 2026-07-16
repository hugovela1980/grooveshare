import { createProjectMenuPageController } from "../src/page-controllers/project-menu-page-controller.js";
import type { Project } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

function createProject({
    id,
    title,
    createdAt,
}: {
    id: string;
    title: string;
    createdAt: string;
}): Project {
    return {
        id,
        title,
        description: "",
        createdAt,
        updatedAt: createdAt,
    };
}

tester.describe("project menu page controller", () => {
    tester.it("loads and renders projects", async () => {
        const projectListElement = {
            innerHTML: "",
        };

        const controller = createProjectMenuPageController({
            projectListElement,
            projectsApi: {
                async getProjects() {
                    return [
                        createProject({
                            id: "project-1",
                            title: "First Project",
                            createdAt: "2026-01-01T00:00:00.000Z",
                        }),
                    ];
                },
            },
            renderProjectList(projects) {
                return projects.map((project) => project.title).join(", ");
            },
        });

        await controller.init();

        tester.expect(projectListElement.innerHTML).toBe("First Project");
    });

    tester.it("renders newest projects first", async () => {
        const projectListElement = {
            innerHTML: "",
        };

        const renderedProjectTitles: string[] = [];

        const controller = createProjectMenuPageController({
            projectListElement,
            projectsApi: {
                async getProjects() {
                    return [
                        createProject({
                            id: "old-project",
                            title: "Old Project",
                            createdAt: "2026-01-01T00:00:00.000Z",
                        }),
                        createProject({
                            id: "new-project",
                            title: "New Project",
                            createdAt: "2026-02-01T00:00:00.000Z",
                        }),
                    ];
                },
            },
            renderProjectList(projects) {
                renderedProjectTitles.push(...projects.map((project) => project.title));
                return projects.map((project) => project.title).join(", ");
            },
        });

        await controller.init();

        tester.expect(renderedProjectTitles).toEqual([
            "New Project",
            "Old Project",
        ]);
        tester.expect(projectListElement.innerHTML).toBe(
            "New Project, Old Project",
        );
    });

    tester.it("shows an error message when projects cannot load", async () => {
        const projectListElement = {
            innerHTML: "",
        };

        const controller = createProjectMenuPageController({
            projectListElement,
            projectsApi: {
                async getProjects() {
                    throw new Error("API failed.");
                },
            },
            renderProjectList(projects) {
                return projects.map((project) => project.title).join(", ");
            },
        });

        await controller.init();

        tester.expect(projectListElement.innerHTML).toBe(
            '<p class="empty-state">Could not load projects.</p>',
        );
    });
});