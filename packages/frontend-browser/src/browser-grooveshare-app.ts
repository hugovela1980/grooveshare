import {
  createGrooveShareApplicationController,
  type ApplicationNavigationOptions,
  type ApplicationPresentationPort,
  type ApplicationProjectDraftPort,
  type InvitationSessionState,
  type InvitationSessionStore,
  type InvitationsService,
  type Project,
  type ProjectsService,
  type SessionProvider,
  type StorageProvider,
  type User,
} from "@hugovela/frontend-core";
import {
  createAppRouter,
  type AppRoute,
  type AppScreen,
  type HistoryAdapter,
} from "./app-router.js";
import type { BrowserApiTransport } from "./browser-api-transport.js";

export type BrowserGrooveShareAppElement = {
  innerHTML: string;
};

export type BrowserGrooveSharePageContext<
  TProjectDraft extends ApplicationProjectDraftPort,
> = {
  currentScreen: AppScreen;
  navigateTo: (
    screen: AppScreen,
    options?: ApplicationNavigationOptions,
  ) => void;
  goBack: (fallbackScreen: AppScreen) => void;
  setSelectedProject: (project: Project | null) => void;
  getInvitedProject: () => Project | null;
  getInvitationProjectId: () => string | null;
  selectedProject: Project | null;
  currentUser: User | null;
  projectDraft: TProjectDraft;
  sessionProvider: SessionProvider;
  storageProvider: StorageProvider | null;
  activeInvitation: InvitationSessionState | null;
  onAuthenticated: (user: User) => void;
  onOpenProject: (project: Project) => Promise<void>;
  onContributorAction: () => Promise<void>;
  onGuestAuth: () => void;
  onLogout: () => Promise<void>;
};

export type BrowserGrooveShareAppOptions<
  TProjectDraft extends ApplicationProjectDraftPort,
> = {
  appElement: BrowserGrooveShareAppElement;
  initialScreen: AppScreen;
  sessionProvider: SessionProvider;
  storageProvider?: StorageProvider | null;
  historyAdapter?: HistoryAdapter | null;
  invitationSessionStore?: InvitationSessionStore | null;
  presentationPort: ApplicationPresentationPort<string>;
  projectDraft: TProjectDraft;
  projects: Pick<ProjectsService, "getProject">;
  invitations: Pick<
    InvitationsService,
    "resolveGuestInvitation" | "acceptProjectInvitation"
  >;
  transport: Pick<BrowserApiTransport, "setAuthenticationRequiredHandler">;
  initializePage: (
    context: BrowserGrooveSharePageContext<TProjectDraft>,
  ) => (() => void) | null;
  showLogoutError: (message: string) => void;
};

/**
 * Shared browser shell around the presentation-neutral application controller.
 *
 * The core controller owns application state and route decisions. This shell
 * owns browser-history synchronization and the lifecycle bridge to whichever
 * presentation adapter is running. Desktop/mobile DOM setup stays behind the
 * initializePage callback supplied by each presentation client.
 */
export function createBrowserGrooveShareApp<
  TProjectDraft extends ApplicationProjectDraftPort,
