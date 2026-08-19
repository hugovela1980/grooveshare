import {
  createBrowserGrooveShareApp,
  type BrowserGrooveSharePageContext,
} from "../src/index.js";
import type {
  ApplicationProjectDraftPort,
  Project,
  User,
} from "@hugovela/frontend-core";
import { tester } from "./test-runner/tester.js";

const user: User = {
  id: "user-1",
  email: "musician@example.com",
  displayName: "Musician",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const project: Project = {
  id: "project-1",
  title: "Song",
  description: "Demo",
  role: "owner",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

tester.describe("frontend-browser GrooveShare application shell", () => {
  tester.it("bridges the shared controller to a presentation page initializer", async () => {
    const appElement = { innerHTML: "" };
    const initializedScreens: string[] = [];
    let authenticationRequiredHandler: (() => void) | null = null;

    const projectDraft: ApplicationProjectDraftPort = {
      getProjectDraft() {
        return { title: "Draft", description: "Demo" };
      },
      clear() {},
    };

    const app = createBrowserGrooveShareApp({
      appElement,
      initialScreen: "project-menu",
      sessionProvider: {
        async registerUser() { return user; },
        async login() { return user; },
        async logout() {},
        async getCurrentUser() { return user; },
      },
      presentationPort: {
        showAuthentication() { return "auth"; },
        showProjects() { return "projects"; },
        showCreateProject() { return "create"; },
        showProjectPlayer() { return "player"; },
        showLoading() { return "loading"; },
        showError() { return "error"; },
      },
      projectDraft,
      projects: {
        async getProject() { return project; },
      },
      invitations: {
        async resolveGuestInvitation() { return { projectId: project.id }; },
        async acceptProjectInvitation() {
          return { projectId: project.id, role: "contributor" };
        },
      },
      transport: {
        setAuthenticationRequiredHandler(handler) {
          authenticationRequiredHandler = handler;
        },
      },
      initializePage(
        context: BrowserGrooveSharePageContext<ApplicationProjectDraftPort>,
      ) {
        initializedScreens.push(context.currentScreen);
        return null;
      },
      showLogoutError() {},
    });

    await app.start();

    tester.expect(appElement.innerHTML).toBe("projects");
    tester.expect(initializedScreens).toEqual(["project-menu"]);
    tester.expect(app.getCurrentUser()).toEqual(user);
    tester.expect(Boolean(authenticationRequiredHandler)).toBe(true);

    app.navigateTo("create-project");

    tester.expect(appElement.innerHTML).toBe("create");
    tester.expect(initializedScreens).toEqual([
      "project-menu",
      "create-project",
    ]);
  });
});
