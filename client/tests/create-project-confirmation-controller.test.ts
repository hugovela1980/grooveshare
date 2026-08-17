import { createCreateProjectConfirmationController } from "../src/page-controllers/create-project-confirmation-controller.js";
import { createProjectDraftState } from "../src/project-draft/project-draft-state.js";
import type { CreateProjectInput, Project, Track } from "../src/types.js";
import { createFakeTextElement } from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

function createFakeFile(name = "guitar.wav"): File {
    return {
        name,
        type: "audio/wav",
        size: 123,
    } as unknown as File;
}

function createProject(overrides: Partial<Project> = {}): Project {
    return {
        id: overrides.id ?? "project-1",
        title: overrides.title ?? "Bass Groove",
        description: overrides.description ?? "Practice loop",
        createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
        updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
    };
}

function createTrack(overrides: Partial<Track> = {}): Track {
    return {
        id: "track-1",
        projectId: "project-1",
        name: "Guitar",
        originalFilename: "guitar.wav",
        filePath: "server/uploads/projects/project-1/guitar.wav",
        mimeType: "audio/wav",
        fileSize: 123,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function createFakeButton() {
    let clickHandler: (() => void | Promise<void>) | null = null;
    const attributes = new Map<string, string>();

    return {
        disabled: false,
        setAttribute(name: string, value: string) {
            attributes.set(name, value);
        },
        removeAttribute(name: string) {
            attributes.delete(name);
        },
        getAttribute(name: string) {
            return attributes.get(name) ?? null;
        },

        addEventListener(
            eventName: "click",
            handler: () => void | Promise<void>,
        ) {
            if (eventName === "click") {
                clickHandler = handler;
            }
        },

        async click() {
            if (!clickHandler) {
                throw new Error("No click handler registered.");
            }

            await clickHandler();
        },
    };
}

tester.describe("create project confirmation controller", () => {
    tester.it("creates a project and uploads pending tracks", async () => {
        const submitButton = createFakeButton();
        const statusElement = createFakeTextElement();

        const projectDraftState = createProjectDraftState({
            createId: (() => {
                let nextId = 1;

                return () => `pending-track-${nextId++}`;
            })(),
        });

        projectDraftState.setProjectDraft({
            title: "Bass Groove",
            description: "Practice loop",
        });

        const guitarFile = createFakeFile("guitar.wav");
        const bassFile = createFakeFile("bass.wav");

        projectDraftState.addPendingTracks([
            {
                trackName: "Lead Guitar",
                audioFile: guitarFile,
            },
            {
                trackName: "Bass",
                audioFile: bassFile,
            },
        ]);

        let createdProjectInput: CreateProjectInput | null = null;

        const uploadedTracks: Array<{
            projectId: string;
            trackName: string;
            audioFile: File;
        }> = [];

        let submittedProjectTitle = "";

        const controller = createCreateProjectConfirmationController({
            submitButton,
            statusElement,
            projectDraftState,
            projectsApi: {
                async createProject(input) {
                    createdProjectInput = input;
                    return createProject();
                },
            },
            tracksApi: {
                async uploadTrack(input) {
                    uploadedTracks.push(input);
                    return createTrack();
                },
            },
            onProjectSubmitted(project) {
                submittedProjectTitle = project.title;
            },
        });

        controller.init();

        await submitButton.click();

        tester.expect(createdProjectInput).toEqual({
            title: "Bass Groove",
            description: "Practice loop",
        });

        tester.expect(uploadedTracks).toEqual([
            {
                projectId: "project-1",
                trackName: "Lead Guitar",
                audioFile: guitarFile,
            },
            {
                projectId: "project-1",
                trackName: "Bass",
                audioFile: bassFile,
            },
        ]);

        tester.expect(projectDraftState.getProjectDraft()).toBe(null);
        tester.expect(projectDraftState.getPendingTracks()).toEqual([]);
        tester.expect(submittedProjectTitle).toBe("Bass Groove");
        tester.expect(statusElement.textContent).toBe("Project created.");
        tester.expect(submitButton.disabled).toBe(false);
    });

    tester.it("shows a message when project details are missing", async () => {
        const submitButton = createFakeButton();
        const statusElement = createFakeTextElement();
        const projectDraftState = createProjectDraftState();

        let createProjectCallCount = 0;

        const controller = createCreateProjectConfirmationController({
            submitButton,
            statusElement,
            projectDraftState,
            projectsApi: {
                async createProject(input) {
                    createProjectCallCount += 1;
                    return createProject(input);
                },
            },
            tracksApi: {
                async uploadTrack() {
                    return createTrack();
                },
            },
            onProjectSubmitted() {
                throw new Error("Project should not be submitted.");
            },
        });

        controller.init();

        await submitButton.click();

        tester.expect(statusElement.textContent).toBe(
            "Project details are missing.",
        );

        tester.expect(createProjectCallCount).toBe(0);
    });

    tester.it("shows an error message when project creation fails", async () => {
        const submitButton = createFakeButton();
        const statusElement = createFakeTextElement();

        const projectDraftState = createProjectDraftState();

        projectDraftState.setProjectDraft({
            title: "Bass Groove",
            description: "Practice loop",
        });

        const controller = createCreateProjectConfirmationController({
            submitButton,
            statusElement,
            projectDraftState,
            projectsApi: {
                async createProject() {
                    throw new Error("Create failed.");
                },
            },
            tracksApi: {
                async uploadTrack() {
                    return createTrack();
                },
            },
            onProjectSubmitted() {
                throw new Error("Project should not be submitted.");
            },
        });

        controller.init();

        await submitButton.click();

        tester.expect(statusElement.textContent).toBe("Could not create project.");
        tester.expect(submitButton.disabled).toBe(false);
    });
    tester.it("marks Submit busy while project creation is in flight", async () => {
        const submitButton = createFakeButton();
        const statusElement = createFakeTextElement();
        const projectDraftState = createProjectDraftState();
        projectDraftState.setProjectDraft({
            title: "Bass Groove",
            description: "Practice loop",
        });

        let resolveCreate!: (project: Project) => void;
        const createPromise = new Promise<Project>((resolve) => {
            resolveCreate = resolve;
        });

        const controller = createCreateProjectConfirmationController({
            submitButton,
            statusElement,
            projectDraftState,
            projectsApi: {
                async createProject() {
                    return createPromise;
                },
            },
            tracksApi: {
                async uploadTrack() {
                    return createTrack();
                },
            },
            onProjectSubmitted() {},
        });

        controller.init();
        const pendingClick = submitButton.click();

        tester.expect(submitButton.disabled).toBe(true);
        tester.expect(submitButton.getAttribute("data-busy")).toBe("true");
        tester.expect(statusElement.textContent).toBe("Creating project...");

        resolveCreate(createProject());
        await pendingClick;

        tester.expect(submitButton.disabled).toBe(false);
        tester.expect(submitButton.getAttribute("data-busy")).toBe(null);
    });

});