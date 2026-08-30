import {
  createGuestMixStorageProvider,
  createHtmlAudioPlaybackEngine,
  createMicrophoneRecordingSession,
  createProjectDraftState,
  createRecordingWorkspaceState,
  createWebAudioPlaybackEngine,
  getProjectMusicalTimeline,
  loadRecordingAlignmentCompensationMilliseconds,
  saveRecordingAlignmentCompensationMilliseconds,
  type ApplicationNavigationOptions,
  type ApplicationPresentationPort,
  type InvitationSessionState,
  type InvitationSessionStore,
  type PendingTrackDraft as CorePendingTrackDraft,
  type ProjectDraftState as CoreProjectDraftState,
  type SessionProvider,
  type StorageProvider,
} from "@hugovela/frontend-core";
import {
  buildBrowserInvitationShareLink,
  copyBrowserText,
  createBrowserMicrophoneRecordingAdapter,
  createBrowserOutputKeepalivePlaybackEngine,
  createBrowserRecordingAlignmentDiagnostics,
  createBrowserRecordedTakePlaybackAdapter,
  createBrowserRecordedTakeDraftPort,
  createBrowserRecordedTakeUploadAdapter,
  createBrowserGrooveShareApp,
  getBrowserInvitationSessionStore,
  getBrowserStorageProvider,
  type AppScreen,
  type HistoryAdapter,
} from "@hugovela/frontend-browser";
import { browserFrontendRuntime } from "./platform/browser-frontend-runtime.js";
import { createCreateProjectPageController } from "./page-controllers/create-project-page-controller.js";
import { createProjectMenuPageController } from "./page-controllers/project-menu-page-controller.js";
import { createProjectPlayerPageController } from "./page-controllers/project-player-page-controller.js";
import { createProjectMembersController } from "./page-controllers/project-members-controller.js";
import { createProjectActionsMenuController } from "./page-controllers/project-actions-menu-controller.js";
import { createProjectDetailsScrollController } from "./page-controllers/project-details-scroll-controller.js";
import { createProjectInvitationController } from "./page-controllers/project-invitation-controller.js";
import { createAudioPlayerController } from "./page-controllers/audio-player-controller.js";
import { createMicrophoneRecordingController } from "./page-controllers/microphone-recording-controller.js";
import { createProjectTrackSelectionController } from "./page-controllers/create-project-track-selection-controller.js";
import { createCreateProjectConfirmationController } from "./page-controllers/create-project-confirmation-controller.js";
import { createAuthPageController } from "./page-controllers/auth-page-controller.js";
import { renderPendingTrackList } from "./templates/pending-track-list.js";
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

type PendingTrackDraft = CorePendingTrackDraft<File>;
type ProjectDraftState = CoreProjectDraftState<File>;

