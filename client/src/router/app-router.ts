export type AppScreen =
    | "project-menu"
    | "create-project"
    | "project-player";

type AppElementLike = {
    innerHTML: string;
};

type PageRenderers = Record<AppScreen, () => string>;

type AppRouterOptions = {
    appElement: AppElementLike;
    initialScreen: AppScreen;
    pageRenderers: PageRenderers;
};

export function createAppRouter({
    appElement,
    initialScreen,
    pageRenderers,
}: AppRouterOptions) {
    let currentScreen = initialScreen;

    function renderCurrentScreen(): void {
        appElement.innerHTML = pageRenderers[currentScreen]();
    }

    function start(): void {
        renderCurrentScreen();
    }

    function navigateTo(screen: AppScreen): void {
        currentScreen = screen;
        renderCurrentScreen();
    }

    function getCurrentScreen(): AppScreen {
        return currentScreen;
    }

    return {
        start,
        navigateTo,
        getCurrentScreen,
    };
}