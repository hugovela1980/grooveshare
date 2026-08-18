export type AppScreen =
    | "auth"
    | "invitation"
    | "project-menu"
    | "create-project"
    | "project-player";

export type AppRoute = {
    screen: AppScreen;
    projectId?: string;
    invitationToken?: string;
};

type AppElementLike = {
    innerHTML: string;
};

type PageRenderers = Record<AppScreen, () => string>;

export type AppHistoryState = {
    grooveShare: true;
    route: AppRoute;
    depth: number;
};

export type HistoryAdapter = {
    getHash: () => string;
    getState: () => unknown;
    pushState: (state: AppHistoryState, hash: string) => void;
    replaceState: (state: AppHistoryState, hash: string) => void;
    back: () => void;
    addPopStateListener: (handler: () => void) => () => void;
};

type AppRouterOptions = {
    appElement: AppElementLike;
    initialScreen: AppScreen;
    pageRenderers: PageRenderers;
    historyAdapter?: HistoryAdapter | null;
    onHistoryNavigation?: (route: AppRoute) => void;
};

function isAppScreen(value: unknown): value is AppScreen {
    return (
        value === "auth" ||
        value === "invitation" ||
        value === "project-menu" ||
        value === "create-project" ||
        value === "project-player"
    );
}

function isAppRoute(value: unknown): value is AppRoute {
    if (!value || typeof value !== "object") {
        return false;
    }

    const candidate = value as {
        screen?: unknown;
        projectId?: unknown;
        invitationToken?: unknown;
    };

    return (
        isAppScreen(candidate.screen) &&
        (candidate.projectId === undefined ||
            typeof candidate.projectId === "string") &&
        (candidate.invitationToken === undefined ||
            typeof candidate.invitationToken === "string")
    );
}

function isAppHistoryState(value: unknown): value is AppHistoryState {
    if (!value || typeof value !== "object") {
        return false;
    }

    const candidate = value as {
        grooveShare?: unknown;
        route?: unknown;
        depth?: unknown;
    };

    return (
        candidate.grooveShare === true &&
        isAppRoute(candidate.route) &&
        typeof candidate.depth === "number" &&
        candidate.depth >= 0
    );
}

export function routeToHash(route: AppRoute): string {
    if (route.screen === "auth") {
        return "#auth";
    }

    if (route.screen === "invitation" && route.invitationToken) {
        return `#invite/${encodeURIComponent(route.invitationToken)}`;
    }

    if (route.screen === "project-menu") {
        return "#projects";
    }

    if (route.screen === "create-project") {
        return "#projects/new";
    }

    if (route.projectId) {
        return `#projects/${encodeURIComponent(route.projectId)}`;
    }

    return "#project-player";
}

