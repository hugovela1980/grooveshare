import { deleteProject } from "../src/api/projects-api.js";
import type { Project } from "../src/types.js";
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
});