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

type FakeClickEvent = {
  target: EventTarget | null;
};

function createFakeClosestElement(projectId: string) {
  return {
    dataset: {
      projectId,
    },

    getAttribute(name: string) {
      if (name !== "data-project-id") {
        return null;
      }

      return projectId;
    },
  };
}

function createClickableProjectListElement() {
  let clickHandler: ((event: FakeClickEvent) => void | Promise<void>) | null =
    null;

  return {
    innerHTML: "",

    addEventListener(
      eventName: "click",
      handler: (event: FakeClickEvent) => void | Promise<void>,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },

    async clickProject(projectId: string): Promise<void> {
      if (!clickHandler) {
        throw new Error("No click handler was registered.");
      }

      await clickHandler({
        target: {
          closest(selector: string) {
            if (selector !== "[data-project-id]") {
              return null;
            }

            return createFakeClosestElement(projectId);
          },
        } as unknown as EventTarget,
      });
    },

    async clickDeleteProject(projectId: string): Promise<void> {
      if (!clickHandler) {
        throw new Error("No click handler was registered.");
      }

      await clickHandler({
        target: {
          closest(selector: string) {
            if (
              selector !== "[data-project-delete-button]" &&
              selector !== "[data-project-id]"
            ) {
              return null;
            }

            return createFakeClosestElement(projectId);
          },
        } as unknown as EventTarget,
      });
    },
  };
}

function createFakeStatusElement() {
  return {
    textContent: "",
  };
}

function createNoopDeleteProject() {
  return async function deleteProject(projectId: string): Promise<Project> {
    return createProject({
      id: projectId,
      title: "Deleted Project",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  };
}

tester.describe("project menu page controller", () => {
  tester.it("loads and renders projects", async () => {
    const projectListElement = createClickableProjectListElement();

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

        deleteProject: createNoopDeleteProject(),
      },
      renderProjectList(projects) {
        return projects.map((project) => project.title).join(", ");
      },
      onProjectSelected() {
        throw new Error("Project should not be selected in this test.");
      },
    });

    await controller.init();

    tester.expect(projectListElement.innerHTML).toBe("First Project");
  });

  tester.it("renders newest projects first", async () => {
    const projectListElement = createClickableProjectListElement();

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

        deleteProject: createNoopDeleteProject(),
      },
      renderProjectList(projects) {
        renderedProjectTitles.push(...projects.map((project) => project.title));
        return projects.map((project) => project.title).join(", ");
      },
      onProjectSelected() {
        throw new Error("Project should not be selected in this test.");
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
    const projectListElement = createClickableProjectListElement();

    const controller = createProjectMenuPageController({
      projectListElement,
      projectsApi: {
        async getProjects() {
          throw new Error("API failed.");
        },

        deleteProject: createNoopDeleteProject(),
      },
      renderProjectList(projects) {
        return projects.map((project) => project.title).join(", ");
      },
      onProjectSelected() {
        throw new Error("Project should not be selected in this test.");
      },
    });

    await controller.init();

    tester.expect(projectListElement.innerHTML).toBe(
      '<p class="empty-state">Could not load projects.</p>',
    );
  });

  tester.it("calls onProjectSelected when a rendered project is clicked", async () => {
    const projectListElement = createClickableProjectListElement();

    let selectedProjectTitle = "";

    const controller = createProjectMenuPageController({
      projectListElement,
      projectsApi: {
        async getProjects() {
          return [
            createProject({
              id: "project-1",
              title: "Bass Groove",
              createdAt: "2026-01-01T00:00:00.000Z",
            }),
          ];
        },

        deleteProject: createNoopDeleteProject(),
      },
      renderProjectList(projects) {
        return projects.map((project) => project.title).join(", ");
      },
      onProjectSelected(project) {
        selectedProjectTitle = project.title;
      },
    });

    await controller.init();

    await projectListElement.clickProject("project-1");

    tester.expect(selectedProjectTitle).toBe("Bass Groove");
  });

  tester.it("deletes a project and reloads the project list", async () => {
    const projectListElement = createClickableProjectListElement();
    const statusElement = createFakeStatusElement();

    let getProjectsCallCount = 0;
    let deletedProjectId = "";
    let selectedProjectTitle = "";

    const controller = createProjectMenuPageController({
      projectListElement,
      statusElement,
      projectsApi: {
        async getProjects() {
          getProjectsCallCount += 1;

          if (getProjectsCallCount === 1) {
            return [
              createProject({
                id: "project-1",
                title: "Delete Me",
                createdAt: "2026-01-01T00:00:00.000Z",
              }),
            ];
          }

          return [];
        },

        async deleteProject(projectId) {
          deletedProjectId = projectId;

          return createProject({
            id: projectId,
            title: "Delete Me",
            createdAt: "2026-01-01T00:00:00.000Z",
          });
        },
      },
      renderProjectList(projects) {
        if (projects.length === 0) {
          return '<p class="empty-state">No projects yet.</p>';
        }

        return projects.map((project) => project.title).join(", ");
      },
      onProjectSelected(project) {
        selectedProjectTitle = project.title;
      },
      confirmDelete() {
        return true;
      },
    });

    await controller.init();

    tester.expect(projectListElement.innerHTML).toBe("Delete Me");

    await projectListElement.clickDeleteProject("project-1");

    tester.expect(deletedProjectId).toBe("project-1");
    tester.expect(getProjectsCallCount).toBe(2);
    tester.expect(projectListElement.innerHTML).toBe(
      '<p class="empty-state">No projects yet.</p>',
    );
    tester.expect(statusElement.textContent).toBe("Project deleted.");
    tester.expect(selectedProjectTitle).toBe("");
  });

  tester.it("does not delete a project when deletion is cancelled", async () => {
    const projectListElement = createClickableProjectListElement();
    const statusElement = createFakeStatusElement();

    let deleteCallCount = 0;

    const controller = createProjectMenuPageController({
      projectListElement,
      statusElement,
      projectsApi: {
        async getProjects() {
          return [
            createProject({
              id: "project-1",
              title: "Keep Me",
              createdAt: "2026-01-01T00:00:00.000Z",
            }),
          ];
        },

        async deleteProject(projectId) {
          deleteCallCount += 1;

          return createProject({
            id: projectId,
            title: "Keep Me",
            createdAt: "2026-01-01T00:00:00.000Z",
          });
        },
      },
      renderProjectList(projects) {
        return projects.map((project) => project.title).join(", ");
      },
      onProjectSelected() {
        throw new Error("Project should not be selected.");
      },
      confirmDelete() {
        return false;
      },
    });

    await controller.init();

    await projectListElement.clickDeleteProject("project-1");

    tester.expect(deleteCallCount).toBe(0);
    tester.expect(projectListElement.innerHTML).toBe("Keep Me");
    tester.expect(statusElement.textContent).toBe("");
  });
});