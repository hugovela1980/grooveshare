import type { CreateProjectInput } from "../src/types.js";
import { createCreateProjectPageController } from "../src/page-controllers/create-project-page-controller.js";
import {
    createFakeForm,
    createFakeInput,
    createFakeTextElement,
} from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

tester.describe("create project page controller", () => {
    tester.it("creates a project draft from form values", async () => {
        const form = createFakeForm();
        const titleInput = createFakeInput("  New Jam  ");
        const descriptionInput = createFakeInput("  Rough demo idea  ");
        const statusElement = createFakeTextElement();

        let projectDraft: CreateProjectInput | null = null;

        const controller = createCreateProjectPageController({
            form,
            titleInput,
            descriptionInput,
            statusElement,
            onProjectDraftReady(input) {
                projectDraft = input;
            },
        });

        controller.init();

        await form.submit();

        tester.expect(projectDraft).toEqual({
            title: "New Jam",
            description: "Rough demo idea",
        });
    });

    tester.it("does not continue without a title", async () => {
        const form = createFakeForm();
        const titleInput = createFakeInput("   ");
        const descriptionInput = createFakeInput("No title yet");
        const statusElement = createFakeTextElement();

        let draftReadyCallCount = 0;

        const controller = createCreateProjectPageController({
            form,
            titleInput,
            descriptionInput,
            statusElement,
            onProjectDraftReady() {
                draftReadyCallCount += 1;
            },
        });

        controller.init();

        await form.submit();

        tester.expect(draftReadyCallCount).toBe(0);
        tester.expect(statusElement.textContent).toBe("Project title is required.");
    });
});