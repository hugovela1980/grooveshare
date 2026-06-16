import type { AppScreen } from "../router/app-router.js";

type ButtonLike = {
    addEventListener: (
        eventName: string,
        handler: () => void | Promise<void>,
    ) => void;
};

type RouterLike = {
    navigateTo: (screen: AppScreen) => void;
};

type ProjectMenuNavigationOptions = {
    addProjectButton: ButtonLike;
    router: RouterLike;
};

type CreateProjectNavigationOptions = {
    backButton: ButtonLike;
    router: RouterLike;
};

export function initializeProjectMenuNavigation({
    addProjectButton,
    router,
}: ProjectMenuNavigationOptions): void {
    addProjectButton.addEventListener("click", () => {
        router.navigateTo("create-project");
    });
}

export function initializeCreateProjectNavigation({
    backButton,
    router,
}: CreateProjectNavigationOptions): void {
    backButton.addEventListener("click", () => {
        router.navigateTo("project-menu");
    });
}