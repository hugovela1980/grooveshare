import {
  CONTRIBUTOR_ACCEPTED_MESSAGE,
  INVALID_INVITATION_MESSAGE,
  createInvitationGuestWorkflow,
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

const guestProject: Project = {
  id: "project-1",
  title: "Song",
  description: "Demo",
  role: null,
  access: "guest",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const contributorProject: Project = {
  ...guestProject,
  role: "contributor",
  access: undefined,
};

function createSessionStore(initial: InvitationSessionState | null = null) {
  let session = initial ? { ...initial } : null;
  let clearCount = 0;

  const store: InvitationSessionStore = {
    get() {
      return session ? { ...session } : null;
    },
    save(next) {
      session = { ...next };
    },
    setPendingContributor(pendingContributor) {
      if (session) {
        session = { ...session, pendingContributor };
      }
    },
    clear() {
      clearCount += 1;
      session = null;
    },
  };

  return {
    store,
    getSession: () => (session ? { ...session } : null),
    getClearCount: () => clearCount,
  };
}

function createHarness(input: {
  initialSession?: InvitationSessionState | null;
  resolveProjectId?: string;
  resolveError?: Error | null;
  acceptError?: Error | null;
  invitedProjectError?: Error | null;
  memberProjectError?: Error | null;
} = {}) {
  const sessions = createSessionStore(input.initialSession ?? null);
  const projectCalls: Array<{ projectId: string; token?: string }> = [];
  const acceptedTokens: string[] = [];

  const workflow = createInvitationGuestWorkflow({
    sessionStore: sessions.store,
    invitations: {
      async resolveGuestInvitation() {
        if (input.resolveError) throw input.resolveError;
        return { projectId: input.resolveProjectId ?? "project-1" };
      },
      async acceptProjectInvitation(token) {
        acceptedTokens.push(token);
        if (input.acceptError) throw input.acceptError;
        return { projectId: "project-1", role: "contributor" as const };
      },
    },
    projects: {
      async getProject(projectId, token) {
        projectCalls.push({ projectId, ...(token ? { token } : {}) });
        if (token) {
          if (input.invitedProjectError) throw input.invitedProjectError;
          return { ...guestProject, id: projectId };
        }
        if (input.memberProjectError) throw input.memberProjectError;
        return { ...contributorProject, id: projectId };
      },
    },
  });

  return { workflow, sessions, projectCalls, acceptedTokens };
}

tester.describe("InvitationGuestWorkflow", () => {
  tester.it("opens a Guest invitation and persists the shared invitation state", async () => {
    const { workflow, sessions, projectCalls } = createHarness();

    const transition = await workflow.resolveInvitationRequest("raw-token", null);

    tester.expect(transition.route.screen).toBe("project-player");
    tester.expect(transition.project?.access).toBe("guest");
    tester.expect(sessions.getSession()?.token).toBe("raw-token");
    tester.expect(sessions.getSession()?.pendingContributor).toBe(false);
    tester.expect(projectCalls[0]?.token).toBe("raw-token");
  });

  tester.it("preserves pending Contributor intent when the same invitation is reopened", async () => {
    const { workflow, sessions } = createHarness({
      initialSession: {
        projectId: "project-1",
        token: "same-token",
        pendingContributor: true,
      },
    });

    await workflow.resolveInvitationRequest("same-token", null);

    tester.expect(sessions.getSession()?.pendingContributor).toBe(true);
  });

  tester.it("clears a revoked invitation and falls back to authenticated member access", async () => {
    const { workflow, sessions, projectCalls } = createHarness({
      initialSession: {
        projectId: "project-1",
        token: "revoked-token",
        pendingContributor: false,
      },
      resolveError: new Error("revoked"),
    });

    const project = await workflow.loadProjectWithInvitationValidation(
      "project-1",
      user,
    );

    tester.expect(project.role).toBe("contributor");
    tester.expect(sessions.getSession()).toBe(null);
    tester.expect(projectCalls[0]?.token).toBe(undefined);
  });

  tester.it("routes an invalid anonymous invitation to authentication with the shared message", async () => {
    const { workflow, sessions } = createHarness({
      resolveError: new Error("revoked"),
    });

    const transition = await workflow.resolveInvitationRequest("bad-token", null);

    tester.expect(transition.route.screen).toBe("auth");
    tester.expect(transition.authMessage).toBe(INVALID_INVITATION_MESSAGE);
    tester.expect(sessions.getSession()).toBe(null);
  });

  tester.it("marks Contributor intent before sending a Guest to authentication", async () => {
    const { workflow, sessions } = createHarness({
      initialSession: {
        projectId: "project-1",
        token: "invite-token",
        pendingContributor: false,
      },
    });

    const transition = await workflow.acceptContributor({
      selectedProject: guestProject,
      currentUser: null,
      currentScreen: "project-player",
    });

    tester.expect(transition.route.screen).toBe("auth");
    tester.expect(sessions.getSession()?.pendingContributor).toBe(true);
    tester.expect(transition.authMessage?.includes("accept the Contributor invitation")).toBe(true);
  });

  tester.it("accepts Contributor membership once and reloads authenticated project state", async () => {
    const { workflow, sessions, acceptedTokens } = createHarness({
      initialSession: {
        projectId: "project-1",
        token: "invite-token",
        pendingContributor: true,
      },
    });

    const transition = await workflow.acceptContributor({
      selectedProject: guestProject,
      currentUser: user,
      currentScreen: "project-player",
    });

    tester.expect(acceptedTokens.length).toBe(1);
    tester.expect(transition.route.screen).toBe("project-player");
    tester.expect(transition.project?.role).toBe("contributor");
    tester.expect(transition.projectPlayerNotice).toBe(CONTRIBUTOR_ACCEPTED_MESSAGE);
    tester.expect(sessions.getSession()).toBe(null);
  });

  tester.it("keeps an authenticated member on the player when acceptance fails after revocation", async () => {
    const { workflow, sessions } = createHarness({
      initialSession: {
        projectId: "project-1",
        token: "invite-token",
        pendingContributor: true,
      },
      acceptError: new Error("invitation disabled"),
    });

    const transition = await workflow.acceptContributor({
      selectedProject: guestProject,
      currentUser: user,
      currentScreen: "project-player",
    });

    tester.expect(transition.route.screen).toBe("project-player");
    tester.expect(transition.projectPlayerNotice).toBe(INVALID_INVITATION_MESSAGE);
    tester.expect(transition.error?.message).toBe("invitation disabled");
    tester.expect(sessions.getSession()).toBe(null);
  });

  tester.it("continues as Guest after logout when the invitation still works", async () => {
    const { workflow } = createHarness({
      initialSession: {
        projectId: "project-1",
        token: "invite-token",
        pendingContributor: false,
      },
    });

    const transition = await workflow.continueAfterLogout();

    tester.expect(transition.route.screen).toBe("project-player");
    tester.expect(transition.project?.access).toBe("guest");
  });

  tester.it("recovers an expired authenticated session into Guest listening", async () => {
    const { workflow } = createHarness({
      initialSession: {
        projectId: "project-1",
        token: "invite-token",
        pendingContributor: false,
      },
    });

    const transition = await workflow.recoverAfterSessionExpiration();

    tester.expect(transition.route.screen).toBe("project-player");
    tester.expect(transition.authMessage?.includes("keep listening as a Guest")).toBe(true);
  });

  tester.it("exposes invitation presentation state without leaking presentation behavior into the workflow", () => {
    const { workflow } = createHarness({
      initialSession: {
        projectId: "project-1",
        token: "invite-token",
        pendingContributor: true,
      },
    });

    const state = workflow.getPresentationState("project-1", user);

    tester.expect(state.status).toBe("active");
    if (state.status === "active") {
      tester.expect(state.audience).toBe("authenticated");
      tester.expect(state.pendingContributor).toBe(true);
    }
    tester.expect(
      workflow.getPresentationState("another-project", user).status,
    ).toBe("none");
  });
});
