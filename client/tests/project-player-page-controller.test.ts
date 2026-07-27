import { createProjectPlayerPageController } from "../src/page-controllers/project-player-page-controller.js";
import type { Project, Track } from "../src/types.js";
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

tester.describe("project player page controller", () => {
    tester.it("loads tracks for the selected project on init", async () => {
        const trackListElement = {
            innerHTML: "",
        };

        const controller = createProjectPlayerPageController({
            project: createProject(),
            trackListElement,
            tracksApi: {
                async getTracksByProjectId(projectId) {
                    tester.expect(projectId).toBe("project-1");
                    return [createTrack()];
                },
            },
            renderTrackList(tracks) {
                return tracks.map((track) => track.name).join(", ");
            },
        });

        await controller.init();

        tester.expect(trackListElement.innerHTML).toBe("Guitar");
    });

    tester.it("shows an error message when tracks cannot load", async () => {
        const trackListElement = {
            innerHTML: "",
        };

        const controller = createProjectPlayerPageController({
            project: createProject(),
            trackListElement,
            tracksApi: {
                async getTracksByProjectId() {
                    throw new Error("API failed.");
                },
            },
            renderTrackList(tracks) {
                return tracks.map((track) => track.name).join(", ");
            },
        });

        await controller.init();

        tester.expect(trackListElement.innerHTML).toBe(
            '<p class="empty-state">Could not load tracks.</p>',
        );
    });
});