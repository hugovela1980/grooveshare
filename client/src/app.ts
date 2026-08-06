import { projectsApi } from "./api/projects-api.js";
import { tracksApi } from "./api/tracks-api.js";
import { createCreateProjectPageController } from "./page-controllers/create-project-page-controller.js";
import { createProjectMenuPageController } from "./page-controllers/project-menu-page-controller.js";
import { createProjectPlayerPageController } from "./page-controllers/project-player-page-controller.js";
import { createConfirmProjectPageController } from "./page-controllers/confirm-project-page-controller.js";
import { createAudioPlayerController } from "./page-controllers/audio-player-controller.js";
import { getTrackAudioUrl } from "./api/tracks-api.js";
import { renderConfirmProjectPage } from "./pages/confirm-project-page.js";
import { renderCreateProjectPage } from "./pages/create-project-page.js";
import { renderProjectMenuPage } from "./pages/project-menu-page.js";
import { renderProjectPlayerPage } from "./pages/project-player-page.js";
import { createProjectDraftState } from "./project-draft/project-draft-state.js";
import {
  createAppRouter,
  type AppScreen,
} from "./router/app-router.js";
import { renderProjectList } from "./templates/project-list.js";
import { renderMixChannelSlots } from "./templates/mix-channel-slots.js";
import type { Project } from "./types.js";

type AppElementLike = {
  innerHTML: string;
  querySelector?: <T>(selector: string) => T | null;
};

type GrooveShareAppOptions = {
  appElement: AppElementLike;
  initialScreen?: AppScreen;
};

type ProjectDraftState = ReturnType<typeof createProjectDraftState>;

function getElement<T>(appElement: AppElementLike, selector: string): T | null {
  if (!appElement.querySelector) {
    return null;
  }

  return appElement.querySelector<T>(selector);
}

function initializeProjectMenuPage({
  appElement,
  navigateTo,
  setSelectedProject,
  projectDraftState,
}: {
  appElement: AppElementLike;
  navigateTo: (screen: AppScreen) => void;
  setSelectedProject: (project: Project) => void;
  projectDraftState: ProjectDraftState;
}): void {
  const addProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#add-project-button",
  );

  addProjectButton?.addEventListener("click", () => {
    projectDraftState.clear();
    navigateTo("create-project");
  });

  const projectListElement = getElement<HTMLDivElement>(
    appElement,
    "#project-list",
  );

  if (!projectListElement) {
    return;
  }

  const statusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#project-menu-status",
  );

  const controller = createProjectMenuPageController({
    projectListElement,
    statusElement,
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
  projectDraftState,
}: {
  appElement: AppElementLike;
  navigateTo: (screen: AppScreen) => void;
  projectDraftState: ProjectDraftState;
}): void {
  const backButton = getElement<HTMLButtonElement>(
    appElement,
    "#back-to-menu-button",
  );

  backButton?.addEventListener("click", () => {
    navigateTo("project-menu");
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

  if (form && titleInput && descriptionInput && statusElement) {
    const pendingTrackNameInput = getElement<HTMLInputElement>(
      appElement,
      "#pending-track-name",
    );

    const pendingAudioFileInput = getElement<HTMLInputElement>(
      appElement,
      "#pending-audio-file",
    );

    const controller = createCreateProjectPageController({
      form,
      titleInput,
      descriptionInput,
      statusElement,
      trackNameInput: pendingTrackNameInput ?? undefined,
      audioFileInput: pendingAudioFileInput ?? undefined,
      onProjectDraftReady(projectDraft, pendingTrack) {
        projectDraftState.clear();
        projectDraftState.setProjectDraft(projectDraft);

        if (pendingTrack) {
          projectDraftState.addPendingTrack(pendingTrack);
        }

        navigateTo("confirm-project");
      },
    });

    controller.init();
  }
}

function initializeConfirmProjectPage({
  appElement,
  navigateTo,
  setSelectedProject,
  projectDraftState,
}: {
  appElement: AppElementLike;
  navigateTo: (screen: AppScreen) => void;
  setSelectedProject: (project: Project) => void;
  projectDraftState: ProjectDraftState;
}): void {
  const confirmProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#confirm-project-button",
  );

  const editProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#edit-project-button",
  );

  editProjectButton?.addEventListener("click", () => {
    navigateTo("create-project");
  });

  const statusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#confirm-project-status",
  );

  if (!confirmProjectButton || !statusElement) {
    return;
  }

  const controller = createConfirmProjectPageController({
    submitButton: confirmProjectButton,
    statusElement,
    projectDraftState,
    projectsApi,
    tracksApi,
    onProjectSubmitted(project) {
      setSelectedProject(project);
      navigateTo("project-player");
    },
  });

  controller.init();
}

