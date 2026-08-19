import {
  ApiError,
  CONTRIBUTOR_ACCEPTED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  createGrooveShareApplicationController,
  type ApplicationPresentationPort,
  type InvitationSessionState,
  type InvitationSessionStore,
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

const memberProject: Project = {
  id: "project-1",
  title: "Shared Song",
  description: "Controller test",
  role: "contributor",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const guestProject: Project = {
  ...memberProject,
  role: null,
  access: "guest",
};

function createInvitationSessionStore(
  initialSession: InvitationSessionState | null = null,
): InvitationSessionStore {
  let session = initialSession ? { ...initialSession } : null;

  return {
    get() {
      return session ? { ...session } : null;
    },
    save(nextSession) {
      session = { ...nextSession };
    },
    setPendingContributor(pendingContributor) {
      if (session) {
        session = { ...session, pendingContributor };
      }
    },
    clear() {
      session = null;
    },
  };
}

function createHarness(input: {
  authenticated?: boolean;
  sessionError?: Error | null;
  initialInvitation?: InvitationSessionState | null;
} = {}) {
  let logoutCallCount = 0;
  let draftClearCount = 0;
  const projectCalls: Array<{ projectId: string; token?: string }> = [];
  const acceptedTokens: string[] = [];

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
    showProjectPlayer({ project, invitation, statusMessage }) {
      return `player:${project?.id ?? "none"}:${invitation.status}:${statusMessage}`;
    },
    showLoading({ message }) {
      return `loading:${message}`;
    },
    showError({ message }) {
      return `error:${message}`;
    },
  } satisfies ApplicationPresentationPort<string>;

  const controller = createGrooveShareApplicationController({
    sessionProvider: {
      async getCurrentUser() {
        if (input.sessionError) {
          throw input.sessionError;
        }
        if (input.authenticated === false) {
          throw new ApiError("Authentication required.", 401);
        }
        return user;
      },
      async login() {
        return user;
      },
      async registerUser() {
        return user;
      },
      async logout() {
        logoutCallCount += 1;
      },
    },
    projects: {
      async getProject(projectId, token) {
        projectCalls.push({ projectId, ...(token ? { token } : {}) });
        return token
          ? { ...guestProject, id: projectId }
          : { ...memberProject, id: projectId };
      },
    },
    invitations: {
      async resolveGuestInvitation() {
        return { projectId: "project-1" };
      },
      async acceptProjectInvitation(token) {
        acceptedTokens.push(token);
        return {
          projectId: "project-1",
          role: "contributor" as const,
        };
      },
    },
    invitationSessionStore: createInvitationSessionStore(
      input.initialInvitation ?? null,
    ),
    presentationPort: presentation,
    projectDraft: {
      getProjectDraft() {
        return { title: "Draft", description: "Demo" };
      },
      clear() {
        draftClearCount += 1;
      },
    },
  });

  return {
    controller,
    projectCalls,
    acceptedTokens,
    getLogoutCallCount: () => logoutCallCount,
    getDraftClearCount: () => draftClearCount,
  };
}

tester.describe("GrooveShareApplicationController", () => {
  tester.it("restores authentication and owns the initial Projects route", async () => {
    const { controller } = createHarness();

    const route = await controller.initialize({ screen: "project-menu" });

    tester.expect(route).toEqual({ screen: "project-menu" });
    tester.expect(controller.getCurrentUser()).toEqual(user);
    tester.expect(controller.getState().authentication.status).toBe("authenticated");
    tester.expect(controller.present("project-menu")).toBe("projects:user-1:");
  });

  tester.it("routes an anonymous startup to authentication without presentation-specific logic", async () => {
    const { controller } = createHarness({ authenticated: false });

    const route = await controller.initialize({ screen: "project-menu" });

    tester.expect(route).toEqual({ screen: "auth" });
    tester.expect(controller.getCurrentUser()).toBe(null);
    tester.expect(controller.getState().authentication.status).toBe("anonymous");
    tester.expect(controller.present("auth")).toBe("auth:");
  });

  tester.it("owns selected-project state and restores a Project Player deep link", async () => {
    const { controller, projectCalls } = createHarness();

    const route = await controller.initialize({
      screen: "project-player",
      projectId: "project-1",
    });

    tester.expect(route).toEqual({
      screen: "project-player",
      projectId: "project-1",
    });
    tester.expect(controller.getSelectedProject()?.id).toBe("project-1");
    tester.expect(projectCalls.length).toBe(1);
    tester.expect(controller.present("project-player")).toBe(
      "player:project-1:none:",
    );
  });

  tester.it("owns application navigation protection for unauthenticated clients", async () => {
    const { controller } = createHarness({ authenticated: false });

    await controller.initialize({ screen: "auth" });

    tester.expect(controller.resolveNavigation("project-menu")).toEqual({
      screen: "auth",
    });
    tester.expect(controller.resolveBackNavigation("project-menu")).toEqual({
      screen: "auth",
    });
  });

  tester.it("integrates Guest invitation state into the main application controller", async () => {
    const { controller, projectCalls } = createHarness({ authenticated: false });

    const route = await controller.initialize({
      screen: "invitation",
      invitationToken: "invite-token",
    });

    tester.expect(route).toEqual({
      screen: "project-player",
      projectId: "project-1",
    });
    tester.expect(controller.getCurrentUser()).toBe(null);
    tester.expect(controller.getInvitationSession()?.token).toBe("invite-token");
    tester.expect(projectCalls[0]?.token).toBe("invite-token");
    tester.expect(controller.present("project-player")).toBe(
      "player:project-1:active:",
    );
  });

  tester.it("continues a pending invitation through authentication and explicit Contributor acceptance", async () => {
    const { controller, acceptedTokens } = createHarness({
      authenticated: false,
      initialInvitation: {
        projectId: "project-1",
        token: "invite-token",
        pendingContributor: true,
      },
    });

    await controller.initialize({
      screen: "project-player",
      projectId: "project-1",
    });

    const resumedRoute = await controller.completeAuthentication(user);
    tester.expect(resumedRoute.screen).toBe("project-player");

    const result = await controller.acceptContributor("project-player");

    tester.expect(result.route.screen).toBe("project-player");
    tester.expect(acceptedTokens).toEqual(["invite-token"]);
    tester.expect(controller.getInvitationSession()).toBe(null);
    tester.expect(controller.present("project-player")).toBe(
      `player:project-1:none:${CONTRIBUTOR_ACCEPTED_MESSAGE}`,
    );
  });

  tester.it("owns logout state transition while leaving error rendering to the client", async () => {
    const {
      controller,
      getLogoutCallCount,
      getDraftClearCount,
    } = createHarness();

    await controller.initialize({ screen: "project-menu" });
    const result = await controller.logout();

    tester.expect(result.ok).toBe(true);
    if (result.ok) {
      tester.expect(result.route).toEqual({ screen: "auth" });
    }
    tester.expect(getLogoutCallCount()).toBe(1);
    tester.expect(getDraftClearCount()).toBe(1);
    tester.expect(controller.getCurrentUser()).toBe(null);
    tester.expect(controller.present("auth")).toBe(`auth:${SIGNED_OUT_MESSAGE}`);
  });

  tester.it("owns expired-session recovery and clears protected application state", async () => {
    const { controller, getDraftClearCount } = createHarness();

    await controller.initialize({ screen: "project-menu" });
    const route = await controller.recoverAfterSessionExpiration();

    tester.expect(route).toEqual({ screen: "auth" });
    tester.expect(getDraftClearCount()).toBe(1);
    tester.expect(controller.getCurrentUser()).toBe(null);
    tester.expect(
      controller.present("auth").includes("Your session has expired"),
    ).toBe(true);
  });

  tester.it("exposes loading presentation through the shared controller for history navigation", async () => {
    const { controller } = createHarness();

    await controller.initialize({ screen: "project-menu" });

    tester.expect(
      controller.presentHistoryNavigationLoading({
        screen: "project-player",
        projectId: "project-1",
      }),
    ).toBe("loading:Loading your project...");
    tester.expect(controller.getState().loading.status).toBe("loading");
  });

  tester.it("records session restoration failures without blocking Guest-capable routing", async () => {
    const { controller } = createHarness({
      sessionError: new Error("network unavailable"),
    });

    const route = await controller.initialize({ screen: "auth" });

    tester.expect(route).toEqual({ screen: "auth" });
    tester.expect(controller.getState().error?.context).toBe("authentication");
    tester.expect(
      controller.present("auth").includes("Could not restore your account session"),
    ).toBe(true);
  });
});
