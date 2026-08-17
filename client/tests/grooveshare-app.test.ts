import { ApiError, apiFetch } from "../src/api/api-client.js";
import type { SessionProvider } from "@hugovela/frontend-core";
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

function createAuthenticatedSessionProvider(): SessionProvider {
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

function createUnauthenticatedSessionProvider(): SessionProvider {
    return {
        ...createAuthenticatedSessionProvider(),
        async getCurrentUser() {
            throw new ApiError(
                "Authentication required.",
                401,
            );
        },
    };
}

function createFakeLogoutButton() {
    let clickHandler: (() => void | Promise<void>) | null = null;

    return {
        disabled: false,

        addEventListener(
            eventName: "click",
            handler: () => void | Promise<void>,
        ) {
            if (eventName === "click") {
                clickHandler = handler;
            }
        },

        async click(): Promise<void> {
            await clickHandler?.();
            await Promise.resolve();
            await Promise.resolve();
        },
    };
}

function createAppElementWithLogoutButton(
    logoutButton: ReturnType<typeof createFakeLogoutButton>,
) {
    return {
        innerHTML: "",

        querySelector<T>(selector: string): T | null {
            if (selector === "#logout-button") {
                return logoutButton as T;
            }

            return null;
        },
    };
}

function createProjectPlayerIntegrationElements() {
    type Listener = (...args: unknown[]) => void | Promise<void>;

    function createButton() {
        let clickHandler: Listener | null = null;

        return {
            disabled: false,
            textContent: null as string | null,
            addEventListener(eventName: string, handler: Listener) {
                if (eventName === "click") {
                    clickHandler = handler;
                }
            },
            click() {
                return clickHandler?.();
            },
        };
    }

    const backButton = createButton();
    const seekBackwardButton = createButton();
    const playPauseButton = createButton();
    const stopButton = createButton();
    const loopCheckbox = {
        checked: false,
    };
    const progressInput = {
        disabled: false,
        value: "0",
        addEventListener() {},
    };
    const timestampElement = {
        textContent: null as string | null,
    };
    const durationElement = {
        textContent: null as string | null,
    };
    const trackNameElement = {
        textContent: null as string | null,
    };
    const audioListeners = new Map<string, Listener>();
    const audioElement = {
        src: "",
        crossOrigin: null as string | null,
        currentTime: 0,
        duration: 120,
        paused: true,
        volume: 1,
        async play() {
            this.paused = false;
        },
        pause() {
            this.paused = true;
        },
        load() {},
        addEventListener(eventName: string, handler: Listener) {
            audioListeners.set(eventName, handler);
        },
    };

    let changeHandler:
        | ((event: { target: EventTarget | null }) => void | Promise<void>)
        | null = null;
    let volume = 1;

    const channelSlot = {
        dataset: {
            mixChannel: "1",
            trackId: "track-1",
        },
        querySelector(selector: string) {
            if (selector === "[data-channel-enabled]") {
                return { checked: true };
            }

            if (selector === "[data-channel-volume]") {
                return { value: String(volume) };
            }

            return null;
        },
    };

    const trackListElement = {
        innerHTML: "",
        addEventListener(
            eventName: "click" | "input" | "change",
            handler: (
                event: { target: EventTarget | null },
            ) => void | Promise<void>,
        ) {
            if (eventName === "change") {
                changeHandler = handler;
            }
        },
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [channelSlot];
        },
        async changeVolume(nextVolume: number) {
            volume = nextVolume;

            await changeHandler?.({
                target: {
                    value: String(nextVolume),
                    dataset: {
                        channelVolume: "",
                        mixChannel: "1",
                    },
                } as unknown as EventTarget,
            });
        },
    };

    const appElement = {
        innerHTML: "",

        querySelector<T>(selector: string): T | null {
            const elements = new Map<string, unknown>([
                ["#player-back-button", backButton],
                ["#player-track-list", trackListElement],
                ["#project-audio-player", audioElement],
                ["#audio-seek-back-button", seekBackwardButton],
                ["#audio-play-pause-button", playPauseButton],
                ["#audio-stop-button", stopButton],
                ["#audio-loop-checkbox", loopCheckbox],
                ["#audio-progress", progressInput],
                ["#audio-timestamp", timestampElement],
                ["#audio-duration", durationElement],
                ["#audio-track-name", trackNameElement],
            ]);

            return (elements.get(selector) as T | undefined) ?? null;
        },
    };

    return {
        appElement,
        backButton,
        trackListElement,
    };
}

async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, 0);
    });
}

