import { createProjectActionsMenuController } from "../src/page-controllers/project-actions-menu-controller.js";
import { tester } from "./test-runner/tester.js";

type ClickHandler = (event: {
    target: EventTarget | null;
}) => void;

type DocumentHandler = (event: {
    target?: EventTarget | null;
    key?: string;
    preventDefault?: () => void;
}) => void;

function createButton() {
    let clickHandler: ClickHandler | null = null;
    let focused = false;
    const attributes = new Map<string, string>();

    return {
        addEventListener(eventName: "click", handler: ClickHandler) {
            if (eventName === "click") {
                clickHandler = handler;
            }
        },
        setAttribute(name: string, value: string) {
            attributes.set(name, value);
        },
        focus() {
            focused = true;
        },
        contains() {
            return false;
        },
        click() {
            clickHandler?.({ target: null });
        },
        getAttribute(name: string) {
            return attributes.get(name) ?? null;
        },
        wasFocused() {
            return focused;
        },
    };
}

function createDocumentTarget() {
    const handlers = new Map<string, DocumentHandler>();

    return {
        addEventListener(eventName: "click" | "keydown", handler: DocumentHandler) {
            handlers.set(eventName, handler);
        },
        removeEventListener(eventName: "click" | "keydown", handler: DocumentHandler) {
            if (handlers.get(eventName) === handler) {
                handlers.delete(eventName);
            }
        },
        dispatchClick() {
            handlers.get("click")?.({ target: null });
        },
        dispatchEscape() {
            let prevented = false;

            handlers.get("keydown")?.({
                key: "Escape",
                preventDefault() {
                    prevented = true;
                },
            });

            return prevented;
        },
        hasHandler(eventName: string) {
            return handlers.has(eventName);
        },
    };
}

