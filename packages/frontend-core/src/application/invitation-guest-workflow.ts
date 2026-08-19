import type { ApplicationRoute, ApplicationScreen } from "./application-navigation.js";
import type { InvitationSessionState } from "./application-state.js";
import type { Project, User } from "../domain/types.js";
import type { InvitationSessionStore } from "../platform/invitation-session-store.js";
import type { InvitationsService } from "../services/invitations-service.js";
import type { ProjectsService } from "../services/projects-service.js";

export const INVALID_INVITATION_MESSAGE =
  "This collaboration invitation is invalid or no longer active.";

export const CONTRIBUTOR_ACCEPTED_MESSAGE =
  "You have been added as a collaborator for this project.";

export const SIGNED_OUT_MESSAGE = "You have been signed out.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again.";
export const GUEST_SESSION_EXPIRED_MESSAGE =
  "Your account session expired. You can keep listening as a Guest or sign in again.";

export type InvitationPresentationState =
  | { status: "none" }
  | {
      status: "active";
      projectId: string;
      pendingContributor: boolean;
      audience: "guest" | "authenticated";
    };

export type InvitationWorkflowTransition = {
  route: ApplicationRoute;
  project?: Project | null;
  authMessage?: string;
  projectMenuMessage?: string;
  projectPlayerNotice?: string;
  error?: Error;
};

export interface InvitationGuestWorkflow {
  getSession(): InvitationSessionState | null;
  hasActiveInvitation(): boolean;
  getInvitationForProject(projectId: string): InvitationSessionState | null;
  getInvitedProjectForMenu(
    currentUser: User | null,
    selectedProject: Project | null,
  ): Project | null;
  getInvitationProjectIdForMenu(currentUser: User | null): string | null;
  getPresentationState(
    projectId: string,
    currentUser: User | null,
  ): InvitationPresentationState;
  canNavigateWithoutAuthentication(
    screen: ApplicationScreen,
    selectedProject: Project | null,
  ): boolean;
  loadProjectWithInvitationValidation(
    projectId: string,
    currentUser: User | null,
  ): Promise<Project>;
  resolveInvitationRequest(
    invitationToken: string,
    currentUser: User | null,
  ): Promise<InvitationWorkflowTransition>;
  resumeAfterAuthentication(
    currentUser: User,
  ): Promise<InvitationWorkflowTransition>;
  refreshInvitedProjectForMenu(
    currentUser: User,
  ): Promise<{ project?: Project | null; projectMenuMessage?: string }>;
  openProjectFromMenu(project: Project, currentUser: User | null): Promise<Project>;
  requestGuestAuthentication(): InvitationWorkflowTransition;
  acceptContributor(input: {
    selectedProject: Project | null;
    currentUser: User | null;
    currentScreen: ApplicationScreen;
  }): Promise<InvitationWorkflowTransition>;
  continueAfterLogout(): Promise<InvitationWorkflowTransition>;
  recoverAfterSessionExpiration(): Promise<InvitationWorkflowTransition>;
  clear(): void;
}

function projectPlayerRoute(projectId: string): ApplicationRoute {
  return { screen: "project-player", projectId };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(INVALID_INVITATION_MESSAGE);
}

