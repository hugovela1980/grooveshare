import {
    createAppRouter,
    type AppScreen,
} from "../src/router/app-router.js";
import { createFakeContainer } from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

function createPageRenderers() {
    return {
        "project-menu"() {
            return "<main>Project Menu</main>";
        },

        "create-project"() {
            return "<main>Create Project</main>";
        },

        "confirm-project"() {
            return "<main>Confirm Project</main>";
        },

        "project-player"() {
            return "<main>Project Player</main>";
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
        });

        router.start();
        router.navigateTo("create-project");

        tester.expect(appElement.innerHTML).toBe("<main>Create Project</main>");
        tester.expect(router.getCurrentScreen()).toBe("create-project");
    });

    tester.it("can navigate through the Version 1 screen flow", () => {
        const appElement = createFakeContainer();

        const router = createAppRouter({
            appElement,
            initialScreen: "project-menu",
            pageRenderers: createPageRenderers(),
        });

        router.start();

        const screenFlow: AppScreen[] = [
            "create-project",
            "project-menu",
            "project-player",
            "project-menu",
        ];

        for (const screen of screenFlow) {
            router.navigateTo(screen);
        }

        tester.expect(appElement.innerHTML).toBe("<main>Project Menu</main>");
        tester.expect(router.getCurrentScreen()).toBe("project-menu");
    });
});