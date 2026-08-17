import { projectsApi } from "./api/projects-api.js";
import { projectMembersApi } from "./api/project-members-api.js";
import { tracksApi } from "./api/tracks-api.js";
import { authApi, type AuthApi } from "./api/auth-api.js";
import {
  ApiError,
  setAuthenticationRequiredHandler,
} from "./api/api-client.js";
import { createCreateProjectPageController } from "./page-controllers/create-project-page-controller.js";
import { createProjectMenuPageController } from "./page-controllers/project-menu-page-controller.js";
import { createProjectPlayerPageController } from "./page-controllers/project-player-page-controller.js";
import { createProjectMembersController } from "./page-controllers/project-members-controller.js";
import { createProjectActionsMenuController } from "./page-controllers/project-actions-menu-controller.js";
import { createAudioPlayerController } from "./page-controllers/audio-player-controller.js";
import { createProjectTrackSelectionController } from "./page-controllers/create-project-track-selection-controller.js";
import { createCreateProjectConfirmationController } from "./page-controllers/create-project-confirmation-controller.js";
import { createAuthPageController } from "./page-controllers/auth-page-controller.js";
import { renderPendingTrackList } from "./templates/pending-track-list.js";
import { getTrackAudioUrl } from "./api/tracks-api.js";
import { renderCreateProjectPage } from "./pages/create-project-page.js";
import { renderProjectMenuPage } from "./pages/project-menu-page.js";
import { renderProjectPlayerPage } from "./pages/project-player-page.js";
import { renderAuthPage } from "./pages/auth-page.js";
import {
  createProjectDraftState,
  type PendingTrackDraft,
} from "./project-draft/project-draft-state.js";
import {
  createAppRouter,
  type AppRoute,
  type AppScreen,
  type HistoryAdapter,
} from "./router/app-router.js";
import { renderProjectList } from "./templates/project-list.js";
import { renderMixChannelSlots } from "./templates/mix-channel-slots.js";
import { renderProjectMemberList } from "./templates/project-members.js";
import type { Project, User } from "./types.js";

type AppElementLike = {
  innerHTML: string;
  querySelector?: <T>(selector: string) => T | null;
};

type GrooveShareAppOptions = {
  appElement: AppElementLike;
  initialScreen?: Exclude<AppScreen, "auth">;
  authenticationApi?: AuthApi;
  historyAdapter?: HistoryAdapter | null;
};

type NavigateOptions = {
  replace?: boolean;
};

type NavigateTo = (
  screen: AppScreen,
  options?: NavigateOptions,
) => void;

type GoBack = (fallbackScreen: AppScreen) => void;

type ProjectDraftState = ReturnType<typeof createProjectDraftState>;

function getElement<T>(appElement: AppElementLike, selector: string): T | null {
  if (!appElement.querySelector) {
    return null;
  }

  return appElement.querySelector<T>(selector);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderConfirmationTrackList(pendingTracks: PendingTrackDraft[]): string {
  if (pendingTracks.length === 0) {
    return '<p class="empty-state">No tracks selected.</p>';
  }

  return /*html*/ `
    <ol class="create-project-confirmation-track-list">
      ${pendingTracks
      .map((track) => {
        return /*html*/ `
            <li class="create-project-confirmation-track-list__item">
              <strong>${escapeHtml(track.trackName)}</strong>
              <span>${escapeHtml(track.originalFilename)}</span>
            </li>
          `;
      })
      .join("")}
    </ol>
  `;
}

function chooseAudioFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "audio/*";

    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
    });

    input.click();
  });
}

function initializeMobileNavigation({
  appElement,
  onHome,
  onLogout,
}: {
  appElement: AppElementLike;
  onHome?: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
}): void {
  const homeButton = getElement<HTMLButtonElement>(
    appElement,
    "#mobile-nav-home-button",
  );
  const logoutButton = getElement<HTMLButtonElement>(
    appElement,
    "#mobile-nav-logout-button",
  );

  homeButton?.addEventListener("click", () => {
    void onHome?.();
  });

  logoutButton?.addEventListener("click", () => {
    void onLogout();
  });
}