export function createInvitationGuestWorkflow(input: {
  projects: Pick<ProjectsService, "getProject">;
  invitations: Pick<
    InvitationsService,
    "resolveGuestInvitation" | "acceptProjectInvitation"
  >;
  sessionStore?: InvitationSessionStore | null;
}): InvitationGuestWorkflow {
  const { projects, invitations, sessionStore = null } = input;
  let activeInvitation: InvitationSessionState | null = sessionStore?.get() ?? null;

  function save(session: InvitationSessionState): void {
    activeInvitation = session;
    sessionStore?.save(session);
  }

  function clear(): void {
    activeInvitation = null;
    sessionStore?.clear();
  }

  function getInvitationForProject(projectId: string): InvitationSessionState | null {
    return activeInvitation?.projectId === projectId ? activeInvitation : null;
  }

  async function loadProjectWithInvitationValidation(
    projectId: string,
    currentUser: User | null,
  ): Promise<Project> {
    const invitation = getInvitationForProject(projectId);

    if (!invitation) {
      return projects.getProject(projectId);
    }

    try {
      const resolvedInvitation = await invitations.resolveGuestInvitation(invitation.token);

      if (resolvedInvitation.projectId !== projectId) {
        throw new Error(INVALID_INVITATION_MESSAGE);
      }

      return await projects.getProject(projectId, invitation.token);
    } catch {
      clear();

      if (currentUser) {
        try {
          return await projects.getProject(projectId);
        } catch {
          // The authenticated account does not independently have project access.
        }
      }

      throw new Error(INVALID_INVITATION_MESSAGE);
    }
  }

  async function resolveInvitationRequest(
    invitationToken: string,
    currentUser: User | null,
  ): Promise<InvitationWorkflowTransition> {
    try {
      const resolvedInvitation = await invitations.resolveGuestInvitation(invitationToken);
      const existingPendingState =
        activeInvitation?.token === invitationToken
          ? activeInvitation.pendingContributor
          : false;

      save({
        projectId: resolvedInvitation.projectId,
        token: invitationToken,
        pendingContributor: existingPendingState,
      });

      const project = await projects.getProject(
        resolvedInvitation.projectId,
        invitationToken,
      );

      return {
        route: projectPlayerRoute(resolvedInvitation.projectId),
        project,
        projectPlayerNotice: "",
      };
    } catch {
      clear();

      if (currentUser) {
        return {
          route: { screen: "project-menu" },
          project: null,
          projectMenuMessage: INVALID_INVITATION_MESSAGE,
        };
      }

      return {
        route: { screen: "auth" },
        project: null,
        authMessage: INVALID_INVITATION_MESSAGE,
      };
    }
  }

  async function resumeAfterAuthentication(
    currentUser: User,
  ): Promise<InvitationWorkflowTransition> {
    if (!activeInvitation) {
      return { route: { screen: "project-menu" } };
    }

    try {
      const project = await loadProjectWithInvitationValidation(
        activeInvitation.projectId,
        currentUser,
      );
      return { route: projectPlayerRoute(project.id), project };
    } catch {
      return {
        route: { screen: "project-menu" },
        project: null,
        projectMenuMessage: INVALID_INVITATION_MESSAGE,
      };
    }
  }

  async function refreshInvitedProjectForMenu(
    currentUser: User,
  ): Promise<{ project?: Project | null; projectMenuMessage?: string }> {
    if (!activeInvitation) {
      return {};
    }

    try {
      return {
        project: await loadProjectWithInvitationValidation(
          activeInvitation.projectId,
          currentUser,
        ),
      };
    } catch {
      return {
        project: null,
        projectMenuMessage: INVALID_INVITATION_MESSAGE,
      };
    }
  }

  async function openProjectFromMenu(project: Project, currentUser: User | null): Promise<Project> {
    if (!getInvitationForProject(project.id)) {
      return project;
    }

    try {
      return await loadProjectWithInvitationValidation(project.id, currentUser);
    } catch {
      throw new Error(INVALID_INVITATION_MESSAGE);
    }
  }

  function requestGuestAuthentication(): InvitationWorkflowTransition {
    return {
      route: { screen: "auth" },
      authMessage: activeInvitation?.pendingContributor
        ? "Log in or create an account, then return to the project to accept the Contributor invitation."
        : "Log in or create an account to continue with this collaboration invitation.",
    };
  }

  async function acceptContributor({
    selectedProject,
    currentUser,
    currentScreen,
  }: {
    selectedProject: Project | null;
    currentUser: User | null;
    currentScreen: ApplicationScreen;
  }): Promise<InvitationWorkflowTransition> {
    if (!selectedProject) {
      throw new Error("No invited project is open.");
    }

    const invitation = getInvitationForProject(selectedProject.id);

    if (!invitation) {
      throw new Error(
        "This collaboration invitation is no longer available in this browser session.",
      );
    }

    if (!currentUser) {
      const pendingSession = {
        ...invitation,
        pendingContributor: true,
      };
      activeInvitation = pendingSession;
      sessionStore?.setPendingContributor(true);
      return requestGuestAuthentication();
    }

    const projectId = invitation.projectId;

    try {
      await invitations.acceptProjectInvitation(invitation.token);
    } catch (error) {
      clear();

      if (currentScreen === "project-player") {
        try {
          const project = await projects.getProject(projectId);
          return {
            route: projectPlayerRoute(projectId),
            project,
            projectPlayerNotice: INVALID_INVITATION_MESSAGE,
            error: asError(error),
          };
        } catch {
          return {
            route: { screen: "project-menu" },
            project: null,
            projectMenuMessage: INVALID_INVITATION_MESSAGE,
            error: asError(error),
          };
        }
      }

      return {
        route: { screen: "project-menu" },
        project: null,
        projectMenuMessage: INVALID_INVITATION_MESSAGE,
        error: asError(error),
      };
    }

    clear();
    const project = await projects.getProject(projectId);

    return {
      route: projectPlayerRoute(projectId),
      project,
      authMessage: "",
      projectMenuMessage: "",
      projectPlayerNotice: CONTRIBUTOR_ACCEPTED_MESSAGE,
    };
  }

  async function continueAfterLogout(): Promise<InvitationWorkflowTransition> {
    if (activeInvitation) {
      try {
        const project = await projects.getProject(
          activeInvitation.projectId,
          activeInvitation.token,
        );
        return {
          route: projectPlayerRoute(project.id),
          project,
          authMessage: "",
        };
      } catch {
        clear();
      }
    }

    return {
      route: { screen: "auth" },
      project: null,
      authMessage: SIGNED_OUT_MESSAGE,
    };
  }

  async function recoverAfterSessionExpiration(): Promise<InvitationWorkflowTransition> {
    if (activeInvitation) {
      try {
        const project = await projects.getProject(
          activeInvitation.projectId,
          activeInvitation.token,
        );
        return {
          route: projectPlayerRoute(project.id),
          project,
          authMessage: GUEST_SESSION_EXPIRED_MESSAGE,
        };
      } catch {
        clear();
      }
    }

    return {
      route: { screen: "auth" },
      project: null,
      authMessage: SESSION_EXPIRED_MESSAGE,
    };
  }

  return {
    getSession() {
      return activeInvitation ? { ...activeInvitation } : null;
    },
    hasActiveInvitation() {
      return activeInvitation !== null;
    },
    getInvitationForProject,
    getInvitedProjectForMenu(currentUser, selectedProject) {
      if (
        !currentUser ||
        !activeInvitation ||
        selectedProject?.id !== activeInvitation.projectId
      ) {
        return null;
      }
      return selectedProject;
    },
    getInvitationProjectIdForMenu(currentUser) {
      return currentUser ? activeInvitation?.projectId ?? null : null;
    },
    getPresentationState(projectId, currentUser) {
      const invitation = getInvitationForProject(projectId);
      if (!invitation) {
        return { status: "none" };
      }
      return {
        status: "active",
        projectId: invitation.projectId,
        pendingContributor: invitation.pendingContributor,
        audience: currentUser ? "authenticated" : "guest",
      };
    },
    canNavigateWithoutAuthentication(screen, selectedProject) {
      if (screen === "auth" || screen === "invitation") {
        return true;
      }
      return Boolean(
        screen === "project-player" &&
          selectedProject &&
          getInvitationForProject(selectedProject.id),
      );
    },
    loadProjectWithInvitationValidation,
    resolveInvitationRequest,
    resumeAfterAuthentication,
    refreshInvitedProjectForMenu,
    openProjectFromMenu,
    requestGuestAuthentication,
    acceptContributor,
    continueAfterLogout,
    recoverAfterSessionExpiration,
    clear,
  };
}
