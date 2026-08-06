import { renderTwoChannelMixSlots } from "../src/templates/mix-channel-slots.js";
import type { Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

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

tester.describe("mix channel slots template", () => {
    tester.it("renders two empty channel slots when there are no tracks", () => {
        const html = renderTwoChannelMixSlots([]);

        tester.expect(html.includes("Channel 1")).toBe(true);
        tester.expect(html.includes("Channel 2")).toBe(true);
        tester.expect(html.includes("Empty slot")).toBe(true);
        tester.expect(html.includes("No track assigned.")).toBe(true);
        tester.expect(html.includes("Waveform placeholder")).toBe(true);
    });

    tester.it("renders the first uploaded track as Channel 1", () => {
        const html = renderTwoChannelMixSlots([
            createTrack({
                id: "track-1",
                name: "Guitar",
                originalFilename: "guitar.wav",
            }),
        ]);

        tester.expect(html.includes("Channel 1")).toBe(true);
        tester.expect(html.includes("Guitar")).toBe(true);
        tester.expect(html.includes('data-track-id="track-1"')).toBe(true);
        tester.expect(html.includes("Channel 2")).toBe(true);
        tester.expect(html.includes("Empty slot")).toBe(true);
    });

    tester.it("renders the first two uploaded tracks as Channel 1 and Channel 2", () => {
        const html = renderTwoChannelMixSlots([
            createTrack({
                id: "track-1",
                name: "Drums",
                originalFilename: "drums.wav",
            }),
            createTrack({
                id: "track-2",
                name: "Bass",
                originalFilename: "bass.wav",
            }),
        ]);

        tester.expect(html.includes("Channel 1")).toBe(true);
        tester.expect(html.includes("Drums")).toBe(true);
        tester.expect(html.includes('data-track-id="track-1"')).toBe(true);

        tester.expect(html.includes("Channel 2")).toBe(true);
        tester.expect(html.includes("Bass")).toBe(true);
        tester.expect(html.includes('data-track-id="track-2"')).toBe(true);
    });

    tester.it("renders enabled, volume, waveform, and delete controls for assigned tracks", () => {
        const html = renderTwoChannelMixSlots([createTrack()]);

        tester.expect(html.includes("data-channel-enabled")).toBe(true);
        tester.expect(html.includes("data-channel-volume")).toBe(true);
        tester.expect(html.includes("Waveform placeholder")).toBe(true);
        tester.expect(html.includes("data-track-delete-button")).toBe(true);
        tester.expect(html.includes("Delete")).toBe(true);
    });
});