import { createProjectFormController } from "../src/controllers/project-controller.js";
import type { CreateProjectInput, Project } from "../src/types.js";
import {
  createFakeContainer,
  createFakeForm,
  createFakeInput,
  createFakeTextElement,
} from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    title: "Chorus Riff Idea",
    description: "Guitar riff with scratch drums",
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    ...overrides,
  };
}

tester.describe("project form controller", () => {
  tester.it("loads and renders projects on init", async () => {
    const form = createFakeForm();
    const titleInput = createFakeInput();
    const descriptionInput = createFakeInput();
    const projectListElement = createFakeContainer();
    const statusElement = createFakeTextElement();

    const projects = [
      createProject({
        id: "project-1",
        title: "Verse Groove",
      }),
    ];

    const controller = createProjectFormController({
      form,
      titleInput,
      descriptionInput,
      projectListElement,
      statusElement,
      projectsApi: {
        async getProjects() {
          return projects;
        },
        async createProject() {
          throw new Error("createProject should not be called during init.");
        },
      },
      renderProjectList(projectsToRender: Project[]) {
        return projectsToRender.map((project) => project.title).join(", ");
      },
    });

    await controller.init();

    tester.expect(projectListElement.innerHTML).toBe("Verse Groove");
    tester.expect(statusElement.textContent).toBe("");
  });

  tester.it("submits title and description to create a project", async () => {
    const form = createFakeForm();
    const titleInput = createFakeInput("Chorus Riff Idea");
    const descriptionInput = createFakeInput("Guitar riff with scratch drums");
    const projectListElement = createFakeContainer();
    const statusElement = createFakeTextElement();

    const createProjectCalls: CreateProjectInput[] = [];

    const controller = createProjectFormController({
      form,
      titleInput,
      descriptionInput,
      projectListElement,
      statusElement,
      projectsApi: {
        async getProjects() {
          return [];
        },
        async createProject(input: CreateProjectInput) {
          createProjectCalls.push(input);
          return createProject(input);
        },
      },
      renderProjectList() {
        return "";
      },
    });

    await controller.init();
    const submitEvent = await form.submit();

    tester.expect(submitEvent.defaultPrevented).toBe(true);
    tester.expect(createProjectCalls.length).toBe(1);
    tester.expect(createProjectCalls[0]).toEqual({
      title: "Chorus Riff Idea",
      description: "Guitar riff with scratch drums",
    });
  });

  tester.it("trims project title and description before submitting", async () => {
    const form = createFakeForm();
    const titleInput = createFakeInput("  Chorus Riff Idea  ");
    const descriptionInput = createFakeInput("  Guitar riff with scratch drums  ");
    const projectListElement = createFakeContainer();
    const statusElement = createFakeTextElement();

    const createProjectCalls: CreateProjectInput[] = [];

    const controller = createProjectFormController({
      form,
      titleInput,
      descriptionInput,
      projectListElement,
      statusElement,
      projectsApi: {
        async getProjects() {
          return [];
        },
        async createProject(input: CreateProjectInput) {
          createProjectCalls.push(input);
          return createProject(input);
        },
      },
      renderProjectList() {
        return "";
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(createProjectCalls[0]).toEqual({
      title: "Chorus Riff Idea",
      description: "Guitar riff with scratch drums",
    });
  });

  tester.it("does not create a project when title is empty", async () => {
    const form = createFakeForm();
    const titleInput = createFakeInput("   ");
    const descriptionInput = createFakeInput("Missing title test");
    const projectListElement = createFakeContainer();
    const statusElement = createFakeTextElement();

    let createProjectCallCount = 0;

    const controller = createProjectFormController({
      form,
      titleInput,
      descriptionInput,
      projectListElement,
      statusElement,
      projectsApi: {
        async getProjects() {
          return [];
        },
        async createProject() {
          createProjectCallCount += 1;
          return createProject();
        },
      },
      renderProjectList() {
        return "";
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(createProjectCallCount).toBe(0);
    tester.expect(statusElement.textContent).toBe("Project title is required.");
  });

  tester.it("reloads projects and resets form after successful submit", async () => {
    const form = createFakeForm();
    const titleInput = createFakeInput("Bridge Riff");
    const descriptionInput = createFakeInput("Bridge idea");
    const projectListElement = createFakeContainer();
    const statusElement = createFakeTextElement();

    let getProjectsCallCount = 0;

    const controller = createProjectFormController({
      form,
      titleInput,
      descriptionInput,
      projectListElement,
      statusElement,
      projectsApi: {
        async getProjects() {
          getProjectsCallCount += 1;

          if (getProjectsCallCount === 1) {
            return [];
          }

          return [
            createProject({
              id: "project-2",
              title: "Bridge Riff",
              description: "Bridge idea",
            }),
          ];
        },
        async createProject(input: CreateProjectInput) {
          return createProject(input);
        },
      },
      renderProjectList(projectsToRender: Project[]) {
        return projectsToRender.map((project) => project.title).join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(getProjectsCallCount).toBe(2);
    tester.expect(projectListElement.innerHTML).toBe("Bridge Riff");
    tester.expect(form.getResetCallCount()).toBe(1);
    tester.expect(statusElement.textContent).toBe("Project created.");
  });

    tester.it("shows an error message when loading projects fails", async () => {
    const form = createFakeForm();
    const titleInput = createFakeInput();
    const descriptionInput = createFakeInput();
    const projectListElement = createFakeContainer();
    const statusElement = createFakeTextElement();

    const controller = createProjectFormController({
      form,
      titleInput,
      descriptionInput,
      projectListElement,
      statusElement,
      projectsApi: {
        async getProjects() {
          throw new Error("Backend unavailable");
        },
        async createProject() {
          return createProject();
        },
      },
      renderProjectList(projectsToRender: Project[]) {
        return projectsToRender.map((project) => project.title).join(", ");
      },
    });

    await controller.init();

    tester.expect(projectListElement.innerHTML).toBe("");
    tester.expect(statusElement.textContent).toBe("Could not load projects.");
  });

  tester.it("shows an error message when project creation fails", async () => {
    const form = createFakeForm();
    const titleInput = createFakeInput("Chorus Riff Idea");
    const descriptionInput = createFakeInput("Guitar riff with scratch drums");
    const projectListElement = createFakeContainer();
    const statusElement = createFakeTextElement();

    const controller = createProjectFormController({
      form,
      titleInput,
      descriptionInput,
      projectListElement,
      statusElement,
      projectsApi: {
        async getProjects() {
          return [];
        },
        async createProject() {
          throw new Error("Failed to fetch");
        },
      },
      renderProjectList(projectsToRender: Project[]) {
        return projectsToRender.map((project) => project.title).join(", ");
      },
    });

    await controller.init();
    await form.submit();

    tester.expect(projectListElement.innerHTML).toBe("");
    tester.expect(form.getResetCallCount()).toBe(0);
    tester.expect(statusElement.textContent).toBe("Could not create project.");
  });
});