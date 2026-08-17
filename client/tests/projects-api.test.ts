import {
    deleteProject,
    getProject,
    saveMixSettings,
    updateProjectDetails,
} from "../src/api/projects-api.js";
import type {
    MixSettings,
    Project,
} from "../src/types.js";
import { tester } from "./test-runner/tester.js";

type FetchCall = {
    input: Parameters<typeof fetch>[0];
    init: Parameters<typeof fetch>[1];
};

function createProject(overrides: Partial<Project> = {}): Project {
    return {
        id: "project-1",
        title: "Test Project",
        description: "A project for testing",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
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

tester.describe("projects API", () => {
    tester.it("loads one project by project ID", async () => {
        const originalFetch = globalThis.fetch;
        const fetchCalls: FetchCall[] = [];
        const project = createProject();

        globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
            const [input, init] = args;

            fetchCalls.push({ input, init });

            return createJsonResponse({
                ok: true,
                data: project,
            });
        }) as typeof fetch;

        try {
            const result = await getProject("project-1");

            tester.expect(result).toEqual(project);
            tester.expect(fetchCalls.length).toBe(1);
            tester.expect(String(fetchCalls[0]?.input)).toBe(
                "http://localhost:3000/api/projects/project-1",
            );
            tester.expect(fetchCalls[0]?.init).toEqual({
                credentials: "include",
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    tester.it("deletes a project by project ID", async () => {
        const originalFetch = globalThis.fetch;
        const fetchCalls: FetchCall[] = [];
        const deletedProject = createProject();

        globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
            const [input, init] = args;

            fetchCalls.push({
                input,
                init,
            });

            return createJsonResponse({
                ok: true,
                data: deletedProject,
            });
        }) as typeof fetch;

        try {
            const result = await deleteProject("project-1");

            tester.expect(result).toEqual(deletedProject);
            tester.expect(fetchCalls.length).toBe(1);

            const firstCall = fetchCalls[0];

            if (!firstCall) {
                throw new Error("Expected fetch to be called.");
            }

            tester.expect(String(firstCall.input)).toBe(
                "http://localhost:3000/api/projects/project-1",
            );

            tester.expect(firstCall.init).toEqual({
                method: "DELETE",
                credentials: "include",
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    tester.it("throws the backend error message when deleting a project fails", async () => {
        const originalFetch = globalThis.fetch;

        globalThis.fetch = (async () => {
            return createJsonResponse(
                {
                    ok: false,
                    error: "Project not found.",
                },
                404,
            );
        }) as typeof fetch;

        try {
            let errorMessage = "";

            try {
                await deleteProject("missing-project");
            } catch (error) {
                errorMessage = error instanceof Error ? error.message : String(error);
            }

            tester.expect(errorMessage).toBe("Project not found.");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    tester.it("saves mix settings for a project", async () => {
        const originalFetch = globalThis.fetch;
        const fetchCalls: FetchCall[] = [];

        const mixSettings: MixSettings = {
            channels: [
                {
                    channelNumber: 1,
                    trackId: "track-1",
                    enabled: true,
                    volume: 0.75,
                },
                {
                    channelNumber: 2,
                    trackId: "track-2",
                    enabled: false,
                    volume: 0.4,
                },
            ],
        };

        const updatedProject = createProject({
            mixSettings,
        });

        globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
            const [input, init] = args;

            fetchCalls.push({
                input,
                init,
            });

            return createJsonResponse({
                ok: true,
                data: updatedProject,
            });
        }) as typeof fetch;

        try {
            const result = await saveMixSettings(
                "project-1",
                mixSettings,
            );

            tester.expect(result).toEqual(updatedProject);
            tester.expect(fetchCalls.length).toBe(1);

            const firstCall = fetchCalls[0];

            if (!firstCall) {
                throw new Error("Expected fetch to be called.");
            }

            tester.expect(String(firstCall.input)).toBe(
                "http://localhost:3000/api/projects/project-1/mix-settings",
            );

            tester.expect(firstCall.init).toEqual({
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(mixSettings),
                credentials: "include",
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    tester.it("throws the backend error when saving mix settings fails", async () => {
        const originalFetch = globalThis.fetch;

        globalThis.fetch = (async () => {
            return createJsonResponse(
                {
                    ok: false,
                    error: "Project not found.",
                },
                404,
            );
        }) as typeof fetch;

        try {
            let errorMessage = "";

            try {
                await saveMixSettings("missing-project", {
                    channels: [],
                });
            } catch (error) {
                errorMessage =
                    error instanceof Error
                        ? error.message
                        : String(error);
            }

            tester.expect(errorMessage).toBe("Project not found.");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
    tester.it("updates project details", async () => {
        const originalFetch = globalThis.fetch;
        const fetchCalls: FetchCall[] = [];
        const updatedProject = createProject({
            title: "Updated Title",
        });

        globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
            const [input, init] = args;

            fetchCalls.push({
                input,
                init,
            });

            return createJsonResponse({
                ok: true,
                data: updatedProject,
            });
        }) as typeof fetch;

        try {
            const result = await updateProjectDetails(
                "project-1",
                {
                    title: "Updated Title",
                },
            );

            tester.expect(result).toEqual(updatedProject);
            tester.expect(fetchCalls.length).toBe(1);

            const firstCall = fetchCalls[0];

            if (!firstCall) {
                throw new Error("Expected fetch to be called.");
            }

            tester.expect(String(firstCall.input)).toBe(
                "http://localhost:3000/api/projects/project-1",
            );

            tester.expect(firstCall.init).toEqual({
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: "Updated Title",
                }),
                credentials: "include",
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    tester.it("throws the backend error when updating project details fails", async () => {
        const originalFetch = globalThis.fetch;

        globalThis.fetch = (async () => {
            return createJsonResponse(
                {
                    ok: false,
                    error: "Project not found.",
                },
                404,
            );
        }) as typeof fetch;

        try {
            let errorMessage = "";

            try {
                await updateProjectDetails("missing-project", {
                    title: "Updated Title",
                });
            } catch (error) {
                errorMessage =
                    error instanceof Error
                        ? error.message
                        : String(error);
            }

            tester.expect(errorMessage).toBe("Project not found.");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

});