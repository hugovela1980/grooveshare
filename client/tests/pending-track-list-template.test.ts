import type { PendingTrackDraft as CorePendingTrackDraft } from "@hugovela/frontend-core";

type PendingTrackDraft = CorePendingTrackDraft<File>;
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

        tester.expect(html.includes("Track name")).toBe(true);
        tester.expect(html.includes('value="Lead Guitar"')).toBe(true);
        tester.expect(html.includes("data-pending-track-name")).toBe(true);
        tester.expect(html.includes("File")).toBe(true);
        tester.expect(html.includes("Remove")).toBe(true);
    });
});