function initializeAuthPage({
  appElement,
  authenticationApi,
  onAuthenticated,
}: {
  appElement: AppElementLike;
  authenticationApi: AuthApi;
  onAuthenticated: (user: User) => void;
}): void {
  const loginForm = getElement<HTMLFormElement>(appElement, "#login-form");
  const loginEmailInput = getElement<HTMLInputElement>(
    appElement,
    "#login-email",
  );
  const loginPasswordInput = getElement<HTMLInputElement>(
    appElement,
    "#login-password",
  );
  const registerForm = getElement<HTMLFormElement>(
    appElement,
    "#register-form",
  );
  const registerDisplayNameInput = getElement<HTMLInputElement>(
    appElement,
    "#register-display-name",
  );
  const registerEmailInput = getElement<HTMLInputElement>(
    appElement,
    "#register-email",
  );
  const registerPasswordInput = getElement<HTMLInputElement>(
    appElement,
    "#register-password",
  );
  const statusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#auth-status",
  );

  if (
    !loginForm ||
    !loginEmailInput ||
    !loginPasswordInput ||
    !registerForm ||
    !registerDisplayNameInput ||
    !registerEmailInput ||
    !registerPasswordInput ||
    !statusElement
  ) {
    return;
  }

  const controller = createAuthPageController({
    loginForm,
    loginEmailInput,
    loginPasswordInput,
    registerForm,
    registerDisplayNameInput,
    registerEmailInput,
    registerPasswordInput,
    statusElement,
    authApi: authenticationApi,
    onAuthenticated,
  });

  controller.init();
}

function initializeProjectMenuPage({
  appElement,
  navigateTo,
  setSelectedProject,
  projectDraftState,
  onLogout,
}: {
  appElement: AppElementLike;
  navigateTo: NavigateTo;
  setSelectedProject: (project: Project) => void;
  projectDraftState: ProjectDraftState;
  onLogout: () => Promise<void>;
}): void {
  const addProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#add-project-button",
  );

  addProjectButton?.addEventListener("click", () => {
    projectDraftState.clear();
    navigateTo("create-project");
  });

  const logoutButton = getElement<HTMLButtonElement>(
    appElement,
    "#logout-button",
  );

  logoutButton?.addEventListener("click", () => {
    void onLogout();
  });

  initializeMobileNavigation({
    appElement,
    onLogout,
  });

  const projectListElement = getElement<HTMLDivElement>(
    appElement,
    "#project-list",
  );

  if (!projectListElement) {
    return;
  }

  const controller = createProjectMenuPageController({
    projectListElement,
    projectsApi,
    renderProjectList,
    onProjectSelected(project) {
      setSelectedProject(project);
      navigateTo("project-player");
    },
  });

  void controller.init();
}

