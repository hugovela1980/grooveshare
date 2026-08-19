import type { CreateProjectInput, Project, User } from "../domain/types.js";
import type { InvitationSessionStore } from "../platform/invitation-session-store.js";
import type { SessionProvider } from "../platform/session-provider.js";
import { ApiError } from "../services/api-transport.js";
import type { InvitationsService } from "../services/invitations-service.js";
import type { ProjectsService } from "../services/projects-service.js";
import type {
  ApplicationRoute,
  ApplicationScreen,
} from "./application-navigation.js";
import type { ApplicationPresentationPort } from "./application-presentation.js";
import type {
  ApplicationErrorState,
  ApplicationLoadingState,
  AuthenticationState,
  GrooveShareApplicationState,
  InvitationSessionState,
} from "./application-state.js";
import {
  INVALID_INVITATION_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  createInvitationGuestWorkflow,
  type InvitationGuestWorkflow,
  type InvitationWorkflowTransition,
} from "./invitation-guest-workflow.js";

export type ApplicationProjectDraftPort = {
  getProjectDraft(): CreateProjectInput | null;
  clear(): void;
};

export type ApplicationActionResult = {
  route: ApplicationRoute;
  error?: Error;
};

export type ApplicationLogoutResult =
  | {
      ok: true;
      route: ApplicationRoute;
    }
  | {
      ok: false;
      errorMessage: string;
    };

export interface GrooveShareApplicationController<TPresentationOutput = void> {
  initialize(requestedRoute: ApplicationRoute): Promise<ApplicationRoute>;
  resolveRequestedRoute(requestedRoute: ApplicationRoute): Promise<ApplicationRoute>;
  resolveNavigation(screen: ApplicationScreen): ApplicationRoute;
  resolveBackNavigation(screen: ApplicationScreen): ApplicationRoute;
  routesMatch(first: ApplicationRoute, second: ApplicationRoute): boolean;
  present(screen: ApplicationScreen): TPresentationOutput;
  presentHistoryNavigationLoading(
    route: ApplicationRoute,
  ): TPresentationOutput | null;
  getState(): GrooveShareApplicationState;
  getCurrentUser(): User | null;
  getSelectedProject(): Project | null;
  setSelectedProject(project: Project | null): void;
  getActiveInvitedProjectForMenu(): Project | null;
  getActiveInvitationProjectId(): string | null;
  getInvitationSession(): InvitationSessionState | null;
  completeAuthentication(user: User): Promise<ApplicationRoute>;
  requestGuestAuthentication(): ApplicationRoute;
  openProjectFromMenu(project: Project): Promise<ApplicationRoute>;
  acceptContributor(currentScreen: ApplicationScreen): Promise<ApplicationActionResult>;
  logout(): Promise<ApplicationLogoutResult>;
  recoverAfterSessionExpiration(): Promise<ApplicationRoute | null>;
}

function asCurrentUser(authentication: AuthenticationState): User | null {
  return authentication.status === "authenticated"
    ? authentication.user
    : null;
}

function copyAuthenticationState(
  authentication: AuthenticationState,
): AuthenticationState {
  if (authentication.status === "authenticated") {
    return {
      status: "authenticated",
      user: authentication.user,
    };
  }

  return {
    status: authentication.status,
    user: null,
  };
}

/**
 * Shared GrooveShare application state machine.
 *
 * This controller owns application meaning and transitions. It deliberately
 * does not know about DOM nodes, HTML, CSS, browser history, mobile navigation,
 * or desktop interaction details. Concrete clients render the presentation
 * states and apply the routes returned here through their platform adapters.
 */