tester.describe("GrooveShare app", () => {
    tester.it("starts on the authentication page without a session", async () => {
        const appElement = createFakeContainer();

        const app = createGrooveShareApp({
            appElement,
            sessionProvider: createUnauthenticatedSessionProvider(),
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
            sessionProvider: createAuthenticatedSessionProvider(),
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
            sessionProvider: createAuthenticatedSessionProvider(),
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
            sessionProvider: createAuthenticatedSessionProvider(),
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
            sessionProvider: createAuthenticatedSessionProvider(),
        });

        await app.start();
        app.navigateTo("project-player");

        tester.expect(app.getCurrentScreen()).toBe("project-player");
        tester.expect(appElement.innerHTML.includes("Project Player")).toBe(true);
        tester.expect(appElement.innerHTML.includes("player-track-list")).toBe(true);
    });
    tester.it("flushes a dirty mix through the injected storage provider before desktop Back navigation completes", async () => {
        const originalFetch = globalThis.fetch;
        const { appElement, backButton, trackListElement } =
            createProjectPlayerIntegrationElements();
        const history = createHistoryAdapter("#projects/project-1");
        const storageValues = new Map<string, string>();
        const storageProvider = {
            getItem(key: string) {
                return storageValues.get(key) ?? null;
            },
            setItem(key: string, value: string) {
                storageValues.set(key, value);
            },
            removeItem(key: string) {
                storageValues.delete(key);
            },
        };

        const project = {
            id: "project-1",
            title: "Integration Project",
            description: "Dirty mix navigation",
            role: "contributor" as const,
            mixSettings: {
                channels: [
                    {
                        channelNumber: 1,
                        trackId: "track-1",
                        enabled: true,
                        volume: 1,
                    },
                ],
            },
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        };
        const track = {
            id: "track-1",
            projectId: "project-1",
            name: "Guitar",
            originalFilename: "guitar.wav",
            filePath: "uploads/guitar.wav",
            mimeType: "audio/wav",
            fileSize: 123,
            uploadedByUserId: "user-1",
            createdAt: "2026-01-01T00:00:00.000Z",
        };

        let mixSaveCallCount = 0;
        let resolveMixSave!: () => void;
        const mixSaveGate = new Promise<void>((resolve) => {
            resolveMixSave = resolve;
        });

        globalThis.fetch = (async (input, init) => {
            const url = String(input);
            const method = init?.method ?? "GET";

            if (
                method === "GET" &&
                url.endsWith("/api/projects/project-1")
            ) {
                return new Response(
                    JSON.stringify({ ok: true, data: project }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            if (
                method === "GET" &&
                url.endsWith("/api/projects/project-1/tracks")
            ) {
                return new Response(
                    JSON.stringify({ ok: true, data: [track] }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            if (
                method === "PUT" &&
                url.endsWith("/api/projects/project-1/mix-settings")
            ) {
                mixSaveCallCount += 1;
                await mixSaveGate;

                return new Response(
                    JSON.stringify({ ok: true, data: project }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            throw new Error(`Unexpected request: ${method} ${url}`);
        }) as typeof fetch;

        try {
            const app = createGrooveShareApp({
                appElement,
                sessionProvider: createAuthenticatedSessionProvider(),
                storageProvider,
                historyAdapter: history.adapter,
            });

            await app.start();
            await flushMicrotasks();

            tester.expect(app.getCurrentScreen()).toBe("project-player");

            await trackListElement.changeVolume(0.62);

            const storageKey =
                "grooveshare:pending-mix:user-1:project-1";

            tester.expect(storageValues.has(storageKey)).toBe(true);
            tester.expect(mixSaveCallCount).toBe(0);

            backButton.click();
            await flushMicrotasks();

            tester.expect(mixSaveCallCount).toBe(1);
            tester.expect(app.getCurrentScreen()).toBe("project-player");

            resolveMixSave();
            await flushMicrotasks();

            tester.expect(app.getCurrentScreen()).toBe("project-menu");
            tester.expect(storageValues.has(storageKey)).toBe(false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    tester.it("logs out through the shared session provider and keeps protected UI closed", async () => {
        const logoutButton = createFakeLogoutButton();
        const appElement = createAppElementWithLogoutButton(logoutButton);
        const history = createHistoryAdapter("#projects");
        let logoutCallCount = 0;

        const sessionProvider: SessionProvider = {
            ...createAuthenticatedSessionProvider(),
            async logout() {
                logoutCallCount += 1;
            },
        };

        const app = createGrooveShareApp({
            appElement,
            sessionProvider,
            historyAdapter: history.adapter,
        });

        await app.start();
        tester.expect(app.getCurrentScreen()).toBe("project-menu");

        await logoutButton.click();

        tester.expect(logoutCallCount).toBe(1);
        tester.expect(app.getCurrentScreen()).toBe("auth");
        tester.expect(app.getCurrentUser()).toBe(null);
        tester.expect(history.getHash()).toBe("#auth");
        tester.expect(appElement.innerHTML.includes("You have been signed out.")).toBe(true);

        app.navigateTo("project-menu");

        tester.expect(app.getCurrentScreen()).toBe("auth");
        tester.expect(appElement.innerHTML.includes("Log in")).toBe(true);
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
                sessionProvider: createAuthenticatedSessionProvider(),
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
