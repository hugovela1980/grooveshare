import { createConfirmProjectPageController } from "../src/page-controllers/confirm-project-page-controller.js";
import { createProjectDraftState } from "../src/project-draft/project-draft-state.js";
import type { Project, Track } from "../src/types.js";
import { createFakeButton } from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

function createFakeFile(name = "guitar.wav"): File {
    return {
        name,
        type: "audio/wav",
        size: 123,
    } as unknown as File;
}

function createProject(): Project {
    return {
        id: "project-1",
        title: "Bass Groove",
        description: "Practice loop",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}

function createTrack(): Track {
    return {
        id: "track-1",
        projectId: "project-1",
        name: "Lead Guitar",
        originalFilename: "guitar.wav",
        filePath: "server/uploads/projects/project-1/guitar.wav",
        mimeType: "audio/wav",
        fileSize: 123,
        createdAt: "2026-01-01T00:00:00.000Z",
    };
}

tester.describe("confirm project page controller", () => {
    tester.it("creates the project and uploads multiple pending tracks", async () => {
        const submitButton = createFakeButton();
        const statusElement = {
            textContent: "",
        };

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

        let createdProjectInput = null as null | {
            title: string;
            description: string;
        };

        const uploadedTracks: Array<{
            projectId: string;
            trackName: string;
            audioFile: File;
        }> = [];

        let submittedProjectTitle = "";

        const controller = createConfirmProjectPageController({
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
    });

    tester.it("shows an error when there is no project draft", async () => {
        const submitButton = createFakeButton();
        const statusElement = {
            textContent: "",
        };

        const projectDraftState = createProjectDraftState();

        const controller = createConfirmProjectPageController({
            submitButton,
            statusElement,
            projectDraftState,
            projectsApi: {
                async createProject() {
                    throw new Error("Should not be called.");
                },
            },
            tracksApi: {
                async uploadTrack() {
                    throw new Error("Should not be called.");
                },
            },
            onProjectSubmitted() {
                throw new Error("Should not be called.");
            },
        });

        controller.init();

        await submitButton.click();

        tester.expect(statusElement.textContent).toBe("Project draft is missing.");
    });

    tester.it("creates a project when there are no pending tracks", async () => {
        const submitButton = createFakeButton();
        const statusElement = {
            textContent: "",
        };

        const projectDraftState = createProjectDraftState();

        projectDraftState.setProjectDraft({
            title: "Bass Groove",
            description: "Practice loop",
        });

        let createdProjectInput = null as null | {
            title: string;
            description: string;
        };

        let uploadTrackCallCount = 0;
        let submittedProjectTitle = "";

        const controller = createConfirmProjectPageController({
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
                async uploadTrack() {
                    uploadTrackCallCount += 1;
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

        tester.expect(uploadTrackCallCount).toBe(0);
        tester.expect(statusElement.textContent).toBe("Project created.");
        tester.expect(projectDraftState.getProjectDraft()).toBe(null);
        tester.expect(projectDraftState.getPendingTracks()).toEqual([]);
        tester.expect(submittedProjectTitle).toBe("Bass Groove");
    });
});