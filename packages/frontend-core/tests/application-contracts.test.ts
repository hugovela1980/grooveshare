import {
  createInitialApplicationState,
  type ApplicationAction,
  type ApplicationActionPort,
  type ApplicationNavigationPort,
  type ApplicationPresentationPort,
  type ApplicationRoute,
  type Project,
  type User,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

const user: User = {
  id: "user-1",
  email: "musician@example.com",
  displayName: "Musician",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const guestProject: Project = {
  id: "project-1",
  title: "Song Idea",
  description: "Shared through an invitation",
  role: null,
  access: "guest",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

tester.describe("frontend-core application contracts", () => {
  tester.it("creates presentation-independent initial application state", () => {
    tester.expect(createInitialApplicationState()).toEqual({
      authentication: {
        status: "restoring",
        user: null,
      },
      selectedProject: null,
      invitation: null,
      loading: {
        status: "idle",
      },
      error: null,
    });
  });

  tester.it("represents Guest project access in the shared domain", () => {
    tester.expect(guestProject.role).toBe(null);
    tester.expect(guestProject.access).toBe("guest");
  });

  tester.it("keeps presentation output generic while sharing presentation meaning", () => {
    const presentation = {
      showAuthentication({ message }) {
        return `auth:${message}`;
      },
      showProjects({ currentUser, statusMessage }) {
        return `projects:${currentUser?.id ?? "anonymous"}:${statusMessage}`;
      },
      showCreateProject({ projectDraft }) {
        return `create:${projectDraft?.title ?? "empty"}`;
      },
      showProjectPlayer({ project, statusMessage }) {
        return `player:${project?.id ?? "none"}:${statusMessage}`;
      },
      showLoading({ message }) {
        return `loading:${message}`;
      },
      showError({ message }) {
        return `error:${message}`;
      },
    } satisfies ApplicationPresentationPort<string>;

    tester.expect(
      presentation.showProjects({
        currentUser: user,
        statusMessage: "Ready",
      }),
    ).toBe("projects:user-1:Ready");

    tester.expect(
      presentation.showProjectPlayer({
        project: guestProject,
        currentUser: null,
        invitation: {
          status: "active",
          projectId: "project-1",
          pendingContributor: false,
          audience: "guest",
        },
        statusMessage: "",
      }),
    ).toBe("player:project-1:");
  });

  tester.it("defines shared route and user-action vocabulary", async () => {
    const navigatedRoutes: ApplicationRoute[] = [];
    const dispatchedActions: ApplicationAction[] = [];

    const navigation = {
      navigateTo(route) {
        navigatedRoutes.push(route);
      },
      goBack(fallbackRoute) {
        navigatedRoutes.push(fallbackRoute);
      },
    } satisfies ApplicationNavigationPort;

    const actions = {
      dispatch(action) {
        dispatchedActions.push(action);
      },
    } satisfies ApplicationActionPort;

    const route: ApplicationRoute = {
      screen: "project-player",
      projectId: "project-1",
    };
    const action: ApplicationAction = {
      type: "open-project",
      projectId: "project-1",
    };

    navigation.navigateTo(route);
    await actions.dispatch(action);

    tester.expect(navigatedRoutes).toEqual([route]);
    tester.expect(dispatchedActions).toEqual([action]);
  });
});