>({
  appElement,
  initialScreen,
  sessionProvider,
  storageProvider = null,
  historyAdapter,
  invitationSessionStore = null,
  presentationPort,
  projectDraft,
  projects,
  invitations,
  transport,
  initializePage,
  showLogoutError,
}: BrowserGrooveShareAppOptions<TProjectDraft>) {
  let activePageCleanup: (() => void) | null = null;
  let historyNavigationRevision = 0;

  const applicationController = createGrooveShareApplicationController({
    sessionProvider,
    projects,
    invitations,
    invitationSessionStore,
    presentationPort,
    projectDraft,
  });

  function disposeCurrentPage(): void {
    activePageCleanup?.();
    activePageCleanup = null;
  }

  const router = createAppRouter({
    appElement,
    initialScreen,
    historyAdapter,
    pageRenderers: {
      auth: () => applicationController.present("auth"),
      invitation: () => applicationController.present("invitation"),
      "project-menu": () => applicationController.present("project-menu"),
      "create-project": () => applicationController.present("create-project"),
      "project-player": () => applicationController.present("project-player"),
    },
    onHistoryNavigation(route) {
      void handleHistoryNavigation(route);
    },
  });

  function initializeRenderedPage(): void {
    activePageCleanup = initializePage({
      currentScreen: router.getCurrentScreen(),
      navigateTo,
      goBack,
      setSelectedProject: applicationController.setSelectedProject,
      getInvitedProject: applicationController.getActiveInvitedProjectForMenu,
      getInvitationProjectId: applicationController.getActiveInvitationProjectId,
      selectedProject: applicationController.getSelectedProject(),
      currentUser: applicationController.getCurrentUser(),
      projectDraft,
      sessionProvider,
      storageProvider,
      activeInvitation: applicationController.getInvitationSession(),
      onAuthenticated: handleAuthenticated,
      onOpenProject: handleOpenProjectFromMenu,
      onContributorAction: handleContributorAction,
      onGuestAuth: handleGuestAuth,
      onLogout: handleLogout,
    });
  }

  function renderAndInitializeCurrentRoute(): void {
    router.renderCurrentScreen();
    initializeRenderedPage();
  }

  function navigateTo(
    screen: AppScreen,
    { replace = false }: ApplicationNavigationOptions = {},
  ): void {
    disposeCurrentPage();

    const nextRoute = applicationController.resolveNavigation(screen);

    if (replace) {
      router.replaceWith(nextRoute);
    } else {
      router.navigateTo(nextRoute);
    }

    initializeRenderedPage();
  }

  function goBack(fallbackScreen: AppScreen): void {
    disposeCurrentPage();

    const fallbackRoute =
      applicationController.resolveBackNavigation(fallbackScreen);
    const waitingForBrowserHistory = router.goBack(fallbackRoute);

    if (!waitingForBrowserHistory) {
      initializeRenderedPage();
    }
  }

  async function handleHistoryNavigation(route: AppRoute): Promise<void> {
    const navigationRevision = ++historyNavigationRevision;

    disposeCurrentPage();

    const loadingPresentation =
      applicationController.presentHistoryNavigationLoading(route);

    if (loadingPresentation !== null) {
      appElement.innerHTML = loadingPresentation;
    }

    const resolvedRoute =
      await applicationController.resolveRequestedRoute(route);

    if (navigationRevision !== historyNavigationRevision) {
      return;
    }

    if (!applicationController.routesMatch(resolvedRoute, route)) {
      router.replaceWith(resolvedRoute);
      initializeRenderedPage();
      return;
    }

    renderAndInitializeCurrentRoute();
  }

  function handleAuthenticated(user: User): void {
    void (async () => {
      const route = await applicationController.completeAuthentication(user);
      navigateTo(route.screen, { replace: true });
    })();
  }

  function handleGuestAuth(): void {
    const route = applicationController.requestGuestAuthentication();
    navigateTo(route.screen);
  }

  async function handleOpenProjectFromMenu(project: Project): Promise<void> {
    const route = await applicationController.openProjectFromMenu(project);
    navigateTo(route.screen);
  }

  async function handleContributorAction(): Promise<void> {
    const result = await applicationController.acceptContributor(
      router.getCurrentScreen(),
    );

    navigateTo(result.route.screen, { replace: true });

    if (result.error) {
      throw result.error;
    }
  }

  async function handleLogout(): Promise<void> {
    const result = await applicationController.logout();

    if (result.ok === false) {
      showLogoutError(result.errorMessage);
      return;
    }

    navigateTo(result.route.screen, { replace: true });
  }

  function handleAuthenticationRequired(): void {
    void (async () => {
      const route = await applicationController.recoverAfterSessionExpiration();

      if (!route) {
        return;
      }

      navigateTo(route.screen, { replace: true });
    })();
  }

  transport.setAuthenticationRequiredHandler(handleAuthenticationRequired);

  async function start(): Promise<void> {
    const initialRoute = await applicationController.initialize(
      router.getRequestedRoute(),
    );
    router.start(initialRoute);
    initializeRenderedPage();
  }

  return {
    start,
    navigateTo,
    getCurrentScreen: router.getCurrentScreen,
    getCurrentUser: applicationController.getCurrentUser,
  };
}