function initializeProjectPlayerPage({
  appElement,
  navigateTo,
  selectedProject,
}: {
  appElement: AppElementLike;
  navigateTo: (screen: AppScreen) => void;
  selectedProject: Project | null;
}): void {
  const backButton = getElement<HTMLButtonElement>(
    appElement,
    "#player-back-button",
  );

  backButton?.addEventListener("click", () => {
    navigateTo("project-menu");
  });

  const menuButton = getElement<HTMLButtonElement>(
    appElement,
    "#player-menu-button",
  );

  menuButton?.addEventListener("click", () => {
    navigateTo("project-menu");
  });

  if (!selectedProject) {
    return;
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

  if (!trackListElement) {
    return;
  }

  const audioElement = getElement<HTMLAudioElement>(
    appElement,
    "#project-audio-player",
  );

  const playPauseButton = getElement<HTMLButtonElement>(
    appElement,
    "#audio-play-pause-button",
  );

  const stopButton = getElement<HTMLButtonElement>(
    appElement,
    "#audio-stop-button",
  );

  const progressInput = getElement<HTMLInputElement>(
    appElement,
    "#audio-progress",
  );

  const timestampElement = getElement<HTMLElement>(
    appElement,
    "#audio-timestamp",
  );

  const trackNameElement = getElement<HTMLElement>(
    appElement,
    "#audio-track-name",
  );

  if (
    !audioElement ||
    !playPauseButton ||
    !stopButton ||
    !progressInput ||
    !timestampElement ||
    !trackNameElement
  ) {
    throw new Error("Project Player audio elements were not found.");
  }

  const audioPlayerController = createAudioPlayerController({
    audioElement,
    playPauseButton,
    stopButton,
    progressInput,
    timestampElement,
    trackNameElement,
  });

  audioPlayerController.init();

  const controller = createProjectPlayerPageController({
    project: selectedProject,
    trackListElement,
    statusElement,
    deleteProjectButton,
    tracksApi,
    projectsApi,
    audioPlayerController,
    getTrackAudioUrl,
    renderTrackList: renderMixChannelSlots,
    onProjectDeleted() {
      navigateTo("project-menu");
    },
  });

  void controller.init();
}

function initializeCurrentPage({
  appElement,
  currentScreen,
  navigateTo,
  setSelectedProject,
  selectedProject,
  projectDraftState,
}: {
  appElement: AppElementLike;
  currentScreen: AppScreen;
  navigateTo: (screen: AppScreen) => void;
  setSelectedProject: (project: Project) => void;
  selectedProject: Project | null;
  projectDraftState: ProjectDraftState;
}): void {
  if (currentScreen === "project-menu") {
    initializeProjectMenuPage({
      appElement,
      navigateTo,
      setSelectedProject,
      projectDraftState,
    });

    return;
  }

  if (currentScreen === "create-project") {
    initializeCreateProjectPage({
      appElement,
      navigateTo,
      projectDraftState,
    });

    return;
  }

  if (currentScreen === "confirm-project") {
    initializeConfirmProjectPage({
      appElement,
      navigateTo,
      setSelectedProject,
      projectDraftState,
    });

    return;
  }

  if (currentScreen === "project-player") {
    initializeProjectPlayerPage({
      appElement,
      navigateTo,
      selectedProject,
    });
  }
}

export function createGrooveShareApp({
  appElement,
  initialScreen = "project-menu",
}: GrooveShareAppOptions) {
  let selectedProject: Project | null = null;
  const projectDraftState = createProjectDraftState();

  function setSelectedProject(project: Project): void {
    selectedProject = project;
  }

  const router = createAppRouter({
    appElement,
    initialScreen,
    pageRenderers: {
      "project-menu": renderProjectMenuPage,
      "create-project": renderCreateProjectPage,
      "confirm-project": () =>
        renderConfirmProjectPage(projectDraftState.getSnapshot()),
      "project-player": () => renderProjectPlayerPage(selectedProject),
    },
  });

  function start(): void {
    router.start();

    initializeCurrentPage({
      appElement,
      currentScreen: router.getCurrentScreen(),
      navigateTo,
      setSelectedProject,
      selectedProject,
      projectDraftState,
    });
  }

  function navigateTo(screen: AppScreen): void {
    router.navigateTo(screen);

    initializeCurrentPage({
      appElement,
      currentScreen: router.getCurrentScreen(),
      navigateTo,
      setSelectedProject,
      selectedProject,
      projectDraftState,
    });
  }

  return {
    start,
    navigateTo,
    getCurrentScreen: router.getCurrentScreen,
  };
}