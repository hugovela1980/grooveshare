import { createProjectPlayerPageController } from "../src/page-controllers/project-player-page-controller.js";
import type { Project, Track, UploadTrackInput } from "../src/types.js";
import {
    createFakeForm,
    createFakeInput,
    createFakeTextElement,
} from "./helpers/fake-dom.js";
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

function createTrack(): Track {
    return {
        id: "track-1",
        projectId: "project-1",
        name: "Guitar",
        originalFilename: "guitar.wav",
        filePath: "server/uploads/projects/project-1/guitar.wav",
        mimeType: "audio/wav",
        fileSize: 123,
        createdAt: "2026-01-01T00:00:00.000Z",
    };
}

function createFakeFile(name = "guitar.wav"): File {
    return {
        name,
        type: "audio/wav",
        size: 123,
    } as File;
}

function createFakeFileInput(file: File | null) {
    const files = file
        ? ({
            0: file,
            length: 1,

            item(index: number) {
                return index === 0 ? file : null;
            },

            [Symbol.iterator]() {
                return [file][Symbol.iterator]();
            },
        } as FileList)
        : null;

    return {
        files,
    };
}

tester.describe("project player page controller", () => {
    tester.it("loads tracks for the selected project on init", async () => {
        const form = createFakeForm();
        const trackNameInput = createFakeInput("");
        const audioFileInput = createFakeFileInput(null);
        const statusElement = createFakeTextElement();
        const trackListElement = {
            innerHTML: "",
        };

        const controller = createProjectPlayerPageController({
            project: createProject(),
            form,
            trackNameInput,
            audioFileInput,
            statusElement,
            trackListElement,
            tracksApi: {
                async getTracksByProjectId(projectId) {
                    tester.expect(projectId).toBe("project-1");
                    return [createTrack()];
                },
                async uploadTrack(input) {
                    return {
                        ...createTrack(),
                        name: input.trackName,
                    };
                },
            },
            renderTrackList(tracks) {
                return tracks.map((track) => track.name).join(", ");
            },
        });

        await controller.init();

        tester.expect(trackListElement.innerHTML).toBe("Guitar");
    });

    tester.it("uploads a track to the selected project", async () => {
        const form = createFakeForm();
        const trackNameInput = createFakeInput("  Lead Guitar  ");
        const audioFile = createFakeFile();
        const audioFileInput = createFakeFileInput(audioFile);
        const statusElement = createFakeTextElement();
        const trackListElement = {
            innerHTML: "",
        };

        const uploadInputs: UploadTrackInput[] = [];

        const controller = createProjectPlayerPageController({
            project: createProject(),
            form,
            trackNameInput,
            audioFileInput,
            statusElement,
            trackListElement,
            tracksApi: {
                async getTracksByProjectId() {
                    return [createTrack()];
                },
                async uploadTrack(input) {
                    uploadInputs.push(input);
                    return createTrack();
                },
            },
            renderTrackList(tracks) {
                return tracks.map((track) => track.name).join(", ");
            },
        });

        await controller.init();
        await form.submit();

        tester.expect(uploadInputs.length).toBe(1);
        tester.expect(uploadInputs[0].projectId).toBe("project-1");
        tester.expect(uploadInputs[0].trackName).toBe("Lead Guitar");
        tester.expect(uploadInputs[0].audioFile).toBe(audioFile);
        tester.expect(form.getResetCallCount()).toBe(1);
        tester.expect(statusElement.textContent).toBe("Track uploaded.");
        tester.expect(trackListElement.innerHTML).toBe("Guitar");
    });

    tester.it("does not upload without an audio file", async () => {
        const form = createFakeForm();
        const trackNameInput = createFakeInput("Guitar");
        const audioFileInput = createFakeFileInput(null);
        const statusElement = createFakeTextElement();
        const trackListElement = {
            innerHTML: "",
        };

        let uploadCallCount = 0;

        const controller = createProjectPlayerPageController({
            project: createProject(),
            form,
            trackNameInput,
            audioFileInput,
            statusElement,
            trackListElement,
            tracksApi: {
                async getTracksByProjectId() {
                    return [];
                },
                async uploadTrack() {
                    uploadCallCount += 1;
                    return createTrack();
                },
            },
            renderTrackList(tracks) {
                return tracks.map((track) => track.name).join(", ");
            },
        });

        await controller.init();
        await form.submit();

        tester.expect(uploadCallCount).toBe(0);
        tester.expect(form.getResetCallCount()).toBe(0);
        tester.expect(statusElement.textContent).toBe(
            "Choose an audio file to upload.",
        );
    });

    tester.it("shows an upload error message when upload fails", async () => {
        const form = createFakeForm();
        const trackNameInput = createFakeInput("Guitar");
        const audioFileInput = createFakeFileInput(createFakeFile());
        const statusElement = createFakeTextElement();
        const trackListElement = {
            innerHTML: "",
        };

        const controller = createProjectPlayerPageController({
            project: createProject(),
            form,
            trackNameInput,
            audioFileInput,
            statusElement,
            trackListElement,
            tracksApi: {
                async getTracksByProjectId() {
                    return [];
                },
                async uploadTrack() {
                    throw new Error("Upload failed.");
                },
            },
            renderTrackList(tracks) {
                return tracks.map((track) => track.name).join(", ");
            },
        });

        await controller.init();
        await form.submit();

        tester.expect(form.getResetCallCount()).toBe(0);
        tester.expect(statusElement.textContent).toBe("Could not upload track.");
    });
});