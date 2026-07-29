import type { PendingTrackDraft } from "../src/project-draft/project-draft-state.js";
import { renderTrackList } from "../src/templates/track-list.js";
import { renderPendingTrackList } from "../src/templates/pending-track-list.js";
import { tester } from "./test-runner/tester.js";

function createPendingTrack(): PendingTrackDraft {
    return {
        id: "pending-track-1",
        trackName: "Lead Guitar",
        audioFile: {
            name: "guitar.wav",
            type: "audio/wav",
            size: 123,
        } as unknown as File,
        originalFilename: "guitar.wav",
        mimeType: "audio/wav",
        fileSize: 123,
    };
}

tester.describe("pending track list template", () => {
    tester.it("renders an empty state when there are no pending tracks", () => {
        const html = renderPendingTrackList([]);

        tester.expect(html.includes("No tracks selected yet.")).toBe(true);
    });

    tester.it("renders pending track details", () => {
        const html = renderPendingTrackList([createPendingTrack()]);

        tester.expect(html.includes("Lead Guitar")).toBe(true);
        tester.expect(html.includes("guitar.wav")).toBe(true);
        tester.expect(html.includes('data-pending-track-id="pending-track-1"')).toBe(
            true,
        );
    });

    tester.it("renders a delete button for each track", () => {
        const html = renderTrackList([
            {
                id: "track-1",
                projectId: "project-1",
                name: "Guitar",
                originalFilename: "guitar.wav",
                filePath: "uploads/guitar.wav",
                mimeType: "audio/wav",
                fileSize: 100,
                createdAt: "2026-01-01T00:00:00.000Z",
            },
        ]);

        tester.expect(html.includes("Delete")).toBe(true);
        tester.expect(html.includes("data-track-delete-button")).toBe(true);
        tester.expect(html.includes('data-track-id="track-1"')).toBe(true);
    });
});