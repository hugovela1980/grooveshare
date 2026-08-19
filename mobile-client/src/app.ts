import { projectsApi } from "./api/projects-api.js";
import { projectMembersApi } from "./api/project-members-api.js";
import {
  createInvitationAudioDataFetcher,
  getTrackAudioUrl,
  tracksApi,
} from "./api/tracks-api.js";
import { invitationsApi } from "./api/invitations-api.js";
import {
  INVALID_INVITATION_MESSAGE,
  createHtmlAudioPlaybackEngine,
  createInvitationGuestWorkflow,
  createWebAudioPlaybackEngine,
  type ApplicationNavigationOptions,
  type ApplicationPresentationPort,
  type InvitationWorkflowTransition,
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
import {
  ApiError,
  setAuthenticationRequiredHandler,
} from "./api/api-client.js";
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
import { MOBILE_AUDIO_FILE_ACCEPT } from "./uploads/mobile-audio-files.js";
import type { Project, User } from "./types.js";

type AppElementLike = {
  innerHTML: string;
  querySelector?: <T>(selector: string) => T | null;
};

type GrooveShareAppOptions = {
  appElement: AppElementLike;
  initialScreen?: Exclude<AppScreen, "auth">;
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
    input.accept = MOBILE_AUDIO_FILE_ACCEPT;

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

function initializeMobileNavigation({
  appElement,
  onHome,
  onLogout,
  onAuth,
}: {
  appElement: AppElementLike;
  onHome?: () => void | Promise<void>;
  onLogout?: () => void | Promise<void>;
  onAuth?: () => void | Promise<void>;
}): void {
  const homeButton = getElement<HTMLButtonElement>(
    appElement,
    "#mobile-nav-home-button",
  );
  const logoutButton = getElement<HTMLButtonElement>(
    appElement,
    "#mobile-nav-logout-button",
  );
  const authButton = getElement<HTMLButtonElement>(
    appElement,
    "#mobile-nav-auth-button",
  );

  homeButton?.addEventListener("click", () => {
    if (!onHome) {
      return;
    }

    void runBusyButtonAction(homeButton, onHome);
  });

  logoutButton?.addEventListener("click", () => {
    if (!onLogout) {
      return;
    }

    void runBusyButtonAction(logoutButton, onLogout);
  });

  authButton?.addEventListener("click", () => {
    if (!onAuth) {
      return;
    }

    void runBusyButtonAction(authButton, onAuth);
  });
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
  const loginModeButton = getElement<HTMLButtonElement>(
    appElement,
    "#show-login-button",
  );
  const registerModeButton = getElement<HTMLButtonElement>(
    appElement,
    "#show-register-button",
  );
  const loginCard = getElement<HTMLElement>(appElement, "#login-card");
  const registerCard = getElement<HTMLElement>(appElement, "#register-card");

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
    loginModeButton,
    registerModeButton,
    loginCard,
    registerCard,
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
    void runBusyButtonAction(logoutButton, onLogout);
  });

  initializeMobileNavigation({
    appElement,
    onLogout,
  });

  const projectListElement = getElement<HTMLDivElement>(
    appElement,
    "#project-list",
  );
  const statusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#project-menu-status",
  );

  if (!projectListElement) {
    return;
  }

  const controller = createProjectMenuPageController({
    projectListElement,
    projectsApi,
    renderProjectList,
    statusElement,
    getInvitedProject,
    getInvitationProjectId,
    async onProjectSelected(project) {
      setSelectedProject(project);
      await onOpenProject(project);
    },
    async onInvitationAccepted(project) {
      setSelectedProject(project);
      await onContributorAction();
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

  const reviewCreateProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#review-create-project-button",
  );

  function closeConfirmationModal(): void {
    if (!confirmationModal) {
      return;
    }

    confirmationModal.hidden = true;
    reviewCreateProjectButton?.focus();
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
    submitCreateProjectButton?.focus();
  }

  confirmationModal?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    closeConfirmationModal();
  });

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

  const invitationForProject =
    activeInvitation?.projectId === selectedProject.id
      ? activeInvitation
      : null;
  const isGuestProject =
    selectedProject.access === "guest" && selectedProject.role == null;

  const contributorButton = getElement<HTMLButtonElement>(
    appElement,
    "#become-contributor-button",
  );
  const contributorStatusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#contributor-invitation-status",
  );

  contributorButton?.addEventListener("click", () => {
    void runBusyButtonAction(contributorButton, async () => {
      try {
        await onContributorAction();
      } catch (error) {
        if (contributorStatusElement) {
          contributorStatusElement.textContent =
            error instanceof Error
              ? error.message
              : "Could not accept the collaboration invitation.";
        }
      }
    });
  });

  const guestAccessBanner = getElement<HTMLElement>(
    appElement,
    "#guest-access-banner",
  );
  const dismissGuestAccessButton = getElement<HTMLButtonElement>(
    appElement,
    "#dismiss-guest-access-button",
  );
  const contributorInvitationCard = getElement<HTMLElement>(
    appElement,
    "#contributor-invitation-card",
  );
  const dismissContributorInvitationButton = getElement<HTMLButtonElement>(
    appElement,
    "#dismiss-contributor-invitation-button",
  );

  dismissGuestAccessButton?.addEventListener("click", () => {
    if (guestAccessBanner) {
      guestAccessBanner.hidden = true;
    }
  });

  dismissContributorInvitationButton?.addEventListener("click", () => {
    if (contributorInvitationCard) {
      contributorInvitationCard.hidden = true;
    }
  });

  const loadingElement = getElement<HTMLElement>(
    appElement,
    "#project-player-loading",
  );
  const contentElement = getElement<HTMLElement>(
    appElement,
    "#project-player-content",
  );

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
    "[data-project-title-display]",
  );

  const projectMobileTitleElement = getElement<HTMLElement>(
    appElement,
    "[data-project-mobile-title-display]",
  );

  const projectDescriptionElement = getElement<HTMLElement>(
    appElement,
    "[data-project-description-display]",
  );

  const projectEditModal = getElement<HTMLElement>(
    appElement,
    "#project-edit-modal",
  );
  const projectEditForm = getElement<HTMLFormElement>(
    appElement,
    "#project-edit-form",
  );
  const projectEditTitleInput = getElement<HTMLInputElement>(
    appElement,
    "#project-edit-title-input",
  );
  const projectEditDescriptionInput = getElement<HTMLTextAreaElement>(
    appElement,
    "#project-edit-description-input",
  );
  const projectEditSaveButton = getElement<HTMLButtonElement>(
    appElement,
    "#save-project-edit-button",
  );
  const projectEditCancelButton = getElement<HTMLButtonElement>(
    appElement,
    "#cancel-project-edit-button",
  );
  const projectEditCloseButton = getElement<HTMLButtonElement>(
    appElement,
    "#close-project-edit-button",
  );
  const projectEditStatusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#project-edit-status",
  );

  const trackEditModal = getElement<HTMLElement>(
    appElement,
    "#track-edit-modal",
  );
  const trackEditForm = getElement<HTMLFormElement>(
    appElement,
    "#track-edit-form",
  );
  const trackEditNameInput = getElement<HTMLInputElement>(
    appElement,
    "#track-edit-name-input",
  );
  const trackEditSaveButton = getElement<HTMLButtonElement>(
    appElement,
    "#save-track-edit-button",
  );
  const trackEditCancelButton = getElement<HTMLButtonElement>(
    appElement,
    "#cancel-track-edit-button",
  );
  const trackEditCloseButton = getElement<HTMLButtonElement>(
    appElement,
    "#close-track-edit-button",
  );
  const trackEditStatusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#track-edit-status",
  );

  if (!trackListElement) {
    initializeMobileNavigation({
      appElement,
      onHome: currentUser ? () => navigateTo("project-menu") : onGuestAuth,
      onLogout: currentUser ? onLogout : undefined,
      onAuth: currentUser ? undefined : onGuestAuth,
    });
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

  const playbackEngine = createWebAudioPlaybackEngine({
    ...(invitationForProject
      ? {
          fetchAudioData: createInvitationAudioDataFetcher(
            invitationForProject.token,
          ),
        }
      : {}),
    createFallbackEngine: () => createHtmlAudioPlaybackEngine({
      primaryAudioElement: audioElement,
      createAudioElement: () => document.createElement("audio"),
    }),
  });

  const audioPlayerController = createAudioPlayerController({
    playbackEngine,
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

  const projectTracksApi = invitationForProject
    ? {
        ...tracksApi,
        getTracksByProjectId(projectId: string) {
          return tracksApi.getTracksByProjectId(
            projectId,
            invitationForProject.token,
          );
        },
      }
    : tracksApi;

  const projectStorageProvider = isGuestProject
    ? createGuestMixStorageProvider(
        selectedProject.id,
        storageProvider,
      )
    : storageProvider;

  const controller = createProjectPlayerPageController({
    project: selectedProject,
    trackListElement,
    loadingElement,
    contentElement,
    statusElement,
    deleteProjectButton,
    projectTitleElement,
    projectMobileTitleElement,
    projectDescriptionElement,
    projectEditModal,
    projectEditForm,
    projectEditTitleInput,
    projectEditDescriptionInput,
    projectEditSaveButton,
    projectEditCancelButton,
    projectEditCloseButton,
    projectEditStatusElement,
    trackEditModal,
    trackEditForm,
    trackEditNameInput,
    trackEditSaveButton,
    trackEditCancelButton,
    trackEditCloseButton,
    trackEditStatusElement,
    tracksApi: projectTracksApi,
    projectsApi,
    audioPlayerController,
    getTrackAudioUrl,
    chooseAudioFile,
    renderTrackList: renderMixChannelSlots,
    // Guest is not a Viewer membership. The shared controller receives the
    // Viewer permission policy only so Guest controls remain read-only while
    // the Guest-specific storage adapter keeps its mix separately.
    projectRole: selectedProject.role ?? "viewer",
    currentUserId: currentUser?.id ?? null,
    storageProvider: projectStorageProvider,
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
    void runBusyButtonAction(backButton, leavePlayerWithBack);
  });

  logoutButton?.addEventListener("click", () => {
    void runBusyButtonAction(logoutButton, logoutFromPlayer);
  });

  initializeMobileNavigation({
    appElement,
    onHome: currentUser ? leavePlayerForHome : onGuestAuth,
    onLogout: currentUser ? logoutFromPlayer : undefined,
    onAuth: currentUser ? undefined : onGuestAuth,
  });

  let destroyProjectActionsMenu: (() => void) | null = null;

  if (selectedProject.role === "owner") {
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
    const memberSubmitButton = getElement<HTMLButtonElement>(
      appElement,
      "#add-project-member-button",
    );
    const memberListElement = getElement<HTMLDivElement>(
      appElement,
      "#project-member-list",
    );
    const memberStatusElement = getElement<HTMLParagraphElement>(
      appElement,
      "#project-member-status",
    );

    let refreshMembers: (() => Promise<void>) | null = null;

    if (
      memberForm &&
      memberEmailInput &&
      memberRoleSelect &&
      memberSubmitButton &&
      memberListElement
    ) {
      const membersController = createProjectMembersController({
        projectId: selectedProject.id,
        form: memberForm,
        emailInput: memberEmailInput,
        roleSelect: memberRoleSelect,
        submitButton: memberSubmitButton,
        memberListElement,
        statusElement: memberStatusElement,
        projectMembersApi,
        renderMembers: renderProjectMemberList,
      });

      refreshMembers = membersController.loadMembers;
      void membersController.init();
    }

    const invitationStatusElement = getElement<HTMLParagraphElement>(
      appElement,
      "#project-invitation-status",
    );
    const invitationLinkInput = getElement<HTMLInputElement>(
      appElement,
      "#project-invitation-link",
    );
    const generateInvitationButton = getElement<HTMLButtonElement>(
      appElement,
      "#generate-project-invitation-button",
    );
    const copyInvitationButton = getElement<HTMLButtonElement>(
      appElement,
      "#copy-project-invitation-button",
    );
    const regenerateInvitationButton = getElement<HTMLButtonElement>(
      appElement,
      "#regenerate-project-invitation-button",
    );
    const disableInvitationButton = getElement<HTMLButtonElement>(
      appElement,
      "#disable-project-invitation-button",
    );

    if (
      invitationStatusElement &&
      invitationLinkInput &&
      generateInvitationButton &&
      copyInvitationButton &&
      regenerateInvitationButton &&
      disableInvitationButton
    ) {
      const invitationController = createProjectInvitationController({
        projectId: selectedProject.id,
        invitationApi: invitationsApi,
        statusElement: invitationStatusElement,
        linkInput: invitationLinkInput,
        generateButton: generateInvitationButton,
        copyButton: copyInvitationButton,
        regenerateButton: regenerateInvitationButton,
        disableButton: disableInvitationButton,
        buildShareLink: buildBrowserInvitationShareLink,
        copyText: copyBrowserText,
      });

      invitationController.init();
    }

    const projectActionsButton = getElement<HTMLButtonElement>(
      appElement,
      "#project-actions-button",
    );
    const projectActionsMenu = getElement<HTMLDivElement>(
      appElement,
      "#project-actions-menu",
    );
    const editProjectButton = getElement<HTMLButtonElement>(
      appElement,
      "#edit-project-menu-item",
    );
    const manageMembersButton = getElement<HTMLButtonElement>(
      appElement,
      "#manage-members-menu-item",
    );
    const manageMembersPanel = getElement<HTMLElement>(
      appElement,
      "#project-members-panel",
    );
    const manageMembersCloseButton = getElement<HTMLButtonElement>(
      appElement,
      "#close-project-members-button",
    );
    const collaborationLinkButton = getElement<HTMLButtonElement>(
      appElement,
      "#collaboration-link-menu-item",
    );
    const collaborationLinkPanel = getElement<HTMLElement>(
      appElement,
      "#project-invitation-panel",
    );
    const collaborationLinkCloseButton = getElement<HTMLButtonElement>(
      appElement,
      "#close-project-invitation-button",
    );

    if (projectActionsButton && projectActionsMenu) {
      const projectActionsController =
        createProjectActionsMenuController({
          triggerButton: projectActionsButton,
          menuElement: projectActionsMenu,
          editProjectButton,
          manageMembersButton,
          manageMembersPanel,
          manageMembersCloseButton,
          collaborationLinkButton,
          collaborationLinkPanel,
          collaborationLinkCloseButton,
          onEditProject: controller.openProjectEditor,
          onOpenManageMembers: refreshMembers ?? undefined,
        });

      projectActionsController.init();
      destroyProjectActionsMenu = projectActionsController.destroy;

      deleteProjectButton?.addEventListener("click", () => {
        projectActionsController.closeMenu();
      });
    }
  }

  return () => {
    destroyProjectActionsMenu?.();
    audioPlayerController.destroy();
    void controller.flushPendingMixSettings();
  };
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
  if (currentScreen === "auth") {
    initializeAuthPage({
      appElement,
      sessionProvider,
      onAuthenticated,
    });

    return null;
  }

  if (currentScreen === "invitation") {
    return null;
  }

  if (currentScreen === "project-menu") {
    initializeProjectMenuPage({
      appElement,
      navigateTo,
      setSelectedProject,
      getInvitedProject,
      getInvitationProjectId,
      projectDraftState,
      onOpenProject,
      onContributorAction,
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
      storageProvider,
      activeInvitation,
      onContributorAction,
      onGuestAuth,
      onLogout,
    });
  }

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
  let selectedProject: Project | null = null;
  let currentUser: User | null = null;
  let authMessage = "";
  let projectMenuMessage = "";
  let projectPlayerNotice = "";
  let activePageCleanup: (() => void) | null = null;
  let historyNavigationRevision = 0;
  const projectDraftState = createProjectDraftState();
  const invitationWorkflow = createInvitationGuestWorkflow({
    projects: projectsApi,
    invitations: invitationsApi,
    sessionStore: invitationSessionStore,
  });

  function setSelectedProject(project: Project): void {
    selectedProject = project;
  }

  function getActiveInvitedProjectForMenu(): Project | null {
    return invitationWorkflow.getInvitedProjectForMenu(
      currentUser,
      selectedProject,
    );
  }

  function getActiveInvitationProjectId(): string | null {
    return invitationWorkflow.getInvitationProjectIdForMenu(currentUser);
  }

  function applyInvitationTransition(
    transition: InvitationWorkflowTransition,
  ): AppRoute {
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
    return transition.route;
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
      first.projectId === second.projectId &&
      first.invitationToken === second.invitationToken
    );
  }

  async function resolveRequestedRoute(
    requestedRoute: AppRoute,
  ): Promise<AppRoute> {
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
        // Guest/invitation routes are always revalidated before the Project
        // Player is rendered again. This prevents browser/app history from
        // reviving a cached project after the Owner disables/regenerates the link.
        selectedProject =
          await invitationWorkflow.loadProjectWithInvitationValidation(
            projectId,
            currentUser,
          );
      } else if (
        selectedProject?.id === projectId &&
        selectedProject?.access !== "guest"
      ) {
        // A normal authenticated member project can safely reuse the current
        // client snapshot during in-app navigation.
      } else {
        selectedProject = await projectsApi.getProject(projectId);
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

  function disposeCurrentPage(): void {
    activePageCleanup?.();
    activePageCleanup = null;
  }

  const router = createAppRouter({
    appElement,
    initialScreen,
    historyAdapter,
    pageRenderers: {
      auth: () =>
        presentationPort.showAuthentication({ message: authMessage }),
      invitation: () =>
        presentationPort.showLoading({
          message: "Opening collaboration invitation...",
        }),
      "project-menu": () =>
        presentationPort.showProjects({
          currentUser,
          statusMessage: projectMenuMessage,
        }),
      "create-project": () =>
        presentationPort.showCreateProject({
          projectDraft: projectDraftState.getProjectDraft(),
        }),
      "project-player": () =>
        presentationPort.showProjectPlayer({
          project: selectedProject,
          currentUser,
          invitation: selectedProject
            ? invitationWorkflow.getPresentationState(
                selectedProject.id,
                currentUser,
              )
            : { status: "none" },
          statusMessage: projectPlayerNotice,
        }),
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
      getInvitedProject: getActiveInvitedProjectForMenu,
      getInvitationProjectId: getActiveInvitationProjectId,
      selectedProject,
      currentUser,
      projectDraftState,
      sessionProvider,
      storageProvider,
      activeInvitation: invitationWorkflow.getSession(),
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

  function canNavigateWithoutAuthentication(
    screen: AppScreen,
  ): boolean {
    return invitationWorkflow.canNavigateWithoutAuthentication(
      screen,
      selectedProject,
    );
  }

  function navigateTo(
    screen: AppScreen,
    { replace = false }: NavigateOptions = {},
  ): void {
    disposeCurrentPage();

    const nextScreen =
      currentUser || canNavigateWithoutAuthentication(screen)
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

    const resolvedFallbackScreen =
      currentUser || canNavigateWithoutAuthentication(fallbackScreen)
        ? fallbackScreen
        : "auth";
    const fallbackRoute = getRouteForScreen(resolvedFallbackScreen);

    const waitingForBrowserHistory = router.goBack(fallbackRoute);

    if (!waitingForBrowserHistory) {
      initializeRenderedPage();
    }
  }

  async function handleHistoryNavigation(route: AppRoute): Promise<void> {
    const navigationRevision = ++historyNavigationRevision;

    disposeCurrentPage();

    if (
      (route.screen === "project-player" ||
        route.screen === "invitation") &&
      (route.screen === "invitation" ||
        (route.projectId &&
          (selectedProject?.id !== route.projectId ||
            Boolean(
              invitationWorkflow.getInvitationForProject(route.projectId),
            ))))
    ) {
      appElement.innerHTML = presentationPort.showLoading({
        message:
          route.screen === "invitation"
            ? "Opening collaboration invitation..."
            : "Loading your project...",
      });
    }

    const resolvedRoute = await resolveRequestedRoute(route);

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

  async function resumeInvitationAfterAuthentication(): Promise<void> {
    if (!currentUser) {
      navigateTo("auth", { replace: true });
      return;
    }

    const transition = await invitationWorkflow.resumeAfterAuthentication(
      currentUser,
    );
    applyInvitationTransition(transition);
    navigateTo(transition.route.screen, { replace: true });
  }

  function handleAuthenticated(user: User): void {
    currentUser = user;
    authMessage = "";
    projectMenuMessage = "";
    void resumeInvitationAfterAuthentication();
  }

  function handleGuestAuth(): void {
    const transition = invitationWorkflow.requestGuestAuthentication();
    applyInvitationTransition(transition);
    navigateTo(transition.route.screen);
  }

  async function handleOpenProjectFromMenu(project: Project): Promise<void> {
    projectMenuMessage = "";
    projectPlayerNotice = "";

    try {
      selectedProject = await invitationWorkflow.openProjectFromMenu(
        project,
        currentUser,
      );
    } catch {
      selectedProject = null;
      projectMenuMessage = INVALID_INVITATION_MESSAGE;
      throw new Error(INVALID_INVITATION_MESSAGE);
    }

    navigateTo("project-player");
  }

  async function handleContributorAction(): Promise<void> {
    const transition = await invitationWorkflow.acceptContributor({
      selectedProject,
      currentUser,
      currentScreen: router.getCurrentScreen(),
    });

    applyInvitationTransition(transition);
    navigateTo(transition.route.screen, { replace: true });

    if (transition.error) {
      throw transition.error;
    }
  }

  async function handleLogout(): Promise<void> {
    try {
      await sessionProvider.logout();
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
    projectDraftState.clear();

    const transition = await invitationWorkflow.continueAfterLogout();
    applyInvitationTransition(transition);
    navigateTo(transition.route.screen, { replace: true });
  }

  function handleAuthenticationRequired(): void {
    if (!currentUser) {
      return;
    }

    currentUser = null;
    projectDraftState.clear();

    void (async () => {
      const transition =
        await invitationWorkflow.recoverAfterSessionExpiration();
      applyInvitationTransition(transition);
      navigateTo(transition.route.screen, { replace: true });
    })();
  }

  setAuthenticationRequiredHandler(
    handleAuthenticationRequired,
  );

  async function start(): Promise<void> {
    const requestedRoute = router.getRequestedRoute();

    try {
      currentUser = await sessionProvider.getCurrentUser();
      authMessage = "";
    } catch (error) {
      currentUser = null;

      if (error instanceof ApiError && error.statusCode === 401) {
        authMessage = "";
      } else {
        authMessage =
          "Could not restore your account session. Guest invitation access may still be available.";
      }
    }

    const initialRoute = await resolveRequestedRoute(requestedRoute);
    router.start(initialRoute);
    initializeRenderedPage();
  }

  return {
    start,
    navigateTo,
    getCurrentScreen: router.getCurrentScreen,
    getCurrentUser: () => currentUser,
  };
}