export function createGrooveShareApplicationController<TPresentationOutput>(input: {
  sessionProvider: SessionProvider;
  projects: Pick<ProjectsService, "getProject">;
  invitations: Pick<
    InvitationsService,
    "resolveGuestInvitation" | "acceptProjectInvitation"
  >;
  invitationSessionStore?: InvitationSessionStore | null;
  presentationPort: ApplicationPresentationPort<TPresentationOutput>;
  projectDraft: ApplicationProjectDraftPort;
}): GrooveShareApplicationController<TPresentationOutput> {
  const {
    sessionProvider,
    projects,
    invitations,
    invitationSessionStore = null,
    presentationPort,
    projectDraft,
  } = input;

  let authentication: AuthenticationState = {
    status: "restoring",
    user: null,
  };
  let selectedProject: Project | null = null;
  let loading: ApplicationLoadingState = { status: "idle" };
  let error: ApplicationErrorState = null;
  let authMessage = "";
  let projectMenuMessage = "";
  let projectPlayerNotice = "";

  const invitationWorkflow: InvitationGuestWorkflow =
    createInvitationGuestWorkflow({
      projects,
      invitations,
      sessionStore: invitationSessionStore,
    });

  function getCurrentUser(): User | null {
    return asCurrentUser(authentication);
  }

  function setSelectedProject(project: Project | null): void {
    selectedProject = project;
  }

  function getState(): GrooveShareApplicationState {
    return {
      authentication: copyAuthenticationState(authentication),
      selectedProject,
      invitation: invitationWorkflow.getSession(),
      loading: loading.status === "loading"
        ? { status: "loading", message: loading.message }
        : { status: "idle" },
      error: error ? { ...error } : null,
    };
  }

  function getActiveInvitedProjectForMenu(): Project | null {
    return invitationWorkflow.getInvitedProjectForMenu(
      getCurrentUser(),
      selectedProject,
    );
  }

  function getActiveInvitationProjectId(): string | null {
    return invitationWorkflow.getInvitationProjectIdForMenu(getCurrentUser());
  }

  function applyInvitationTransition(
    transition: InvitationWorkflowTransition,
  ): ApplicationRoute {
    if (transition.project !== undefined) {
      selectedProject = transition.project;
    }
    if (transition.authMessage !== undefined) {
      authMessage = transition.authMessage;
    }
    if (transition.projectMenuMessage !== undefined) {
      projectMenuMessage = transition.projectMenuMessage;
    }
    if (transition.projectPlayerNotice !== undefined) {
      projectPlayerNotice = transition.projectPlayerNotice;
    }
    error = transition.error
      ? {
          context: "invitation",
          message: transition.error.message,
        }
      : null;

    return transition.route;
  }

  function getRouteForScreen(screen: ApplicationScreen): ApplicationRoute {
    if (screen === "project-player" && selectedProject) {
      return {
        screen,
        projectId: selectedProject.id,
      };
    }

    return { screen };
  }

  function routesMatch(
    first: ApplicationRoute,
    second: ApplicationRoute,
  ): boolean {
    return (
      first.screen === second.screen &&
      first.projectId === second.projectId &&
      first.invitationToken === second.invitationToken
    );
  }

  async function resolveRequestedRouteInternal(
    requestedRoute: ApplicationRoute,
  ): Promise<ApplicationRoute> {
    const currentUser = getCurrentUser();

    if (requestedRoute.screen === "invitation") {
      if (!requestedRoute.invitationToken) {
        return currentUser
          ? { screen: "project-menu" }
          : { screen: "auth" };
      }

      const transition = await invitationWorkflow.resolveInvitationRequest(
        requestedRoute.invitationToken,
        currentUser,
      );
      return applyInvitationTransition(transition);
    }

    if (requestedRoute.screen === "auth") {
      if (!currentUser) {
        return requestedRoute;
      }

      if (!invitationWorkflow.hasActiveInvitation()) {
        return { screen: "project-menu" };
      }

      const transition = await invitationWorkflow.resumeAfterAuthentication(
        currentUser,
      );
      return applyInvitationTransition(transition);
    }

    if (requestedRoute.screen === "project-menu") {
      if (!currentUser) {
        return { screen: "auth" };
      }

      if (invitationWorkflow.hasActiveInvitation()) {
        const result = await invitationWorkflow.refreshInvitedProjectForMenu(
          currentUser,
        );
        if (result.project !== undefined) {
          selectedProject = result.project;
        }
        if (result.projectMenuMessage !== undefined) {
          projectMenuMessage = result.projectMenuMessage;
        }
      }

      return requestedRoute;
    }

    if (requestedRoute.screen === "create-project") {
      return currentUser
        ? requestedRoute
        : { screen: "auth" };
    }

    const projectId =
      requestedRoute.projectId ?? selectedProject?.id ?? null;

    if (!projectId) {
      selectedProject = null;
      return currentUser
        ? { screen: "project-menu" }
        : { screen: "auth" };
    }

    const hadInvitation = Boolean(
      invitationWorkflow.getInvitationForProject(projectId),
    );

    try {
      if (hadInvitation) {
        // Invitation-backed routes are always revalidated before Project Player
        // presentation, so browser history cannot revive a revoked link.
        selectedProject =
          await invitationWorkflow.loadProjectWithInvitationValidation(
            projectId,
            currentUser,
          );
      } else if (
        selectedProject?.id === projectId &&
        selectedProject.access !== "guest"
      ) {
        // Normal authenticated member navigation may safely reuse the current
        // client snapshot during in-app navigation.
      } else {
        selectedProject = await projects.getProject(projectId);
      }

      return {
        screen: "project-player",
        projectId,
      };
    } catch {
      selectedProject = null;

      if (currentUser) {
        projectMenuMessage = hadInvitation
          ? INVALID_INVITATION_MESSAGE
          : "You do not have access to this project.";
        return { screen: "project-menu" };
      }

      authMessage = hadInvitation
        ? INVALID_INVITATION_MESSAGE
        : "Log in to access GrooveShare projects.";
      return { screen: "auth" };
    }
  }

  async function resolveRequestedRoute(
    requestedRoute: ApplicationRoute,
  ): Promise<ApplicationRoute> {
    try {
      return await resolveRequestedRouteInternal(requestedRoute);
    } finally {
      loading = { status: "idle" };
    }
  }

  function canNavigateWithoutAuthentication(
    screen: ApplicationScreen,
  ): boolean {
    return invitationWorkflow.canNavigateWithoutAuthentication(
      screen,
      selectedProject,
    );
  }

  function resolveNavigation(screen: ApplicationScreen): ApplicationRoute {
    const nextScreen =
      getCurrentUser() || canNavigateWithoutAuthentication(screen)
        ? screen
        : "auth";

    return getRouteForScreen(nextScreen);
  }

  function resolveBackNavigation(screen: ApplicationScreen): ApplicationRoute {
    return resolveNavigation(screen);
  }

  function present(screen: ApplicationScreen): TPresentationOutput {
    const currentUser = getCurrentUser();

    if (screen === "auth") {
      return presentationPort.showAuthentication({ message: authMessage });
    }

    if (screen === "invitation") {
      return presentationPort.showLoading({
        message: "Opening collaboration invitation...",
      });
    }

    if (screen === "project-menu") {
      return presentationPort.showProjects({
        currentUser,
        statusMessage: projectMenuMessage,
      });
    }

    if (screen === "create-project") {
      return presentationPort.showCreateProject({
        projectDraft: projectDraft.getProjectDraft(),
      });
    }

    return presentationPort.showProjectPlayer({
      project: selectedProject,
      currentUser,
      invitation: selectedProject
        ? invitationWorkflow.getPresentationState(
            selectedProject.id,
            currentUser,
          )
        : { status: "none" },
      statusMessage: projectPlayerNotice,
    });
  }

  function presentHistoryNavigationLoading(
    route: ApplicationRoute,
  ): TPresentationOutput | null {
    const shouldShowLoading =
      (route.screen === "project-player" || route.screen === "invitation") &&
      (route.screen === "invitation" ||
        (route.projectId !== undefined &&
          (selectedProject?.id !== route.projectId ||
            Boolean(
              invitationWorkflow.getInvitationForProject(route.projectId),
            ))));

    if (!shouldShowLoading) {
      return null;
    }

    const message = route.screen === "invitation"
      ? "Opening collaboration invitation..."
      : "Loading your project...";

    loading = { status: "loading", message };
    return presentationPort.showLoading({ message });
  }

  async function completeAuthentication(user: User): Promise<ApplicationRoute> {
    authentication = {
      status: "authenticated",
      user,
    };
    authMessage = "";
    projectMenuMessage = "";
    error = null;

    const transition = await invitationWorkflow.resumeAfterAuthentication(user);
    return applyInvitationTransition(transition);
  }

  function requestGuestAuthentication(): ApplicationRoute {
    const transition = invitationWorkflow.requestGuestAuthentication();
    return applyInvitationTransition(transition);
  }

  async function openProjectFromMenu(
    project: Project,
  ): Promise<ApplicationRoute> {
    projectMenuMessage = "";
    projectPlayerNotice = "";
    error = null;

    try {
      selectedProject = await invitationWorkflow.openProjectFromMenu(
        project,
        getCurrentUser(),
      );
    } catch {
      selectedProject = null;
      projectMenuMessage = INVALID_INVITATION_MESSAGE;
      error = {
        context: "invitation",
        message: INVALID_INVITATION_MESSAGE,
      };
      throw new Error(INVALID_INVITATION_MESSAGE);
    }

    return getRouteForScreen("project-player");
  }

  async function acceptContributor(
    currentScreen: ApplicationScreen,
  ): Promise<ApplicationActionResult> {
    const transition = await invitationWorkflow.acceptContributor({
      selectedProject,
      currentUser: getCurrentUser(),
      currentScreen,
    });

    const route = applyInvitationTransition(transition);

    return {
      route,
      ...(transition.error ? { error: transition.error } : {}),
    };
  }

  async function logout(): Promise<ApplicationLogoutResult> {
    try {
      await sessionProvider.logout();
    } catch (logoutError) {
      return {
        ok: false,
        errorMessage:
          logoutError instanceof Error
            ? logoutError.message
            : "Could not log out.",
      };
    }

    authentication = {
      status: "anonymous",
      user: null,
    };
    projectDraft.clear();
    error = null;

    const transition = await invitationWorkflow.continueAfterLogout();
    return {
      ok: true,
      route: applyInvitationTransition(transition),
    };
  }

  async function recoverAfterSessionExpiration(): Promise<ApplicationRoute | null> {
    if (!getCurrentUser()) {
      return null;
    }

    authentication = {
      status: "anonymous",
      user: null,
    };
    projectDraft.clear();
    error = null;

    if (!invitationWorkflow.hasActiveInvitation()) {
      selectedProject = null;
      authMessage = SESSION_EXPIRED_MESSAGE;
      return { screen: "auth" };
    }

    const transition = await invitationWorkflow.recoverAfterSessionExpiration();
    return applyInvitationTransition(transition);
  }

  async function initialize(
    requestedRoute: ApplicationRoute,
  ): Promise<ApplicationRoute> {
    authentication = {
      status: "restoring",
      user: null,
    };

    try {
      const user = await sessionProvider.getCurrentUser();
      authentication = {
        status: "authenticated",
        user,
      };
      authMessage = "";
      error = null;
    } catch (sessionError) {
      authentication = {
        status: "anonymous",
        user: null,
      };

      if (sessionError instanceof ApiError && sessionError.statusCode === 401) {
        authMessage = "";
      } else {
        authMessage =
          "Could not restore your account session. Guest invitation access may still be available.";
        error = {
          context: "authentication",
          message: authMessage,
        };
      }
    }

    return resolveRequestedRoute(requestedRoute);
  }

  return {
    initialize,
    resolveRequestedRoute,
    resolveNavigation,
    resolveBackNavigation,
    routesMatch,
    present,
    presentHistoryNavigationLoading,
    getState,
    getCurrentUser,
    getSelectedProject() {
      return selectedProject;
    },
    setSelectedProject,
    getActiveInvitedProjectForMenu,
    getActiveInvitationProjectId,
    getInvitationSession() {
      return invitationWorkflow.getSession();
    },
    completeAuthentication,
    requestGuestAuthentication,
    openProjectFromMenu,
    acceptContributor,
    logout,
    recoverAfterSessionExpiration,
  };
}