function initializeCreateProjectPage({
  appElement,
  navigateTo,
  goBack,
  setSelectedProject,
  projectDraftState,
  onLogout,
}: {
  appElement: AppElementLike;
  navigateTo: NavigateTo;
  goBack: GoBack;
  setSelectedProject: (project: Project) => void;
  projectDraftState: ProjectDraftState;
  onLogout: () => Promise<void>;
}): void {
  const backButton = getElement<HTMLButtonElement>(
    appElement,
    "#back-to-menu-button",
  );

  backButton?.addEventListener("click", () => {
    goBack("project-menu");
  });

  initializeMobileNavigation({
    appElement,
    onHome() {
      navigateTo("project-menu");
    },
    onLogout,
  });

  const form = getElement<HTMLFormElement>(appElement, "#project-form");
  const titleInput = getElement<HTMLInputElement>(appElement, "#project-title");
  const descriptionInput = getElement<HTMLTextAreaElement>(
    appElement,
    "#project-description",
  );
  const statusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#project-status",
  );

  const confirmationModal = getElement<HTMLDivElement>(
    appElement,
    "#create-project-confirmation-modal",
  );

  const confirmationProjectTitleElement = getElement<HTMLElement>(
    appElement,
    "#create-project-confirmation-project-title",
  );

  const confirmationProjectDescriptionElement = getElement<HTMLElement>(
    appElement,
    "#create-project-confirmation-project-description",
  );

  const confirmationTrackListElement = getElement<HTMLDivElement>(
    appElement,
    "#create-project-confirmation-track-list",
  );

  const confirmationStatusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#create-project-confirmation-status",
  );

  const closeConfirmationButton = getElement<HTMLButtonElement>(
    appElement,
    "#close-create-project-confirmation-button",
  );

  const editCreateProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#edit-create-project-button",
  );

  const submitCreateProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#submit-create-project-button",
  );

  function closeConfirmationModal(): void {
    if (!confirmationModal) {
      return;
    }

    confirmationModal.hidden = true;
  }

  function openConfirmationModal(): void {
    const snapshot = projectDraftState.getSnapshot();

    if (
      !snapshot.project ||
      !confirmationModal ||
      !confirmationProjectTitleElement ||
      !confirmationProjectDescriptionElement ||
      !confirmationTrackListElement
    ) {
      return;
    }

    confirmationProjectTitleElement.textContent = snapshot.project.title;

    confirmationProjectDescriptionElement.textContent =
      snapshot.project.description.trim() || "No description provided.";

    confirmationTrackListElement.innerHTML = renderConfirmationTrackList(
      snapshot.pendingTracks,
    );

    if (confirmationStatusElement) {
      confirmationStatusElement.textContent = "";
    }

    confirmationModal.hidden = false;
  }

  if (form && titleInput && descriptionInput && statusElement) {
    const controller = createCreateProjectPageController({
      form,
      titleInput,
      descriptionInput,
      statusElement,
      onProjectDraftReady(projectDraft) {
        projectDraftState.setProjectDraft(projectDraft);
        openConfirmationModal();
      },
    });

    controller.init();
  }

  closeConfirmationButton?.addEventListener("click", () => {
    closeConfirmationModal();
  });

  editCreateProjectButton?.addEventListener("click", () => {
    closeConfirmationModal();
  });

  if (submitCreateProjectButton && confirmationStatusElement) {
    const createProjectConfirmationController =
      createCreateProjectConfirmationController({
        submitButton: submitCreateProjectButton,
        statusElement: confirmationStatusElement,
        projectDraftState,
        projectsApi,
        tracksApi,
        onProjectSubmitted(project) {
          setSelectedProject(project);
          navigateTo("project-player", { replace: true });
        },
      });

    createProjectConfirmationController.init();
  }

  const addTracksButton = getElement<HTMLButtonElement>(
    appElement,
    "#add-audio-tracks-button",
  );

  const pendingAudioFilesInput = getElement<HTMLInputElement>(
    appElement,
    "#pending-audio-files",
  );

  const tracksToIncludeSection = getElement<HTMLElement>(
    appElement,
    "#tracks-to-include-section",
  );

  const pendingTrackListElement = getElement<HTMLDivElement>(
    appElement,
    "#pending-track-list",
  );

  if (
    addTracksButton &&
    pendingAudioFilesInput &&
    tracksToIncludeSection &&
    pendingTrackListElement &&
    statusElement
  ) {
    const createProjectTrackSelectionControllerInstance =
      createProjectTrackSelectionController({
        addTracksButton,
        audioFileInput: pendingAudioFilesInput,
        statusElement,
        tracksToIncludeSection,
        pendingTrackListElement,
        projectDraftState,
        renderPendingTrackList,
      });

    createProjectTrackSelectionControllerInstance.init();
  }
}

