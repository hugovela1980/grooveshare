import type { CreateProjectInput, Project } from "../src/types.js";
import { createCreateProjectPageController } from "../src/page-controllers/create-project-page-controller.js";
import {
    createFakeForm,
    createFakeInput,
    createFakeTextElement,
} from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

function createProjectFromInput(input: CreateProjectInput): Project {
    return {
        id: "project-1",
        title: input.title,
        description: input.description,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}

tester.describe("create project page controller", () => {
    tester.it("creates a project from form values", async () => {
        const form = createFakeForm();
        const titleInput = createFakeInput("  New Jam  ");
        const descriptionInput = createFakeInput("  Rough demo idea  ");
        const statusElement = createFakeTextElement();

        const createProjectInputs: CreateProjectInput[] = [];

        const controller = createCreateProjectPageController({
            form,
            titleInput,
            descriptionInput,
            statusElement,
            projectsApi: {
                async createProject(input) {
                    createProjectInputs.push(input);
                    return createProjectFromInput(input);
                },
            },
        });

        controller.init();

        await form.submit();

        tester.expect(createProjectInputs).toEqual([
            {
                title: "New Jam",
                description: "Rough demo idea",
            },
        ]);
        tester.expect(form.getResetCallCount()).toBe(1);
        tester.expect(statusElement.textContent).toBe("Project created.");
    });

    tester.it("does not create a project without a title", async () => {
        const form = createFakeForm();
        const titleInput = createFakeInput("   ");
        const descriptionInput = createFakeInput("No title yet");
        const statusElement = createFakeTextElement();

        let createProjectCallCount = 0;

        const controller = createCreateProjectPageController({
            form,
            titleInput,
            descriptionInput,
            statusElement,
            projectsApi: {
                async createProject(input) {
                    createProjectCallCount += 1;
                    return createProjectFromInput(input);
                },
            },
        });

        controller.init();

        await form.submit();

        tester.expect(createProjectCallCount).toBe(0);
        tester.expect(form.getResetCallCount()).toBe(0);
        tester.expect(statusElement.textContent).toBe("Project title is required.");
    });

    tester.it("calls onProjectCreated with the created project", async () => {
        const form = createFakeForm();
        const titleInput = createFakeInput("Bass Groove");
        const descriptionInput = createFakeInput("Practice loop");
        const statusElement = createFakeTextElement();

        let createdProjectTitle = "";

        const controller = createCreateProjectPageController({
            form,
            titleInput,
            descriptionInput,
            statusElement,
            projectsApi: {
                async createProject(input) {
                    return createProjectFromInput(input);
                },
            },
            onProjectCreated(project) {
                createdProjectTitle = project.title;
            },
        });

        controller.init();

        await form.submit();

        tester.expect(createdProjectTitle).toBe("Bass Groove");
    });

    tester.it("shows an error message when project creation fails", async () => {
        const form = createFakeForm();
        const titleInput = createFakeInput("Broken Project");
        const descriptionInput = createFakeInput("This will fail");
        const statusElement = createFakeTextElement();

        const controller = createCreateProjectPageController({
            form,
            titleInput,
            descriptionInput,
            statusElement,
            projectsApi: {
                async createProject() {
                    throw new Error("API failed.");
                },
            },
        });

        controller.init();

        await form.submit();

        tester.expect(form.getResetCallCount()).toBe(0);
        tester.expect(statusElement.textContent).toBe("Could not create project.");
    });
});