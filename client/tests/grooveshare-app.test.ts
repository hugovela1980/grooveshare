import { createGrooveShareApp } from "../src/app.js";
import { createFakeContainer } from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

tester.describe("GrooveShare app", () => {
    tester.it("starts on the Project Menu page", () => {
        const appElement = createFakeContainer();

        const app = createGrooveShareApp({
            appElement,
        });

        app.start();

        tester.expect(app.getCurrentScreen()).toBe("project-menu");
        tester.expect(appElement.innerHTML.includes("Grooveshare")).toBe(true);
        tester.expect(appElement.innerHTML.includes("Current Projects")).toBe(true);
        tester.expect(appElement.innerHTML.includes("Create a New Project")).toBe(true);
        tester.expect(appElement.innerHTML.includes("add-project-button")).toBe(true);
    });

    tester.it("can render the Create Project page through the router", () => {
        const appElement = createFakeContainer();

        const app = createGrooveShareApp({
            appElement,
        });

        app.start();
        app.navigateTo("create-project");

        tester.expect(app.getCurrentScreen()).toBe("create-project");
        tester.expect(appElement.innerHTML.includes("Create Project")).toBe(true);
        tester.expect(appElement.innerHTML.includes("project-form")).toBe(true);
    });

    tester.it("can render the Project Player page through the router", () => {
        const appElement = createFakeContainer();

        const app = createGrooveShareApp({
            appElement,
        });

        app.start();
        app.navigateTo("project-player");

        tester.expect(app.getCurrentScreen()).toBe("project-player");
        tester.expect(appElement.innerHTML.includes("Project Player")).toBe(true);
        tester.expect(appElement.innerHTML.includes("player-track-list")).toBe(true);
    });
});