function initializeProjectPlayerPage({
  appElement,
  navigateTo,
  goBack,
  selectedProject,
  currentUser,
  onLogout,
}: {
  appElement: AppElementLike;
  navigateTo: NavigateTo;
  goBack: GoBack;
  selectedProject: Project | null;
  currentUser: User | null;
  onLogout: () => Promise<void>;
}): (() => void) | null {
  const backButton = getElement<HTMLButtonElement>(
    appElement,
    "#player-back-button",
  );

  const logoutButton = getElement<HTMLButtonElement>(
    appElement,
    "#player-logout-button",
  );


  if (!selectedProject) {
    return null;
  }

  const trackListElement = getElement<HTMLDivElement>(
    appElement,
    "#player-track-list",
  );

  const statusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#project-player-status",
  );

  const deleteProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#delete-project-button",
  );

  const projectTitleElement = getElement<HTMLElement>(
    appElement,
    "[data-project-title-editor]",
  );

  const projectDescriptionElement = getElement<HTMLElement>(
    appElement,
    "[data-project-description-editor]",
  );

  if (!trackListElement) {
    return null;
  }

  const audioElement = getElement<HTMLAudioElement>(
    appElement,
    "#project-audio-player",
  );

  const seekBackwardButton = getElement<HTMLButtonElement>(
    appElement,
    "#audio-seek-back-button",
  );

  const playPauseButton = getElement<HTMLButtonElement>(
    appElement,
    "#audio-play-pause-button",
  );

  const stopButton = getElement<HTMLButtonElement>(
    appElement,
    "#audio-stop-button",
  );

  const loopCheckbox = getElement<HTMLInputElement>(
    appElement,
    "#audio-loop-checkbox",
  );

  const progressInput = getElement<HTMLInputElement>(
    appElement,
    "#audio-progress",
  );

  const timestampElement = getElement<HTMLElement>(
    appElement,
    "#audio-timestamp",
  );

  const durationElement = getElement<HTMLElement>(
    appElement,
    "#audio-duration",
  );

  const trackNameElement = getElement<HTMLElement>(
    appElement,
    "#audio-track-name",
  );

  if (
    !audioElement ||
    !seekBackwardButton ||
    !playPauseButton ||
    !stopButton ||
    !progressInput ||
    !timestampElement ||
    !durationElement ||
    !trackNameElement ||
    !loopCheckbox
  ) {
    throw new Error("Project Player audio elements were not found.");
  }

  const audioPlayerController = createAudioPlayerController({
    audioElement,
    seekBackwardButton,
    playPauseButton,
    stopButton,
    progressInput,
    timestampElement,
    durationElement,
    trackNameElement,
    loopCheckbox,
  });

  audioPlayerController.init();

  const controller = createProjectPlayerPageController({
    project: selectedProject,
    trackListElement,
    statusElement,
    deleteProjectButton,
    projectTitleElement,
    projectDescriptionElement,
    tracksApi,
    projectsApi,
    audioPlayerController,
    getTrackAudioUrl,
    chooseAudioFile,
    renderTrackList: renderMixChannelSlots,
    projectRole: selectedProject.role ?? "viewer",
    currentUserId: currentUser?.id ?? null,
    onProjectDeleted() {
      navigateTo("project-menu", { replace: true });
    },
  });

  void controller.init();

  async function leavePlayerForHome(): Promise<void> {
    await controller.flushPendingMixSettings();
    audioPlayerController.stop();
    navigateTo("project-menu");
  }

  async function leavePlayerWithBack(): Promise<void> {
    await controller.flushPendingMixSettings();
    audioPlayerController.stop();
    goBack("project-menu");
  }

  async function logoutFromPlayer(): Promise<void> {
    await controller.flushPendingMixSettings();
    audioPlayerController.stop();
    await onLogout();
  }

  backButton?.addEventListener("click", () => {
    void leavePlayerWithBack();
  });

  logoutButton?.addEventListener("click", () => {
    void logoutFromPlayer();
  });

  initializeMobileNavigation({
    appElement,
    onHome: leavePlayerForHome,
    onLogout: logoutFromPlayer,
  });

  let destroyProjectActionsMenu: (() => void) | null = null;

  if (selectedProject.role === "owner") {
    const projectActionsButton = getElement<HTMLButtonElement>(
      appElement,
      "#project-actions-button",
    );
    const projectActionsMenu = getElement<HTMLDivElement>(
      appElement,
      "#project-actions-menu",
    );
    const ownerControlsButton = getElement<HTMLButtonElement>(
      appElement,
      "#owner-controls-menu-item",
    );
    const ownerControlsPanel = getElement<HTMLElement>(
      appElement,
      "#project-members-panel",
    );

    if (projectActionsButton && projectActionsMenu) {
      const projectActionsController =
        createProjectActionsMenuController({
          triggerButton: projectActionsButton,
          menuElement: projectActionsMenu,
          ownerControlsButton,
          ownerControlsPanel,
        });

      projectActionsController.init();
      destroyProjectActionsMenu = projectActionsController.destroy;

      deleteProjectButton?.addEventListener("click", () => {
        projectActionsController.closeMenu();
      });
    }

    const memberForm = getElement<HTMLFormElement>(
      appElement,
      "#project-member-form",
    );
    const memberEmailInput = getElement<HTMLInputElement>(
      appElement,
      "#project-member-email",
    );
    const memberRoleSelect = getElement<HTMLSelectElement>(
      appElement,
      "#project-member-role",
    );
    const memberListElement = getElement<HTMLDivElement>(
      appElement,
      "#project-member-list",
    );
    const memberStatusElement = getElement<HTMLParagraphElement>(
      appElement,
      "#project-member-status",
    );

    if (
      memberForm &&
      memberEmailInput &&
      memberRoleSelect &&
      memberListElement
    ) {
      const membersController = createProjectMembersController({
        projectId: selectedProject.id,
        form: memberForm,
        emailInput: memberEmailInput,
        roleSelect: memberRoleSelect,
        memberListElement,
        statusElement: memberStatusElement,
        projectMembersApi,
        renderMembers: renderProjectMemberList,
      });

      void membersController.init();
    }
  }

  return () => {
    destroyProjectActionsMenu?.();
    audioPlayerController.stop();
    void controller.flushPendingMixSettings();
  };
}

