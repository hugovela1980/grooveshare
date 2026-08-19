import { projectsApi } from "./api/projects-api.js";
import { projectMembersApi } from "./api/project-members-api.js";
import {
  createInvitationAudioDataFetcher,
  getTrackAudioUrl,
  tracksApi,
} from "./api/tracks-api.js";
import { invitationsApi } from "./api/invitations-api.js";
import {
  createGrooveShareApplicationController,
  createHtmlAudioPlaybackEngine,
  createWebAudioPlaybackEngine,
  type ApplicationNavigationOptions,
  type ApplicationPresentationPort,
  type SessionProvider,
  type StorageProvider,
} from "@hugovela/frontend-core";
import { browserSessionProvider } from "./platform/browser-session-provider.js";
import { getBrowserStorageProvider } from "./platform/browser-storage-provider.js";
import {
  getBrowserInvitationSessionStore,
  type InvitationSession,
  type InvitationSessionStore,
} from "./platform/browser-invitation-session.js";
import {
  buildBrowserInvitationShareLink,
  copyBrowserText,
} from "./platform/browser-invitation-sharing.js";
import { createGuestMixStorageProvider } from "./storage/guest-mix-storage.js";
import { setAuthenticationRequiredHandler } from "./api/api-client.js";
import { createCreateProjectPageController } from "./page-controllers/create-project-page-controller.js";
import { createProjectMenuPageController } from "./page-controllers/project-menu-page-controller.js";
import { createProjectPlayerPageController } from "./page-controllers/project-player-page-controller.js";
import { createProjectMembersController } from "./page-controllers/project-members-controller.js";
import { createProjectActionsMenuController } from "./page-controllers/project-actions-menu-controller.js";
import { createProjectInvitationController } from "./page-controllers/project-invitation-controller.js";
import { createAudioPlayerController } from "./page-controllers/audio-player-controller.js";
import { createProjectTrackSelectionController } from "./page-controllers/create-project-track-selection-controller.js";
import { createCreateProjectConfirmationController } from "./page-controllers/create-project-confirmation-controller.js";
import { createAuthPageController } from "./page-controllers/auth-page-controller.js";
import { renderPendingTrackList } from "./templates/pending-track-list.js";
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
import { setControlBusy } from "./ui/async-state.js";
import { createApplicationPresentationAdapter } from "./presentation/application-presentation-adapter.js";
import type { Project, User } from "./types.js";

type AppElementLike = {
  innerHTML: string;
  querySelector?: <T>(selector: string) => T | null;
};

type GrooveShareAppOptions = {
  appElement: AppElementLike;
  initialScreen?: Exclude<AppScreen, "auth" | "invitation">;
  sessionProvider?: SessionProvider;
  storageProvider?: StorageProvider | null;
  historyAdapter?: HistoryAdapter | null;
  invitationSessionStore?: InvitationSessionStore | null;
  presentationPort?: ApplicationPresentationPort<string>;
};

type NavigateOptions = ApplicationNavigationOptions;

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

async function runBusyButtonAction(
  button: HTMLButtonElement | null,
  action: () => void | Promise<void>,
): Promise<void> {
  if (button?.disabled) {
    return;
  }

  setControlBusy(button, true);

  try {
    await action();
  } finally {
    setControlBusy(button, false);
  }
}

