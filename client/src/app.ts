import {
  createGuestMixStorageProvider,
  createHtmlAudioPlaybackEngine,
  createMicrophoneRecordingSession,
  createProjectDraftState,
  createWebAudioPlaybackEngine,
  getProjectMusicalTimeline,
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
  createBrowserRecordedTakePlaybackAdapter,
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
  }

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
  const musicalTimeline = getProjectMusicalTimeline(selectedProject);
  const audioPlayerController = createAudioPlayerController({
    playbackEngine,
    musicalTimeline,
    projectId: selectedProject.id,
    debugLogger: (message, details) => console.info(message, details),
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

  const microphoneArmButton = getElement<HTMLButtonElement>(
    appElement,
    "#microphone-arm-button",
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
  const microphoneStatusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#microphone-recording-status",
  );
  const recordingRole = selectedProject.role ?? null;
  const recordingSession =
    (recordingRole === "owner" || recordingRole === "contributor") &&
    microphoneArmButton &&
    microphoneRecordButton &&
    microphoneStopButton &&
    microphoneAuditionButton &&
    microphoneRetryButton &&
    microphoneDiscardButton &&
    microphoneStatusElement
      ? createMicrophoneRecordingSession({
          role: recordingRole,
          recordingPort: createBrowserMicrophoneRecordingAdapter(),
          takePlaybackPort: createBrowserRecordedTakePlaybackAdapter(),
          playbackEngine,
          musicalTimeline,
        })
      : null;
  const microphoneRecordingController = recordingSession &&
    microphoneArmButton &&
    microphoneRecordButton &&
    microphoneStopButton &&
    microphoneAuditionButton &&
    microphoneRetryButton &&
    microphoneDiscardButton &&
    microphoneStatusElement
      ? createMicrophoneRecordingController({
          recordingSession,
          armButton: microphoneArmButton,
          recordButton: microphoneRecordButton,
          stopButton: microphoneStopButton,
          auditionButton: microphoneAuditionButton,
          retryButton: microphoneRetryButton,
          discardButton: microphoneDiscardButton,
          statusElement: microphoneStatusElement,
        })
      : null;

  microphoneRecordingController?.init();

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

  async function stopActiveRecording(): Promise<void> {
    if (recordingSession?.getSnapshot().status === "recording") {
      await recordingSession.stop();
    }
  }

  async function leavePlayerWithBack(): Promise<void> { await stopActiveRecording(); await controller.flushPendingMixSettings(); audioPlayerController.stop(); goBack("project-menu"); }
  async function logoutFromPlayer(): Promise<void> { await stopActiveRecording(); await controller.flushPendingMixSettings(); audioPlayerController.stop(); await onLogout(); }
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

  return () => {
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