function initializeCurrentPage({
  appElement,
  currentScreen,
  navigateTo,
  goBack,
  setSelectedProject,
  selectedProject,
  currentUser,
  projectDraftState,
  authenticationApi,
  onAuthenticated,
  onLogout,
}: {
  appElement: AppElementLike;
  currentScreen: AppScreen;
  navigateTo: NavigateTo;
  goBack: GoBack;
  setSelectedProject: (project: Project) => void;
  selectedProject: Project | null;
  currentUser: User | null;
  projectDraftState: ProjectDraftState;
  authenticationApi: AuthApi;
  onAuthenticated: (user: User) => void;
  onLogout: () => Promise<void>;
}): (() => void) | null {
  if (currentScreen === "auth") {
    initializeAuthPage({
      appElement,
      authenticationApi,
      onAuthenticated,
    });

    return null;
  }

  if (currentScreen === "project-menu") {
    initializeProjectMenuPage({
      appElement,
      navigateTo,
      setSelectedProject,
      projectDraftState,
      onLogout,
    });

    return null;
  }

  if (currentScreen === "create-project") {
    initializeCreateProjectPage({
      appElement,
      navigateTo,
      goBack,
      setSelectedProject,
      projectDraftState,
      onLogout,
    });

    return null;
  }

  if (currentScreen === "project-player") {
    return initializeProjectPlayerPage({
      appElement,
      navigateTo,
      goBack,
      selectedProject,
      currentUser,
      onLogout,
    });
  }

  return null;
}

