import { renderTrackList } from "../src/templates/track-list.js";
import { tester } from "./test-runner/tester.js";

tester.describe("track list template", () => {
    tester.it("renders an empty state when there are no tracks", () => {
        const html = renderTrackList([]);

        tester.expect(html.includes("No tracks yet.")).toBe(true);
    });

    tester.it("renders load and delete buttons for each track", () => {
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

        tester.expect(html.includes("Guitar")).toBe(true);
        tester.expect(html.includes("guitar.wav")).toBe(true);

        tester.expect(html.includes("Load")).toBe(true);
        tester.expect(html.includes("data-track-load-button")).toBe(true);

        tester.expect(html.includes("Delete")).toBe(true);
        tester.expect(html.includes("data-track-delete-button")).toBe(true);

        tester.expect(html.includes('data-track-id="track-1"')).toBe(true);
    });
});