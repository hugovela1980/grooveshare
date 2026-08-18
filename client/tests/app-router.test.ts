import {
    createAppRouter,
    parseRouteHash,
    routeToHash,
    type AppHistoryState,
    type AppRoute,
    type AppScreen,
    type HistoryAdapter,
} from "../src/router/app-router.js";
import { createFakeContainer } from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

function createPageRenderers() {
    return {
        auth() {
            return "<main>Authentication</main>";
        },

        invitation() {
            return "<main>Invitation</main>";
        },

        "project-menu"() {
            return "<main>Project Menu</main>";
        },

        "create-project"() {
            return "<main>Create Project</main>";
        },

        "project-player"() {
            return "<main>Project Player</main>";
        },
    };
}

function createFakeHistoryAdapter(initialHash = "#projects") {
    type Entry = {
        hash: string;
        state: AppHistoryState;
    };

    let entries: Entry[] = [];
    let index = -1;
    let popStateHandler: (() => void) | null = null;
    let hash = initialHash;
    let state: AppHistoryState | null = null;

    const adapter: HistoryAdapter = {
        getHash() {
            return hash;
        },

        getState() {
            return state;
        },

        pushState(nextState, nextHash) {
            entries = entries.slice(0, index + 1);
            entries.push({
                hash: nextHash,
                state: nextState,
            });
            index = entries.length - 1;
            hash = nextHash;
            state = nextState;
        },

        replaceState(nextState, nextHash) {
            const entry = {
                hash: nextHash,
                state: nextState,
            };

            if (index < 0) {
                entries = [entry];
                index = 0;
            } else {
                entries[index] = entry;
            }

            hash = nextHash;
            state = nextState;
        },

        back() {
            if (index <= 0) {
                return;
            }

            index -= 1;
            hash = entries[index].hash;
            state = entries[index].state;
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
        getState() {
            return state;
        },
    };
}

tester.describe("app router", () => {
    tester.it("renders the initial screen", () => {
        const appElement = createFakeContainer();

        const router = createAppRouter({
            appElement,
            initialScreen: "project-menu",
            pageRenderers: createPageRenderers(),
            historyAdapter: null,
        });

        router.start();

        tester.expect(appElement.innerHTML).toBe("<main>Project Menu</main>");
        tester.expect(router.getCurrentScreen()).toBe("project-menu");
    });

    tester.it("navigates to another screen and renders it", () => {
        const appElement = createFakeContainer();

        const router = createAppRouter({
            appElement,
            initialScreen: "project-menu",
            pageRenderers: createPageRenderers(),
            historyAdapter: null,
        });

        router.start();
        router.navigateTo({ screen: "create-project" });

        tester.expect(appElement.innerHTML).toBe("<main>Create Project</main>");
        tester.expect(router.getCurrentScreen()).toBe("create-project");
    });

    tester.it("can navigate through the current screen flow without browser history", () => {
        const appElement = createFakeContainer();

        const router = createAppRouter({
            appElement,
            initialScreen: "project-menu",
            pageRenderers: createPageRenderers(),
            historyAdapter: null,
        });

        router.start();

        const screenFlow: AppScreen[] = [
            "create-project",
            "project-menu",
            "project-player",
            "project-menu",
        ];

        for (const screen of screenFlow) {
            router.navigateTo({ screen });
        }

        tester.expect(appElement.innerHTML).toBe("<main>Project Menu</main>");
        tester.expect(router.getCurrentScreen()).toBe("project-menu");
    });

    tester.it("maps GrooveShare routes to stable hashes", () => {
        tester.expect(routeToHash({ screen: "auth" })).toBe("#auth");
        tester.expect(routeToHash({ screen: "project-menu" })).toBe("#projects");
        tester.expect(routeToHash({ screen: "create-project" })).toBe("#projects/new");
        tester.expect(
            routeToHash({
                screen: "project-player",
                projectId: "project 1",
            }),
        ).toBe("#projects/project%201");
    });

    tester.it("parses GrooveShare hashes into routes", () => {
        tester.expect(parseRouteHash("#projects")).toEqual({
            screen: "project-menu",
        });
        tester.expect(parseRouteHash("#projects/new")).toEqual({
            screen: "create-project",
        });
        tester.expect(parseRouteHash("#projects/project%201")).toEqual({
            screen: "project-player",
            projectId: "project 1",
        });
        tester.expect(parseRouteHash("#not-a-route")).toBe(null);
    });

    tester.it("pushes browser history entries for app navigation", () => {
        const appElement = createFakeContainer();
        const history = createFakeHistoryAdapter();

        const router = createAppRouter({
            appElement,
            initialScreen: "project-menu",
            pageRenderers: createPageRenderers(),
            historyAdapter: history.adapter,
        });

        router.start({ screen: "project-menu" });
        router.navigateTo({ screen: "create-project" });
        router.navigateTo({
            screen: "project-player",
            projectId: "project-1",
        });

        tester.expect(history.getHash()).toBe("#projects/project-1");
        tester.expect(history.getState()?.depth).toBe(2);
        tester.expect(router.getCurrentRoute()).toEqual({
            screen: "project-player",
            projectId: "project-1",
        });
    });

    tester.it("uses browser history for Back and reports the restored route", () => {
        const appElement = createFakeContainer();
        const history = createFakeHistoryAdapter();
        const restoredRoutes: AppRoute[] = [];

        const router = createAppRouter({
            appElement,
            initialScreen: "project-menu",
            pageRenderers: createPageRenderers(),
            historyAdapter: history.adapter,
            onHistoryNavigation(route) {
                restoredRoutes.push(route);
                router.renderCurrentScreen();
            },
        });

        router.start({ screen: "project-menu" });
        router.navigateTo({ screen: "create-project" });

        const waitingForHistory = router.goBack({
            screen: "project-menu",
        });

        tester.expect(waitingForHistory).toBe(true);
        tester.expect(history.getHash()).toBe("#projects");
        tester.expect(restoredRoutes).toEqual([
            { screen: "project-menu" },
        ]);
        tester.expect(appElement.innerHTML).toBe("<main>Project Menu</main>");
    });

    tester.it("uses a fallback route when there is no app history to go back to", () => {
        const appElement = createFakeContainer();
        const history = createFakeHistoryAdapter("#projects/new");

        const router = createAppRouter({
            appElement,
            initialScreen: "create-project",
            pageRenderers: createPageRenderers(),
            historyAdapter: history.adapter,
        });

        router.start({ screen: "create-project" });

        const waitingForHistory = router.goBack({
            screen: "project-menu",
        });

        tester.expect(waitingForHistory).toBe(false);
        tester.expect(history.getHash()).toBe("#projects");
        tester.expect(appElement.innerHTML).toBe("<main>Project Menu</main>");
    });
});