export function parseRouteHash(hash: string): AppRoute | null {
    const normalizedHash = hash.trim();

    if (!normalizedHash || normalizedHash === "#" || normalizedHash === "#projects") {
        return { screen: "project-menu" };
    }

    if (normalizedHash === "#auth") {
        return { screen: "auth" };
    }

    const invitationMatch = normalizedHash.match(/^#invite\/(.+)$/);

    if (invitationMatch) {
        try {
            return {
                screen: "invitation",
                invitationToken: decodeURIComponent(invitationMatch[1]),
            };
        } catch {
            return null;
        }
    }

    if (normalizedHash === "#projects/new") {
        return { screen: "create-project" };
    }

    if (normalizedHash === "#project-player") {
        return { screen: "project-player" };
    }

    const projectMatch = normalizedHash.match(/^#projects\/(.+)$/);

    if (!projectMatch) {
        return null;
    }

    try {
        return {
            screen: "project-player",
            projectId: decodeURIComponent(projectMatch[1]),
        };
    } catch {
        return null;
    }
}

export function createBrowserHistoryAdapter(): HistoryAdapter | null {
    if (typeof window === "undefined") {
        return null;
    }

    return {
        getHash() {
            return window.location.hash;
        },

        getState() {
            return window.history.state;
        },

        pushState(state, hash) {
            window.history.pushState(state, "", hash);
        },

        replaceState(state, hash) {
            window.history.replaceState(state, "", hash);
        },

        back() {
            window.history.back();
        },

        addPopStateListener(handler) {
            window.addEventListener("popstate", handler);

            return () => {
                window.removeEventListener("popstate", handler);
            };
        },
    };
}

function routesMatch(first: AppRoute, second: AppRoute): boolean {
    return (
        first.screen === second.screen &&
        first.projectId === second.projectId &&
        first.invitationToken === second.invitationToken
    );
}

export function createAppRouter({
    appElement,
    initialScreen,
    pageRenderers,
    historyAdapter = createBrowserHistoryAdapter(),
    onHistoryNavigation,
}: AppRouterOptions) {
    let currentRoute: AppRoute = { screen: initialScreen };
    let currentDepth = 0;
    let removePopStateListener: (() => void) | null = null;

    function renderCurrentScreen(): void {
        appElement.innerHTML = pageRenderers[currentRoute.screen]();
    }

    function createHistoryState(route: AppRoute): AppHistoryState {
        return {
            grooveShare: true,
            route,
            depth: currentDepth,
        };
    }

    function getRequestedRoute(): AppRoute {
        if (!historyAdapter) {
            return { screen: initialScreen };
        }

        return (
            parseRouteHash(historyAdapter.getHash()) ??
            { screen: initialScreen }
        );
    }

    function syncFromBrowserHistory(): void {
        if (!historyAdapter) {
            return;
        }

        const historyState = historyAdapter.getState();
        const routeFromState = isAppHistoryState(historyState)
            ? historyState.route
            : null;
        const routeFromHash = parseRouteHash(historyAdapter.getHash());
        const nextRoute = routeFromState ?? routeFromHash ?? {
            screen: initialScreen,
        };

        currentDepth = isAppHistoryState(historyState)
            ? historyState.depth
            : 0;
        currentRoute = nextRoute;

        if (onHistoryNavigation) {
            onHistoryNavigation(nextRoute);
            return;
        }

        renderCurrentScreen();
    }

    function start(route: AppRoute = getRequestedRoute()): void {
        currentRoute = route;

        if (historyAdapter) {
            const existingState = historyAdapter.getState();

            currentDepth = isAppHistoryState(existingState)
                ? existingState.depth
                : 0;

            historyAdapter.replaceState(
                createHistoryState(route),
                routeToHash(route),
            );

            if (!removePopStateListener) {
                removePopStateListener =
                    historyAdapter.addPopStateListener(syncFromBrowserHistory);
            }
        }

        renderCurrentScreen();
    }

    function navigateTo(route: AppRoute): void {
        if (routesMatch(route, currentRoute)) {
            renderCurrentScreen();
            return;
        }

        currentRoute = route;
        currentDepth += 1;

        historyAdapter?.pushState(
            createHistoryState(route),
            routeToHash(route),
        );

        renderCurrentScreen();
    }

    function replaceWith(route: AppRoute): void {
        currentRoute = route;

        historyAdapter?.replaceState(
            createHistoryState(route),
            routeToHash(route),
        );

        renderCurrentScreen();
    }

    function goBack(fallbackRoute: AppRoute): boolean {
        if (historyAdapter && currentDepth > 0) {
            historyAdapter.back();
            return true;
        }

        navigateTo(fallbackRoute);
        return false;
    }

    function getCurrentScreen(): AppScreen {
        return currentRoute.screen;
    }

    function getCurrentRoute(): AppRoute {
        return { ...currentRoute };
    }

    function destroy(): void {
        removePopStateListener?.();
        removePopStateListener = null;
    }

    return {
        start,
        navigateTo,
        replaceWith,
        goBack,
        renderCurrentScreen,
        getRequestedRoute,
        getCurrentScreen,
        getCurrentRoute,
        destroy,
    };
}