const frontendServices = browserFrontendRuntime.services;
const projectsApi = frontendServices.projects;
const projectMembersApi = frontendServices.projectMembers;
const tracksApi = frontendServices.tracks;
const invitationsApi = frontendServices.invitations;
const getTrackAudioUrl = tracksApi.getTrackAudioUrl;
const createInvitationAudioDataFetcher =
  tracksApi.createInvitationAudioDataFetcher;

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
  const bpmInput = getElement<HTMLInputElement>(
    appElement,
    "#project-bpm",
  );
  const timeSignatureNumeratorInput = getElement<HTMLInputElement>(
    appElement,
    "#project-time-signature-numerator",
  );
  const timeSignatureDenominatorInput = getElement<HTMLSelectElement>(
    appElement,
    "#project-time-signature-denominator",
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

  const confirmationMusicalTimelineElement = getElement<HTMLElement>(
    appElement,
    "#create-project-confirmation-musical-timeline",
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
      !confirmationMusicalTimelineElement ||
      !confirmationTrackListElement
    ) {
      return;
    }

    confirmationProjectTitleElement.textContent = snapshot.project.title;

    confirmationProjectDescriptionElement.textContent =
      snapshot.project.description.trim() || "No description provided.";

    const timeline = snapshot.project.musicalTimeline;
    confirmationMusicalTimelineElement.textContent = timeline
      ? `${timeline.bpm} BPM · ${timeline.timeSignature.numerator}/${timeline.timeSignature.denominator} · Bar 1 at project start`
      : "120 BPM · 4/4 · Bar 1 at project start";

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

  if (
    form &&
    titleInput &&
    descriptionInput &&
    bpmInput &&
    timeSignatureNumeratorInput &&
    timeSignatureDenominatorInput &&
    statusElement
  ) {
    const controller = createCreateProjectPageController({
      form,
      titleInput,
      descriptionInput,
      bpmInput,
      timeSignatureNumeratorInput,
      timeSignatureDenominatorInput,
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
  activeInvitation: InvitationSessionState | null;
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

  const projectDetailsTrackNamesElement = getElement<HTMLElement>(
    appElement,
    "#project-details-track-names",
  );

  const projectDetailsEditButton = getElement<HTMLButtonElement>(
    appElement,
    "#project-details-edit-button",
  );

  const projectDetailsElement = getElement<HTMLDetailsElement>(
    appElement,
    "[data-project-details]",
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
  const trackEditStartBarInput = getElement<HTMLInputElement>(
    appElement,
    "#track-edit-start-bar-input",
  );
  const trackEditStartBeatInput = getElement<HTMLInputElement>(
    appElement,
    "#track-edit-start-beat-input",
  );
  const trackEditLengthBarsInput = getElement<HTMLInputElement>(
    appElement,
    "#track-edit-length-bars-input",
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

  const seekForwardButton = getElement<HTMLButtonElement>(
    appElement,
    "#audio-seek-forward-button",
  );

  const stopButton = getElement<HTMLButtonElement>(
    appElement,
    "#audio-stop-button",
  );

  const loopCheckbox = getElement<HTMLInputElement>(
    appElement,
    "#audio-loop-checkbox",
  );

  const metronomeCheckbox = getElement<HTMLInputElement>(
    appElement,
    "#audio-metronome-checkbox",
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

  const musicalPositionElement = getElement<HTMLElement>(
    appElement,
    "#audio-musical-position",
  );

  const seekBarInput = getElement<HTMLInputElement>(
    appElement,
    "#audio-seek-bar-input",
  );

  const seekBeatInput = getElement<HTMLInputElement>(
    appElement,
    "#audio-seek-beat-input",
  );

  const seekBarButton = getElement<HTMLButtonElement>(
    appElement,
    "#audio-seek-bar-button",
  );

  const trackNameElement = getElement<HTMLElement>(
    appElement,
    "#audio-track-name",
  );

  const preparationElement = getElement<HTMLElement>(
    appElement,
    "#audio-playback-preparation",
  );
  const preparationMessageElement = getElement<HTMLElement>(
    appElement,
    "#audio-playback-preparation-message",
  );
  const preparationRetryButton = getElement<HTMLButtonElement>(
    appElement,
    "#audio-playback-preparation-retry",
  );

  if (
    !audioElement ||
    !seekBackwardButton ||
    !seekForwardButton ||
    !playPauseButton ||
    !stopButton ||
    !progressInput ||
    !timestampElement ||
    !durationElement ||
    !musicalPositionElement ||
    !seekBarInput ||
    !seekBeatInput ||
    !seekBarButton ||
    !trackNameElement ||
    !loopCheckbox ||
    !metronomeCheckbox
  ) {
    throw new Error("Project Player audio elements were not found.");
  }

  const musicalTimeline = getProjectMusicalTimeline(selectedProject);
  const recordingAlignmentDiagnostics =
    createBrowserRecordingAlignmentDiagnostics();
  const basePlaybackEngine = createWebAudioPlaybackEngine({
    musicalTimeline,
    recordingAlignmentDiagnostics,
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
      musicalTimeline,
    }),
  });
  const playbackEngine = createBrowserOutputKeepalivePlaybackEngine({
    playbackEngine: basePlaybackEngine,
  });

  const recordingWorkspaceState = createRecordingWorkspaceState({
    projectId: selectedProject.id,
    storageProvider,
    userId: currentUser?.id,
  });
  const audioPlayerController = createAudioPlayerController({
    playbackEngine,
    musicalTimeline,
    projectId: selectedProject.id,
    debugLogger: (message, details) => console.info(message, details),
    seekBackwardButton,
    seekForwardButton,
    playPauseButton,
    stopButton,
    progressInput,
    timestampElement,
    durationElement,
    musicalPositionElement,
    seekBarInput,
    seekBeatInput,
    seekBarButton,
    trackNameElement,
    ...(preparationElement && preparationMessageElement && preparationRetryButton
      ? { preparationElement, preparationMessageElement, preparationRetryButton }
      : {}),
    loopCheckbox,
    metronomeCheckbox,
    recordingWorkspaceState,
  });

  audioPlayerController.init();

  const microphoneArmButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-arm-button",
  );
  const microphoneArmButtonLabel = getElement<HTMLElement>(
    appElement,
    "#microphone-arm-button-label",
  );
  const microphoneRecordingWorkspace = getElement<HTMLElement>(
    appElement,
    "#microphone-recording-workspace",
  );
  const microphonePreparingView = getElement<HTMLElement>(
    appElement,
    "#microphone-preparing-view",
  );
  const microphoneReadyView = getElement<HTMLElement>(
    appElement,
    "#microphone-ready-view",
  );
  const microphoneFailureView = getElement<HTMLElement>(
    appElement,
    "#microphone-failure-view",
  );
  const microphoneRecoveryView = getElement<HTMLElement>(
    appElement,
    "#microphone-recovery-view",
  );
  const microphoneCountInView = getElement<HTMLElement>(
    appElement,
    "#microphone-count-in-view",
  );
  const microphoneActiveRecordingView = getElement<HTMLElement>(
    appElement,
    "#microphone-active-recording-view",
  );
  const microphoneProcessingView = getElement<HTMLElement>(
    appElement,
    "#microphone-processing-view",
  );
  const microphoneReviewView = getElement<HTMLElement>(
    appElement,
    "#microphone-review-view",
  );
  const microphoneReviewCloseButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-review-close-button",
  );
  const microphonePreparingCloseButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-preparing-close-button",
  );
  const microphoneReadyCloseButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-ready-close-button",
  );
  const microphoneFailureCloseButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-failure-close-button",
  );
  const microphoneRecoveryCloseButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-recovery-close-button",
  );
  const microphoneCancelButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-cancel-button",
  );
  const microphoneFailureCancelButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-failure-cancel-button",
  );
  const microphoneRecoveryCancelButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-recovery-cancel-button",
  );
  const microphonePermissionRetryButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-retry-permission-button",
  );
  const microphoneCountInCancelButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-count-in-cancel-button",
  );
  const microphoneCountInNumber = getElement<HTMLElement>(
    appElement,
    "#microphone-count-in-number",
  );
  const microphoneCountInBeats = getElement<HTMLElement>(
    appElement,
    "#microphone-count-in-beats",
  );
  const microphoneCountInPosition = getElement<HTMLElement>(
    appElement,
    "#microphone-count-in-position",
  );
  const microphoneRecordingElapsed = getElement<HTMLElement>(
    appElement,
    "#microphone-recording-elapsed",
  );
  const microphoneRecordingPosition = getElement<HTMLElement>(
    appElement,
    "#microphone-recording-position",
  );
  const microphoneFailureHeading = getElement<HTMLElement>(
    appElement,
    "#microphone-failure-heading",
  );
  const microphoneFailureMessage = getElement<HTMLElement>(
    appElement,
    "#microphone-failure-message",
  );
  const microphoneRecoveryHeading = getElement<HTMLElement>(
    appElement,
    "#microphone-recovery-heading",
  );
  const microphoneRecoveryMessage = getElement<HTMLElement>(
    appElement,
    "#microphone-recovery-message",
  );
  const microphoneRecoveryRetryButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-recovery-retry-button",
  );
  const microphoneStartPositionButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-start-position-button",
  );
  const microphoneStartPositionLabel = getElement<HTMLElement>(
    appElement,
    "#microphone-start-position-label",
  );
  const microphoneStartPositionEditor = getElement<HTMLElement>(
    appElement,
    "#microphone-start-position-editor",
  );
  const microphoneStartBarInput = getElement<HTMLInputElement>(
    appElement,
    "#microphone-start-bar-input",
  );
  const microphoneStartBeatInput = getElement<HTMLInputElement>(
    appElement,
    "#microphone-start-beat-input",
  );
  const microphoneStartPositionApplyButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-start-position-apply-button",
  );
  const microphoneStartPositionStatus = getElement<HTMLElement>(
    appElement,
    "#microphone-start-position-status",
  );
  const microphoneRecordingStartStatus = getElement<HTMLElement>(
    appElement,
    "#microphone-recording-start-status",
  );
  const microphoneRecordButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-record-button",
  );
  const microphoneStopButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-stop-button",
  );
  const microphoneAuditionButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-audition-button",
  );
  const microphoneRetryButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-retry-button",
  );
  const microphoneDiscardButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-discard-button",
  );
  const microphoneKeepButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-keep-button",
  );
  const microphoneTakeNameInput = getElement<HTMLInputElement>(
    appElement,
    "#microphone-take-name-input",
  );
  const microphoneStatusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#microphone-recording-status",
  );
  const microphoneAlignmentValueElement = getElement<HTMLElement>(
    appElement,
    "#microphone-alignment-value",
  );
  const microphoneAlignmentSummaryElement = getElement<HTMLElement>(
    appElement,
    "#microphone-alignment-summary",
  );
  const microphoneReviewHeading = getElement<HTMLElement>(
    appElement,
    "#microphone-review-heading",
  );
  const microphoneReviewRecovered = getElement<HTMLElement>(
    appElement,
    "#microphone-review-recovered",
  );
  const microphoneReviewPosition = getElement<HTMLElement>(
    appElement,
    "#microphone-review-position",
  );
  const microphoneReviewDuration = getElement<HTMLElement>(
    appElement,
    "#microphone-review-duration",
  );
  const microphoneReviewTimeline = getElement<HTMLElement>(
    appElement,
    "#microphone-review-timeline",
  );
  const microphoneReviewStatus = getElement<HTMLElement>(
    appElement,
    "#microphone-review-status",
  );
  const microphoneAuditionVolumeInput = getElement<HTMLInputElement>(
    appElement,
    "#microphone-audition-volume",
  );
  const microphoneAuditionVolumeValue = getElement<HTMLElement>(
    appElement,
    "#microphone-audition-volume-value",
  );
  const microphoneKeepDialog = getElement<HTMLDialogElement>(
    appElement,
    "#microphone-keep-dialog",
  );
  const microphoneKeepConfirmButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-keep-confirm",
  );
  const microphoneKeepCancelButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-keep-cancel",
  );
  const microphoneKeepMetadata = getElement<HTMLElement>(
    appElement,
    "#microphone-keep-metadata",
  );
  const microphoneKeepStatus = getElement<HTMLElement>(
    appElement,
    "#microphone-keep-status",
  );
  const microphoneDiscardDialog = getElement<HTMLDialogElement>(
    appElement,
    "#microphone-discard-dialog",
  );
  const microphoneDiscardConfirmButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-discard-confirm",
  );
  const microphoneDiscardCancelButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-discard-cancel",
  );
  const microphoneDiscardStatus = getElement<HTMLElement>(
    appElement,
    "#microphone-discard-status",
  );
  const microphoneAlignmentEarlier100Button = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-alignment-earlier-100",
  );
  const microphoneAlignmentEarlier10Button = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-alignment-earlier-10",
  );
  const microphoneAlignmentEarlier1Button = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-alignment-earlier-1",
  );
  const microphoneAlignmentResetButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-alignment-reset",
  );
  const microphoneAlignmentLater1Button = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-alignment-later-1",
  );
  const microphoneAlignmentLater10Button = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-alignment-later-10",
  );
  const microphoneAlignmentLater100Button = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-alignment-later-100",
  );
  const recordingRole = selectedProject.role ?? null;
  const takePlaybackPort = createBrowserRecordedTakePlaybackAdapter();
  const recordingSession =
    (recordingRole === "owner" || recordingRole === "contributor") &&
    microphoneArmButton &&
    microphoneRecordButton &&
    microphoneStopButton &&
    microphoneAuditionButton &&
    microphoneRetryButton &&
    microphoneDiscardButton &&
    microphoneKeepButton &&
    microphoneTakeNameInput &&
    microphoneStatusElement
      ? createMicrophoneRecordingSession({
          role: recordingRole,
          recordingPort: createBrowserMicrophoneRecordingAdapter({
            recordingAlignmentDiagnostics,
          }),
          takePlaybackPort,
          takeDraftPort: createBrowserRecordedTakeDraftPort() ?? undefined,
          takeDraftScopeId: `${currentUser?.id ?? "anonymous"}:${selectedProject.id}`,
          takeUploadPort: createBrowserRecordedTakeUploadAdapter({
            tracksService: tracksApi,
          }),
          projectId: selectedProject.id,
          playbackEngine,
          musicalTimeline,
          recordingAlignmentDiagnostics,
          initialAlignmentCompensationMilliseconds:
            loadRecordingAlignmentCompensationMilliseconds(storageProvider),
          onAlignmentCompensationChanged(value) {
            saveRecordingAlignmentCompensationMilliseconds(
              value,
              storageProvider,
            );
          },
        })
      : null;
  let refreshProjectTracks: (() => Promise<void>) | null = null;
  const microphoneRecordingController = recordingSession &&
    microphoneArmButton &&
    microphoneRecordButton &&
    microphoneStopButton &&
    microphoneAuditionButton &&
    microphoneRetryButton &&
    microphoneDiscardButton &&
    microphoneKeepButton &&
    microphoneTakeNameInput &&
    microphoneStatusElement
      ? createMicrophoneRecordingController({
          recordingSession,
          armButton: microphoneArmButton,
          armButtonLabelElement: microphoneArmButtonLabel ?? undefined,
          workspaceElement: microphoneRecordingWorkspace ?? undefined,
          preparingViewElement: microphonePreparingView ?? undefined,
          readyViewElement: microphoneReadyView ?? undefined,
          failureViewElement: microphoneFailureView ?? undefined,
          recoveryViewElement: microphoneRecoveryView ?? undefined,
          countInViewElement: microphoneCountInView ?? undefined,
          activeRecordingViewElement: microphoneActiveRecordingView ?? undefined,
          processingViewElement: microphoneProcessingView ?? undefined,
          reviewViewElement: microphoneReviewView ?? undefined,
          reviewCloseButton: microphoneReviewCloseButton ?? undefined,
          cancelButtons: [
            microphonePreparingCloseButton,
            microphoneReadyCloseButton,
            microphoneFailureCloseButton,
            microphoneRecoveryCloseButton,
            microphoneCancelButton,
            microphoneFailureCancelButton,
            microphoneRecoveryCancelButton,
          ].filter((button): button is HTMLButtonElement => Boolean(button)),
          permissionRetryButton: microphonePermissionRetryButton ?? undefined,
          countInCancelButton: microphoneCountInCancelButton ?? undefined,
          failureHeadingElement: microphoneFailureHeading ?? undefined,
          failureMessageElement: microphoneFailureMessage ?? undefined,
          recoveryHeadingElement: microphoneRecoveryHeading ?? undefined,
          recoveryMessageElement: microphoneRecoveryMessage ?? undefined,
          recoveryRetryButton: microphoneRecoveryRetryButton ?? undefined,
          startPositionButton: microphoneStartPositionButton ?? undefined,
          startPositionLabelElement: microphoneStartPositionLabel ?? undefined,
          startPositionEditorElement: microphoneStartPositionEditor ?? undefined,
          startBarInput: microphoneStartBarInput ?? undefined,
          startBeatInput: microphoneStartBeatInput ?? undefined,
          startPositionApplyButton: microphoneStartPositionApplyButton ?? undefined,
          startPositionStatusElement: microphoneStartPositionStatus ?? undefined,
          recordingStartStatusElement: microphoneRecordingStartStatus ?? undefined,
          countInNumberElement: microphoneCountInNumber ?? undefined,
          countInBeatsElement: microphoneCountInBeats ?? undefined,
          countInPositionElement: microphoneCountInPosition ?? undefined,
          recordingElapsedElement: microphoneRecordingElapsed ?? undefined,
          recordingPositionElement: microphoneRecordingPosition ?? undefined,
          reviewHeadingElement: microphoneReviewHeading ?? undefined,
          reviewRecoveredElement: microphoneReviewRecovered ?? undefined,
          reviewPositionElement: microphoneReviewPosition ?? undefined,
          reviewDurationElement: microphoneReviewDuration ?? undefined,
          reviewTimelineElement: microphoneReviewTimeline ?? undefined,
          reviewStatusElement: microphoneReviewStatus ?? undefined,
          auditionVolumeInput: microphoneAuditionVolumeInput ?? undefined,
          auditionVolumeValueElement: microphoneAuditionVolumeValue ?? undefined,
          onAuditionVolumeChanged(volume) {
            playbackEngine.setRecordedTakeAuditionVolume?.(volume);
            takePlaybackPort.setVolume?.(volume);
          },
          beatsPerBar: musicalTimeline.timeSignature.numerator,
          getRecordingStartPosition: audioPlayerController.getRecordingStartPosition,
          setRecordingStartPosition: audioPlayerController.seekToMusicalPosition,
          prepareRecordingStart: audioPlayerController.prepareRecordingStart,
          subscribePlaybackReadiness: (listener) => playbackEngine.subscribe((snapshot) => {
            listener(
              snapshot.preparation.status === "ready" && snapshot.hasLoadedChannels,
            );
          }),
          recordButton: microphoneRecordButton,
          stopButton: microphoneStopButton,
          auditionButton: microphoneAuditionButton,
          retryButton: microphoneRetryButton,
          discardButton: microphoneDiscardButton,
          keepButton: microphoneKeepButton,
          takeNameInput: microphoneTakeNameInput,
          statusElement: microphoneStatusElement,
          alignmentValueElement: microphoneAlignmentValueElement ?? undefined,
          alignmentSummaryElement: microphoneAlignmentSummaryElement ?? undefined,
          alignmentNudgeControls: [
            ...(microphoneAlignmentEarlier100Button
              ? [{ button: microphoneAlignmentEarlier100Button, deltaMilliseconds: -100 }]
              : []),
            ...(microphoneAlignmentEarlier10Button
              ? [{ button: microphoneAlignmentEarlier10Button, deltaMilliseconds: -10 }]
              : []),
            ...(microphoneAlignmentEarlier1Button
              ? [{ button: microphoneAlignmentEarlier1Button, deltaMilliseconds: -1 }]
              : []),
            ...(microphoneAlignmentLater1Button
              ? [{ button: microphoneAlignmentLater1Button, deltaMilliseconds: 1 }]
              : []),
            ...(microphoneAlignmentLater10Button
              ? [{ button: microphoneAlignmentLater10Button, deltaMilliseconds: 10 }]
              : []),
            ...(microphoneAlignmentLater100Button
              ? [{ button: microphoneAlignmentLater100Button, deltaMilliseconds: 100 }]
              : []),
          ],
          alignmentResetButton: microphoneAlignmentResetButton ?? undefined,
          keepDialog: microphoneKeepDialog ?? undefined,
          keepConfirmButton: microphoneKeepConfirmButton ?? undefined,
          keepCancelButton: microphoneKeepCancelButton ?? undefined,
          keepMetadataElement: microphoneKeepMetadata ?? undefined,
          keepStatusElement: microphoneKeepStatus ?? undefined,
          discardDialog: microphoneDiscardDialog ?? undefined,
          discardConfirmButton: microphoneDiscardConfirmButton ?? undefined,
          discardCancelButton: microphoneDiscardCancelButton ?? undefined,
          discardStatusElement: microphoneDiscardStatus ?? undefined,
          async onTakeKept() {
            await refreshProjectTracks?.();
          },
        })
      : null;

  microphoneRecordingController?.init();
  if (recordingSession) {
    void recordingSession.restorePendingTake();
  }

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
    projectDetailsTrackNamesElement,
    projectDetailsEditButton,
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
    trackEditStartBarInput,
    trackEditStartBeatInput,
    trackEditLengthBarsInput,
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

  refreshProjectTracks = controller.reloadTracks;
  void controller.init();

  async function stopActiveRecording(): Promise<void> {
    const status = recordingSession?.getSnapshot().status;
    if (status === "count-in") {
      await recordingSession?.cancelCountIn();
    } else if (status === "recording" || status === "processing") {
      await recordingSession?.stop();
    }
  }

  async function leavePlayerForHome(): Promise<void> {
    await stopActiveRecording();
    await controller.flushPendingMixSettings();
    audioPlayerController.stop({ resetWorkspaceAnchor: false });
    navigateTo("project-menu");
  }

  async function leavePlayerWithBack(): Promise<void> {
    await stopActiveRecording();
    await controller.flushPendingMixSettings();
    audioPlayerController.stop({ resetWorkspaceAnchor: false });
    goBack("project-menu");
  }

  async function logoutFromPlayer(): Promise<void> {
    await stopActiveRecording();
    await controller.flushPendingMixSettings();
    audioPlayerController.stop({ resetWorkspaceAnchor: false });
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
  const projectDetailsScrollController = projectDetailsElement
    ? createProjectDetailsScrollController({
        detailsElement: projectDetailsElement,
        scrollTarget: window,
        isPageAtBottom: () => {
          const scrollingElement = document.scrollingElement ?? document.documentElement;
          return Math.ceil(window.scrollY + window.innerHeight) >= scrollingElement.scrollHeight - 2;
        },
      })
    : null;

  projectDetailsScrollController?.init();

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
    projectDetailsScrollController?.destroy();
    destroyProjectActionsMenu?.();
    microphoneRecordingController?.destroy();
    void recordingSession?.destroy();
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
  activeInvitation: InvitationSessionState | null;
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
  sessionProvider = frontendServices.auth,
  storageProvider = getBrowserStorageProvider(),
  historyAdapter,
  invitationSessionStore = getBrowserInvitationSessionStore(),
  presentationPort = createApplicationPresentationAdapter(),
}: GrooveShareAppOptions) {
  const projectDraftState = createProjectDraftState<File>();

  return createBrowserGrooveShareApp({
    appElement,
    initialScreen,
    sessionProvider,
    storageProvider,
    historyAdapter,
    invitationSessionStore,
    presentationPort,
    projectDraft: projectDraftState,
    projects: projectsApi,
    invitations: invitationsApi,
    transport: browserFrontendRuntime.transport,
    initializePage({
      currentScreen,
      navigateTo,
      goBack,
      setSelectedProject,
      getInvitedProject,
      getInvitationProjectId,
      selectedProject,
      currentUser,
      projectDraft,
      sessionProvider: activeSessionProvider,
      storageProvider: activeStorageProvider,
      activeInvitation,
      onAuthenticated,
      onOpenProject,
      onContributorAction,
      onGuestAuth,
      onLogout,
    }) {
      return initializeCurrentPage({
        appElement,
        currentScreen,
        navigateTo,
        goBack,
        setSelectedProject,
        getInvitedProject,
        getInvitationProjectId,
        selectedProject,
        currentUser,
        projectDraftState: projectDraft,
        sessionProvider: activeSessionProvider,
        storageProvider: activeStorageProvider,
        activeInvitation,
        onAuthenticated,
        onOpenProject,
        onContributorAction,
        onGuestAuth,
        onLogout,
      });
    },
    showLogoutError(errorMessage) {
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
        statusElement.textContent = errorMessage;
      }
    },
  });
}
