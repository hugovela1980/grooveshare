import {
    deleteTrack,
    updateTrackName,
} from "../src/api/tracks-api.js";
import type { Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

type FetchCall = {
    input: Parameters<typeof fetch>[0];
    init: Parameters<typeof fetch>[1];
};

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

function createJsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

tester.describe("tracks API", () => {
    tester.it("deletes a track by project ID and track ID", async () => {
        const originalFetch = globalThis.fetch;
        const fetchCalls: FetchCall[] = [];
        const deletedTrack = createTrack();

        globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
            const [input, init] = args;

            fetchCalls.push({
                input,
                init,
            });

            return createJsonResponse({
                ok: true,
                data: deletedTrack,
            });
        }) as typeof fetch;

        try {
            const result = await deleteTrack("project-1", "track-1");

            tester.expect(result).toEqual(deletedTrack);
            tester.expect(fetchCalls.length).toBe(1);

            const firstCall = fetchCalls[0];

            if (!firstCall) {
                throw new Error("Expected fetch to be called.");
            }

            tester.expect(String(firstCall.input)).toBe(
                "http://localhost:3000/api/projects/project-1/tracks/track-1",
            );

            tester.expect(firstCall.init).toEqual({
                method: "DELETE",
                credentials: "include",
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    tester.it("throws the backend error message when deleting a track fails", async () => {
        const originalFetch = globalThis.fetch;

        globalThis.fetch = (async () => {
            return createJsonResponse(
                {
                    ok: false,
                    error: "Track not found.",
                },
                404,
            );
        }) as typeof fetch;

        try {
            let errorMessage = "";

            try {
                await deleteTrack("project-1", "missing-track");
            } catch (error) {
                errorMessage = error instanceof Error ? error.message : String(error);
            }

            tester.expect(errorMessage).toBe("Track not found.");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
    tester.it("updates a track name", async () => {
        const originalFetch = globalThis.fetch;
        const fetchCalls: FetchCall[] = [];
        const updatedTrack = createTrack({
            name: "Lead Guitar",
        });

        globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
            const [input, init] = args;

            fetchCalls.push({
                input,
                init,
            });

            return createJsonResponse({
                ok: true,
                data: updatedTrack,
            });
        }) as typeof fetch;

        try {
            const result = await updateTrackName(
                "project-1",
                "track-1",
                "Lead Guitar",
            );

            tester.expect(result).toEqual(updatedTrack);
            tester.expect(fetchCalls.length).toBe(1);

            const firstCall = fetchCalls[0];

            if (!firstCall) {
                throw new Error("Expected fetch to be called.");
            }

            tester.expect(String(firstCall.input)).toBe(
                "http://localhost:3000/api/projects/project-1/tracks/track-1",
            );

            tester.expect(firstCall.init).toEqual({
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: "Lead Guitar",
                }),
                credentials: "include",
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    tester.it("throws the backend error when updating a track name fails", async () => {
        const originalFetch = globalThis.fetch;

        globalThis.fetch = (async () => {
            return createJsonResponse(
                {
                    ok: false,
                    error: "Track not found.",
                },
                404,
            );
        }) as typeof fetch;

        try {
            let errorMessage = "";

            try {
                await updateTrackName(
                    "project-1",
                    "missing-track",
                    "Lead Guitar",
                );
            } catch (error) {
                errorMessage =
                    error instanceof Error
                        ? error.message
                        : String(error);
            }

            tester.expect(errorMessage).toBe("Track not found.");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

});