function initializeAuthPage({
  appElement,
  sessionProvider,
  onAuthenticated,
}: {
  appElement: AppElementLike;
  sessionProvider: SessionProvider;
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
  const loginSubmitButton = getElement<HTMLButtonElement>(
    appElement,
    "#login-submit-button",
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
  const registerSubmitButton = getElement<HTMLButtonElement>(
    appElement,
    "#register-submit-button",
  );
  const statusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#auth-status",
  );

  if (
    !loginForm ||
    !loginEmailInput ||
    !loginPasswordInput ||
    !loginSubmitButton ||
    !registerForm ||
    !registerDisplayNameInput ||
    !registerEmailInput ||
    !registerPasswordInput ||
    !registerSubmitButton ||
    !statusElement
  ) {
    return;
  }

  const controller = createAuthPageController({
    loginForm,
    loginEmailInput,
    loginPasswordInput,
    loginSubmitButton,
    registerForm,
    registerDisplayNameInput,
    registerEmailInput,
    registerPasswordInput,
    registerSubmitButton,
    statusElement,
    sessionProvider,
    onAuthenticated,
  });

  controller.init();
}

function initializeProjectMenuPage({
  appElement,
  navigateTo,
  setSelectedProject,
  getInvitedProject,
  getInvitationProjectId,
  projectDraftState,
  onOpenProject,
  onContributorAction,
  onLogout,
}: {
  appElement: AppElementLike;
  navigateTo: NavigateTo;
  setSelectedProject: (project: Project) => void;
  getInvitedProject: () => Project | null;
  getInvitationProjectId: () => string | null;
  projectDraftState: ProjectDraftState;
  onOpenProject: (project: Project) => Promise<void>;
  onContributorAction: () => Promise<void>;
  onLogout: () => Promise<void>;
}): void {
  const addProjectButton = getElement<HTMLButtonElement>(appElement, "#add-project-button");
  addProjectButton?.addEventListener("click", () => { projectDraftState.clear(); navigateTo("create-project"); });
  const logoutButton = getElement<HTMLButtonElement>(appElement, "#logout-button");
  logoutButton?.addEventListener("click", () => { void runBusyButtonAction(logoutButton, onLogout); });
  const projectListElement = getElement<HTMLDivElement>(appElement, "#project-list");
  const statusElement = getElement<HTMLParagraphElement>(appElement, "#project-menu-status");
  if (!projectListElement) return;
  const controller = createProjectMenuPageController({
    projectListElement,
    projectsApi,
    renderProjectList,
    statusElement,
    getInvitedProject,
    getInvitationProjectId,
    async onProjectSelected(project) { setSelectedProject(project); await onOpenProject(project); },
    async onInvitationAccepted(project) { setSelectedProject(project); await onContributorAction(); },
  });
  void controller.init();
}

function initializeCreateProjectPage({
  appElement,
  navigateTo,
  goBack,
  setSelectedProject,
  projectDraftState,
}: {
  appElement: AppElementLike;
  navigateTo: NavigateTo;
  goBack: GoBack;
  setSelectedProject: (project: Project) => void;
  projectDraftState: ProjectDraftState;
}): void {
  const backButton = getElement<HTMLButtonElement>(
    appElement,
    "#back-to-menu-button",
  );

  backButton?.addEventListener("click", () => {
    goBack("project-menu");
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
  storageProvider,
  activeInvitation,
  onContributorAction,
  onGuestAuth,
  onLogout,
}: {
  appElement: AppElementLike;
  navigateTo: NavigateTo;
  goBack: GoBack;
  selectedProject: Project | null;
  currentUser: User | null;
  storageProvider: StorageProvider | null;
  activeInvitation: InvitationSession | null;
  onContributorAction: () => Promise<void>;
  onGuestAuth: () => void;
  onLogout: () => Promise<void>;
}): (() => void) | null {
  const backButton = getElement<HTMLButtonElement>(appElement, "#player-back-button");
  const logoutButton = getElement<HTMLButtonElement>(appElement, "#player-logout-button");
  const guestHomeButton = getElement<HTMLButtonElement>(appElement, "#player-guest-home-button");
  const loginButton = getElement<HTMLButtonElement>(appElement, "#player-login-button");
  if (!selectedProject) return null;

  const invitationForProject = activeInvitation?.projectId === selectedProject.id ? activeInvitation : null;
  const isGuestProject = selectedProject.access === "guest" && selectedProject.role == null;

  const contributorButton = getElement<HTMLButtonElement>(appElement, "#become-contributor-button");
  const contributorStatusElement = getElement<HTMLParagraphElement>(appElement, "#contributor-invitation-status");
  contributorButton?.addEventListener("click", () => {
    void runBusyButtonAction(contributorButton, async () => {
      try { await onContributorAction(); }
      catch (error) { if (contributorStatusElement) contributorStatusElement.textContent = error instanceof Error ? error.message : "Could not accept the collaboration invitation."; }
    });
  });

  const guestAccessBanner = getElement<HTMLElement>(appElement, "#guest-access-banner");
  const dismissGuestAccessButton = getElement<HTMLButtonElement>(appElement, "#dismiss-guest-access-button");
  const contributorInvitationCard = getElement<HTMLElement>(appElement, "#contributor-invitation-card");
  const dismissContributorInvitationButton = getElement<HTMLButtonElement>(appElement, "#dismiss-contributor-invitation-button");
  dismissGuestAccessButton?.addEventListener("click", () => { if (guestAccessBanner) guestAccessBanner.hidden = true; });
  dismissContributorInvitationButton?.addEventListener("click", () => { if (contributorInvitationCard) contributorInvitationCard.hidden = true; });

  const loadingElement = getElement<HTMLElement>(appElement, "#project-player-loading");
  const contentElement = getElement<HTMLElement>(appElement, "#project-player-content");
  const trackListElement = getElement<HTMLDivElement>(appElement, "#player-track-list");
  const statusElement = getElement<HTMLParagraphElement>(appElement, "#project-player-status");
  const deleteProjectButton = getElement<HTMLButtonElement>(appElement, "#delete-project-button");
  const projectTitleElement = getElement<HTMLElement>(appElement, "[data-project-title-display]");
  const projectDescriptionElement = getElement<HTMLElement>(appElement, "[data-project-description-display]");
  if (!trackListElement) { guestHomeButton?.addEventListener("click", onGuestAuth); loginButton?.addEventListener("click", onGuestAuth); return null; }

  const audioElement = getElement<HTMLAudioElement>(appElement, "#project-audio-player");
  const seekBackwardButton = getElement<HTMLButtonElement>(appElement, "#audio-seek-back-button");
  const playPauseButton = getElement<HTMLButtonElement>(appElement, "#audio-play-pause-button");
  const stopButton = getElement<HTMLButtonElement>(appElement, "#audio-stop-button");
  const loopCheckbox = getElement<HTMLInputElement>(appElement, "#audio-loop-checkbox");
  const progressInput = getElement<HTMLInputElement>(appElement, "#audio-progress");
  const timestampElement = getElement<HTMLElement>(appElement, "#audio-timestamp");
  const durationElement = getElement<HTMLElement>(appElement, "#audio-duration");
  const trackNameElement = getElement<HTMLElement>(appElement, "#audio-track-name");
  if (!audioElement || !seekBackwardButton || !playPauseButton || !stopButton || !progressInput || !timestampElement || !durationElement || !trackNameElement || !loopCheckbox) throw new Error("Project Player audio elements were not found.");

  const playbackEngine = createWebAudioPlaybackEngine({
    ...(invitationForProject ? { fetchAudioData: createInvitationAudioDataFetcher(invitationForProject.token) } : {}),
    createFallbackEngine: () => createHtmlAudioPlaybackEngine({ primaryAudioElement: audioElement, createAudioElement: () => document.createElement("audio") }),
  });
  const audioPlayerController = createAudioPlayerController({ playbackEngine, seekBackwardButton, playPauseButton, stopButton, progressInput, timestampElement, durationElement, trackNameElement, loopCheckbox });
  audioPlayerController.init();

  const projectTracksApi = invitationForProject ? { ...tracksApi, getTracksByProjectId(projectId: string) { return tracksApi.getTracksByProjectId(projectId, invitationForProject.token); } } : tracksApi;
  const projectStorageProvider = isGuestProject ? createGuestMixStorageProvider(selectedProject.id, storageProvider) : storageProvider;

  const controller = createProjectPlayerPageController({
    project: selectedProject,
    trackListElement,
    loadingElement,
    contentElement,
    statusElement,
    deleteProjectButton,
    projectTitleElement,
    projectDescriptionElement,
    tracksApi: projectTracksApi,
    projectsApi,
    audioPlayerController,
    getTrackAudioUrl,
    chooseAudioFile,
    renderTrackList: renderMixChannelSlots,
    projectRole: selectedProject.role ?? "viewer",
    currentUserId: currentUser?.id ?? null,
    storageProvider: projectStorageProvider,
    onProjectDeleted() { navigateTo("project-menu", { replace: true }); },
  });
  void controller.init();

  async function leavePlayerWithBack(): Promise<void> { await controller.flushPendingMixSettings(); audioPlayerController.stop(); goBack("project-menu"); }
  async function logoutFromPlayer(): Promise<void> { await controller.flushPendingMixSettings(); audioPlayerController.stop(); await onLogout(); }
  backButton?.addEventListener("click", () => { void runBusyButtonAction(backButton, leavePlayerWithBack); });
  logoutButton?.addEventListener("click", () => { void runBusyButtonAction(logoutButton, logoutFromPlayer); });
  guestHomeButton?.addEventListener("click", onGuestAuth);
  loginButton?.addEventListener("click", onGuestAuth);

  let destroyProjectActionsMenu: (() => void) | null = null;
  if (selectedProject.role === "owner") {
    const memberForm = getElement<HTMLFormElement>(appElement, "#project-member-form");
    const memberEmailInput = getElement<HTMLInputElement>(appElement, "#project-member-email");
    const memberRoleSelect = getElement<HTMLSelectElement>(appElement, "#project-member-role");
    const memberSubmitButton = getElement<HTMLButtonElement>(appElement, "#add-project-member-button");
    const memberListElement = getElement<HTMLDivElement>(appElement, "#project-member-list");
    const memberStatusElement = getElement<HTMLParagraphElement>(appElement, "#project-member-status");
    let refreshMembers: (() => Promise<void>) | null = null;
    if (memberForm && memberEmailInput && memberRoleSelect && memberSubmitButton && memberListElement) {
      const membersController = createProjectMembersController({ projectId: selectedProject.id, form: memberForm, emailInput: memberEmailInput, roleSelect: memberRoleSelect, submitButton: memberSubmitButton, memberListElement, statusElement: memberStatusElement, projectMembersApi, renderMembers: renderProjectMemberList });
      refreshMembers = membersController.loadMembers;
      void membersController.init();
    }

    const invitationStatusElement = getElement<HTMLParagraphElement>(appElement, "#project-invitation-status");
    const invitationLinkInput = getElement<HTMLInputElement>(appElement, "#project-invitation-link");
    const generateInvitationButton = getElement<HTMLButtonElement>(appElement, "#generate-project-invitation-button");
    const copyInvitationButton = getElement<HTMLButtonElement>(appElement, "#copy-project-invitation-button");
    const regenerateInvitationButton = getElement<HTMLButtonElement>(appElement, "#regenerate-project-invitation-button");
    const disableInvitationButton = getElement<HTMLButtonElement>(appElement, "#disable-project-invitation-button");
    if (invitationStatusElement && invitationLinkInput && generateInvitationButton && copyInvitationButton && regenerateInvitationButton && disableInvitationButton) {
      const invitationController = createProjectInvitationController({ projectId: selectedProject.id, invitationApi: invitationsApi, statusElement: invitationStatusElement, linkInput: invitationLinkInput, generateButton: generateInvitationButton, copyButton: copyInvitationButton, regenerateButton: regenerateInvitationButton, disableButton: disableInvitationButton, buildShareLink: buildBrowserInvitationShareLink, copyText: copyBrowserText });
      invitationController.init();
    }

    const projectActionsButton = getElement<HTMLButtonElement>(appElement, "#project-actions-button");
    const projectActionsMenu = getElement<HTMLDivElement>(appElement, "#project-actions-menu");
    const manageMembersButton = getElement<HTMLButtonElement>(appElement, "#manage-members-menu-item");
    const manageMembersPanel = getElement<HTMLElement>(appElement, "#project-members-panel");
    const manageMembersCloseButton = getElement<HTMLButtonElement>(appElement, "#close-project-members-button");
    const collaborationLinkButton = getElement<HTMLButtonElement>(appElement, "#collaboration-link-menu-item");
    const collaborationLinkPanel = getElement<HTMLElement>(appElement, "#project-invitation-panel");
    const collaborationLinkCloseButton = getElement<HTMLButtonElement>(appElement, "#close-project-invitation-button");
    if (projectActionsButton && projectActionsMenu) {
      const projectActionsController = createProjectActionsMenuController({ triggerButton: projectActionsButton, menuElement: projectActionsMenu, manageMembersButton, manageMembersPanel, manageMembersCloseButton, collaborationLinkButton, collaborationLinkPanel, collaborationLinkCloseButton, onOpenManageMembers: refreshMembers ?? undefined });
      projectActionsController.init();
      destroyProjectActionsMenu = projectActionsController.destroy;
      deleteProjectButton?.addEventListener("click", () => { projectActionsController.closeMenu(); });
    }
  }

  return () => { destroyProjectActionsMenu?.(); audioPlayerController.destroy(); void controller.flushPendingMixSettings(); };
}

function initializeCurrentPage({
  appElement,
  currentScreen,
  navigateTo,
  goBack,
  setSelectedProject,
  getInvitedProject,
  getInvitationProjectId,
  selectedProject,
  currentUser,
  projectDraftState,
  sessionProvider,
  storageProvider,
  activeInvitation,
  onAuthenticated,
  onOpenProject,
  onContributorAction,
  onGuestAuth,
  onLogout,
}: {
  appElement: AppElementLike;
  currentScreen: AppScreen;
  navigateTo: NavigateTo;
  goBack: GoBack;
  setSelectedProject: (project: Project) => void;
  getInvitedProject: () => Project | null;
  getInvitationProjectId: () => string | null;
  selectedProject: Project | null;
  currentUser: User | null;
  projectDraftState: ProjectDraftState;
  sessionProvider: SessionProvider;
  storageProvider: StorageProvider | null;
  activeInvitation: InvitationSession | null;
  onAuthenticated: (user: User) => void;
  onOpenProject: (project: Project) => Promise<void>;
  onContributorAction: () => Promise<void>;
  onGuestAuth: () => void;
  onLogout: () => Promise<void>;
}): (() => void) | null {
  if (currentScreen === "auth") { initializeAuthPage({ appElement, sessionProvider, onAuthenticated }); return null; }
  if (currentScreen === "invitation") return null;
  if (currentScreen === "project-menu") { initializeProjectMenuPage({ appElement, navigateTo, setSelectedProject, getInvitedProject, getInvitationProjectId, projectDraftState, onOpenProject, onContributorAction, onLogout }); return null; }
  if (currentScreen === "create-project") { initializeCreateProjectPage({ appElement, navigateTo, goBack, setSelectedProject, projectDraftState }); return null; }
  if (currentScreen === "project-player") return initializeProjectPlayerPage({ appElement, navigateTo, goBack, selectedProject, currentUser, storageProvider, activeInvitation, onContributorAction, onGuestAuth, onLogout });
  return null;
}

export function createGrooveShareApp({
  appElement,
  initialScreen = "project-menu",
  sessionProvider = browserSessionProvider,
  storageProvider = getBrowserStorageProvider(),
  historyAdapter,
  invitationSessionStore = getBrowserInvitationSessionStore(),
  presentationPort = createApplicationPresentationAdapter(),
}: GrooveShareAppOptions) {
  let activePageCleanup: (() => void) | null = null;
  let historyNavigationRevision = 0;
  const projectDraftState = createProjectDraftState();
  const applicationController = createGrooveShareApplicationController({
    sessionProvider,
    projects: projectsApi,
    invitations: invitationsApi,
    invitationSessionStore,
    presentationPort,
    projectDraft: projectDraftState,
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
    activePageCleanup = initializeCurrentPage({
      appElement,
      currentScreen: router.getCurrentScreen(),
      navigateTo,
      goBack,
      setSelectedProject: applicationController.setSelectedProject,
      getInvitedProject: applicationController.getActiveInvitedProjectForMenu,
      getInvitationProjectId: applicationController.getActiveInvitationProjectId,
      selectedProject: applicationController.getSelectedProject(),
      currentUser: applicationController.getCurrentUser(),
      projectDraftState,
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
    { replace = false }: NavigateOptions = {},
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
        statusElement.textContent = result.errorMessage;
      }

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

  setAuthenticationRequiredHandler(handleAuthenticationRequired);

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
