import type { AppScreen } from "../src/router/app-router.js";
import {
    initializeCreateProjectNavigation,
    initializeProjectMenuNavigation,
} from "../src/page-actions/page-navigation.js";
import { createFakeButton } from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

function createFakeRouter() {
    const navigatedScreens: AppScreen[] = [];

    return {
        navigateTo(screen: AppScreen) {
            navigatedScreens.push(screen);
        },

        getNavigatedScreens() {
            return navigatedScreens;
        },
    };
}

tester.describe("page navigation actions", () => {
    tester.it("navigates from Project Menu to Create Project", async () => {
        const addProjectButton = createFakeButton();
        const router = createFakeRouter();

        initializeProjectMenuNavigation({
            addProjectButton,
            router,
        });

        await addProjectButton.click();

        tester.expect(router.getNavigatedScreens()).toEqual(["create-project"]);
    });

    tester.it("navigates from Create Project back to Project Menu", async () => {
        const backButton = createFakeButton();
        const router = createFakeRouter();

        initializeCreateProjectNavigation({
            backButton,
            router,
        });

        await backButton.click();

        tester.expect(router.getNavigatedScreens()).toEqual(["project-menu"]);
    });
});