export function createGrooveShareApp({
  appElement,
  initialScreen = "project-menu",
  authenticationApi = authApi,
  historyAdapter,
}: GrooveShareAppOptions) {
  let selectedProject: Project | null = null;
  let currentUser: User | null = null;
  let authMessage = "";
  let activePageCleanup: (() => void) | null = null;
  let historyNavigationRevision = 0;
  const projectDraftState = createProjectDraftState();

  function setSelectedProject(project: Project): void {
    selectedProject = project;
  }

  function getRouteForScreen(screen: AppScreen): AppRoute {
    if (screen === "project-player" && selectedProject) {
      return {
        screen,
        projectId: selectedProject.id,
      };
    }

    return { screen };
  }

  function routesMatch(first: AppRoute, second: AppRoute): boolean {
    return (
      first.screen === second.screen &&
      first.projectId === second.projectId
    );
  }

  async function resolveAuthenticatedRoute(
    requestedRoute: AppRoute,
  ): Promise<AppRoute> {
    if (!currentUser) {
      return { screen: "auth" };
    }

    if (requestedRoute.screen === "auth") {
      return { screen: "project-menu" };
    }

    if (requestedRoute.screen !== "project-player") {
      return requestedRoute;
    }

    const projectId =
      requestedRoute.projectId ?? selectedProject?.id ?? null;

    if (!projectId) {
      selectedProject = null;
      return { screen: "project-menu" };
    }

    if (selectedProject?.id === projectId) {
      return {
        screen: "project-player",
        projectId,
      };
    }

    try {
      selectedProject = await projectsApi.getProject(projectId);

      return {
        screen: "project-player",
        projectId,
      };
    } catch {
      selectedProject = null;
      return { screen: "project-menu" };
    }
  }

  function disposeCurrentPage(): void {
    activePageCleanup?.();
    activePageCleanup = null;
  }

  const router = createAppRouter({
    appElement,
    initialScreen,
    historyAdapter,
    pageRenderers: {
      auth: () => renderAuthPage({ message: authMessage }),
      "project-menu": () => renderProjectMenuPage(currentUser),
      "create-project": () =>
        renderCreateProjectPage(projectDraftState.getProjectDraft()),
      "project-player": () => renderProjectPlayerPage(selectedProject),
    },
    onHistoryNavigation(route) {
      void handleHistoryNavigation(route);
    },
  });

  function initializeRenderedPage(): void {
    activePageCleanup = initializeCurrentPage({
      appElement,
      currentScreen: router.getCurrentScreen(),
      navigateTo,
      goBack,
      setSelectedProject,
      selectedProject,
      currentUser,
      projectDraftState,
      authenticationApi,
      onAuthenticated: handleAuthenticated,
      onLogout: handleLogout,
    });
  }

  function renderAndInitializeCurrentRoute(): void {
    router.renderCurrentScreen();
    initializeRenderedPage();
  }

  function navigateTo(
    screen: AppScreen,
    { replace = false }: NavigateOptions = {},
  ): void {
    disposeCurrentPage();

    const nextScreen =
      currentUser || screen === "auth"
        ? screen
        : "auth";
    const nextRoute = getRouteForScreen(nextScreen);

    if (replace) {
      router.replaceWith(nextRoute);
    } else {
      router.navigateTo(nextRoute);
    }

    initializeRenderedPage();
  }

  function goBack(fallbackScreen: AppScreen): void {
    disposeCurrentPage();

    const fallbackRoute = getRouteForScreen(
      currentUser || fallbackScreen === "auth"
        ? fallbackScreen
        : "auth",
    );

    const waitingForBrowserHistory = router.goBack(fallbackRoute);

    if (!waitingForBrowserHistory) {
      initializeRenderedPage();
    }
  }

  async function handleHistoryNavigation(route: AppRoute): Promise<void> {
    const navigationRevision = ++historyNavigationRevision;

    disposeCurrentPage();

    const resolvedRoute = await resolveAuthenticatedRoute(route);

    if (navigationRevision !== historyNavigationRevision) {
      return;
    }

    if (!routesMatch(resolvedRoute, route)) {
      router.replaceWith(resolvedRoute);
      initializeRenderedPage();
      return;
    }

    renderAndInitializeCurrentRoute();
  }

  function handleAuthenticated(user: User): void {
    currentUser = user;
    authMessage = "";
    navigateTo("project-menu", { replace: true });
  }

  async function handleLogout(): Promise<void> {
    try {
      await authenticationApi.logout();
    } catch (error) {
      const statusElement =
        getElement<HTMLParagraphElement>(
          appElement,
          "#project-menu-status",
        ) ??
        getElement<HTMLParagraphElement>(
          appElement,
          "#project-player-status",
        );

      if (statusElement) {
        statusElement.textContent =
          error instanceof Error
            ? error.message
            : "Could not log out.";
      }

      return;
    }

    currentUser = null;
    selectedProject = null;
    projectDraftState.clear();
    authMessage = "You have been signed out.";
    navigateTo("auth", { replace: true });
  }

  function handleAuthenticationRequired(): void {
    if (!currentUser) {
      return;
    }

    currentUser = null;
    selectedProject = null;
    projectDraftState.clear();
    authMessage = "Your session has expired. Sign in again.";
    navigateTo("auth", { replace: true });
  }

  setAuthenticationRequiredHandler(
    handleAuthenticationRequired,
  );

  async function start(): Promise<void> {
    const requestedRoute = router.getRequestedRoute();

    try {
      currentUser =
        await authenticationApi.getCurrentUser();
      authMessage = "";

      const initialRoute =
        await resolveAuthenticatedRoute(requestedRoute);

      router.start(initialRoute);
    } catch (error) {
      currentUser = null;

      if (
        error instanceof ApiError &&
        error.statusCode === 401
      ) {
        authMessage = "";
      } else {
        authMessage =
          "Could not restore your session. Sign in to continue.";
      }

      router.start({ screen: "auth" });
    }

    initializeRenderedPage();
  }

  return {
    start,
    navigateTo,
    getCurrentScreen: router.getCurrentScreen,
    getCurrentUser: () => currentUser,
  };
}