tester.describe("project actions menu controller", () => {
    tester.it("opens and closes the project actions menu", () => {
        const triggerButton = createButton();
        const menuElement = {
            hidden: true,
            contains() {
                return false;
            },
        };
        const documentTarget = createDocumentTarget();

        const controller = createProjectActionsMenuController({
            triggerButton,
            menuElement,
            documentTarget,
        });

        controller.init();
        triggerButton.click();

        tester.expect(menuElement.hidden).toBe(false);
        tester.expect(triggerButton.getAttribute("aria-expanded")).toBe("true");
        tester.expect(documentTarget.hasHandler("click")).toBe(true);

        triggerButton.click();

        tester.expect(menuElement.hidden).toBe(true);
        tester.expect(triggerButton.getAttribute("aria-expanded")).toBe("false");
        tester.expect(documentTarget.hasHandler("click")).toBe(false);
    });

    tester.it("closes the menu when clicking outside", () => {
        const triggerButton = createButton();
        const menuElement = {
            hidden: true,
            contains() {
                return false;
            },
        };
        const documentTarget = createDocumentTarget();

        const controller = createProjectActionsMenuController({
            triggerButton,
            menuElement,
            documentTarget,
        });

        controller.init();
        triggerButton.click();
        documentTarget.dispatchClick();

        tester.expect(menuElement.hidden).toBe(true);
        tester.expect(triggerButton.getAttribute("aria-expanded")).toBe("false");
    });

    tester.it("closes the menu with Escape and restores trigger focus", () => {
        const triggerButton = createButton();
        const menuElement = {
            hidden: true,
            contains() {
                return false;
            },
        };
        const documentTarget = createDocumentTarget();

        const controller = createProjectActionsMenuController({
            triggerButton,
            menuElement,
            documentTarget,
        });

        controller.init();
        triggerButton.click();
        const prevented = documentTarget.dispatchEscape();

        tester.expect(prevented).toBe(true);
        tester.expect(menuElement.hidden).toBe(true);
        tester.expect(triggerButton.wasFocused()).toBe(true);
    });

    tester.it("opens Manage Members, refreshes members, and restores trigger focus when it closes", () => {
        const triggerButton = createButton();
        const manageMembersButton = createButton();
        const manageMembersCloseButton = createButton();
        const manageMembersPanel = {
            hidden: true,
        };
        const menuElement = {
            hidden: true,
            contains() {
                return false;
            },
        };
        const documentTarget = createDocumentTarget();
        let refreshCallCount = 0;

        const controller = createProjectActionsMenuController({
            triggerButton,
            menuElement,
            manageMembersButton,
            manageMembersPanel,
            manageMembersCloseButton,
            onOpenManageMembers() {
                refreshCallCount += 1;
            },
            documentTarget,
        });

        controller.init();
        triggerButton.click();
        manageMembersButton.click();

        tester.expect(manageMembersPanel.hidden).toBe(false);
        tester.expect(manageMembersButton.getAttribute("aria-expanded")).toBe("true");
        tester.expect(refreshCallCount).toBe(1);
        tester.expect(menuElement.hidden).toBe(true);

        manageMembersCloseButton.click();

        tester.expect(manageMembersPanel.hidden).toBe(true);
        tester.expect(manageMembersButton.getAttribute("aria-expanded")).toBe("false");
        tester.expect(triggerButton.wasFocused()).toBe(true);

        triggerButton.click();
        manageMembersButton.click();
        tester.expect(refreshCallCount).toBe(2);
    });

    tester.it("closes Manage Members with Escape", () => {
        const triggerButton = createButton();
        const manageMembersButton = createButton();
        const manageMembersPanel = { hidden: true };
        const menuElement = {
            hidden: true,
            contains() {
                return false;
            },
        };
        const documentTarget = createDocumentTarget();

        const controller = createProjectActionsMenuController({
            triggerButton,
            menuElement,
            manageMembersButton,
            manageMembersPanel,
            documentTarget,
        });

        controller.init();
        triggerButton.click();
        manageMembersButton.click();
        const prevented = documentTarget.dispatchEscape();

        tester.expect(prevented).toBe(true);
        tester.expect(manageMembersPanel.hidden).toBe(true);
        tester.expect(triggerButton.wasFocused()).toBe(true);
    });

    tester.it("opens Collaboration Link separately from Manage Members", () => {
        const triggerButton = createButton();
        const manageMembersButton = createButton();
        const collaborationLinkButton = createButton();
        const collaborationLinkCloseButton = createButton();
        const manageMembersPanel = { hidden: true };
        const collaborationLinkPanel = { hidden: true };
        const menuElement = {
            hidden: true,
            contains() {
                return false;
            },
        };

        const controller = createProjectActionsMenuController({
            triggerButton,
            menuElement,
            manageMembersButton,
            manageMembersPanel,
            collaborationLinkButton,
            collaborationLinkPanel,
            collaborationLinkCloseButton,
            documentTarget: null,
        });

        controller.init();
        triggerButton.click();
        collaborationLinkButton.click();

        tester.expect(collaborationLinkPanel.hidden).toBe(false);
        tester.expect(manageMembersPanel.hidden).toBe(true);
        tester.expect(collaborationLinkButton.getAttribute("aria-expanded")).toBe("true");

        collaborationLinkCloseButton.click();

        tester.expect(collaborationLinkPanel.hidden).toBe(true);
        tester.expect(collaborationLinkButton.getAttribute("aria-expanded")).toBe("false");
    });
});

tester.describe("project actions edit behavior", () => {
    tester.it("closes the menu and opens project editing from Edit Project", () => {
        const triggerButton = createButton();
        const editProjectButton = createButton();
        const menuElement = {
            hidden: true,
            contains() {
                return false;
            },
        };
        let editCallCount = 0;

        const controller = createProjectActionsMenuController({
            triggerButton,
            menuElement,
            editProjectButton,
            onEditProject() {
                editCallCount += 1;
            },
            documentTarget: null,
        });

        controller.init();
        triggerButton.click();
        editProjectButton.click();

        tester.expect(editCallCount).toBe(1);
        tester.expect(menuElement.hidden).toBe(true);
        tester.expect(triggerButton.getAttribute("aria-expanded")).toBe("false");
    });
});
