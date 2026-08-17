import { ApiError, apiFetch } from "../src/api/api-client.js";
import type { AuthApi } from "../src/api/auth-api.js";
import { createGrooveShareApp } from "../src/app.js";
import type { AppHistoryState, HistoryAdapter } from "../src/router/app-router.js";
import type { User } from "../src/types.js";
import { createFakeContainer } from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

const user: User = {
    id: "user-1",
    email: "musician@example.com",
    displayName: "Musician",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
};

function createAuthenticatedApi(): AuthApi {
    return {
        async getCurrentUser() {
            return user;
        },
        async login() {
            return user;
        },
        async registerUser() {
            return user;
        },
        async logout() {},
    };
}

function createHistoryAdapter(initialHash: string) {
    let hash = initialHash;
    let state: AppHistoryState | null = null;
    let popStateHandler: (() => void) | null = null;

    const adapter: HistoryAdapter = {
        getHash() {
            return hash;
        },
        getState() {
            return state;
        },
        pushState(nextState, nextHash) {
            state = nextState;
            hash = nextHash;
        },
        replaceState(nextState, nextHash) {
            state = nextState;
            hash = nextHash;
        },
        back() {
            popStateHandler?.();
        },
        addPopStateListener(handler) {
            popStateHandler = handler;

            return () => {
                if (popStateHandler === handler) {
                    popStateHandler = null;
                }
            };
        },
    };

    return {
        adapter,
        getHash() {
            return hash;
        },
    };
}

function createUnauthenticatedApi(): AuthApi {
    return {
        ...createAuthenticatedApi(),
        async getCurrentUser() {
            throw new ApiError(
                "Authentication required.",
                401,
            );
        },
    };
}

tester.describe("GrooveShare app", () => {
    tester.it("starts on the authentication page without a session", async () => {
        const appElement = createFakeContainer();

        const app = createGrooveShareApp({
            appElement,
            authenticationApi: createUnauthenticatedApi(),
        });

        await app.start();

        tester.expect(app.getCurrentScreen()).toBe("auth");
        tester.expect(app.getCurrentUser()).toBe(null);
        tester.expect(appElement.innerHTML.includes("Log in")).toBe(true);
        tester.expect(appElement.innerHTML.includes("Create an account")).toBe(true);
    });

    tester.it("restores an existing session and starts on the Project Menu", async () => {
        const appElement = createFakeContainer();

        const app = createGrooveShareApp({
            appElement,
            authenticationApi: createAuthenticatedApi(),
        });

        await app.start();

        tester.expect(app.getCurrentScreen()).toBe("project-menu");
        tester.expect(app.getCurrentUser()).toEqual(user);
        tester.expect(appElement.innerHTML.includes("Current Projects")).toBe(true);
        tester.expect(appElement.innerHTML.includes("Signed in as")).toBe(true);
        tester.expect(appElement.innerHTML.includes("Musician")).toBe(true);
        tester.expect(appElement.innerHTML.includes("logout-button")).toBe(true);
    });

    tester.it("returns to authentication when an active API request reports an expired session", async () => {
        const originalFetch = globalThis.fetch;
        const appElement = createFakeContainer();

        const app = createGrooveShareApp({
            appElement,
            authenticationApi: createAuthenticatedApi(),
        });

        await app.start();

        globalThis.fetch = (async () => {
            return new Response(
                JSON.stringify({
                    ok: false,
                    error: "Authentication required.",
                }),
                {
                    status: 401,
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );
        }) as typeof fetch;

        try {
            await apiFetch("http://localhost:3000/api/projects");

            tester.expect(app.getCurrentScreen()).toBe("auth");
            tester.expect(app.getCurrentUser()).toBe(null);
            tester.expect(
                appElement.innerHTML.includes("Your session has expired. Sign in again."),
            ).toBe(true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    tester.it("can render the Create Project page for an authenticated user", async () => {
        const appElement = createFakeContainer();

        const app = createGrooveShareApp({
            appElement,
            authenticationApi: createAuthenticatedApi(),
        });

        await app.start();
        app.navigateTo("create-project");

        tester.expect(app.getCurrentScreen()).toBe("create-project");
        tester.expect(appElement.innerHTML.includes("Create Project")).toBe(true);
        tester.expect(appElement.innerHTML.includes("project-form")).toBe(true);
    });

    tester.it("can render the Project Player page for an authenticated user", async () => {
        const appElement = createFakeContainer();

        const app = createGrooveShareApp({
            appElement,
            authenticationApi: createAuthenticatedApi(),
        });

        await app.start();
        app.navigateTo("project-player");

        tester.expect(app.getCurrentScreen()).toBe("project-player");
        tester.expect(appElement.innerHTML.includes("Project Player")).toBe(true);
        tester.expect(appElement.innerHTML.includes("player-track-list")).toBe(true);
    });
    tester.it("restores a Project Player route from browser history", async () => {
        const originalFetch = globalThis.fetch;
        const appElement = createFakeContainer();
        const history = createHistoryAdapter("#projects/project-1");

        globalThis.fetch = (async () => {
            return new Response(
                JSON.stringify({
                    ok: true,
                    data: {
                        id: "project-1",
                        title: "History Project",
                        description: "Restored from the URL",
                        role: "owner",
                        createdAt: "2026-01-01T00:00:00.000Z",
                        updatedAt: "2026-01-01T00:00:00.000Z",
                    },
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );
        }) as typeof fetch;

        try {
            const app = createGrooveShareApp({
                appElement,
                authenticationApi: createAuthenticatedApi(),
                historyAdapter: history.adapter,
            });

            await app.start();

            tester.expect(app.getCurrentScreen()).toBe("project-player");
            tester.expect(history.getHash()).toBe("#projects/project-1");
            tester.expect(appElement.innerHTML.includes("History Project")).toBe(true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

});
