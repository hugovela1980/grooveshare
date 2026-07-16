import { projectsApi } from "./api/projects-api.js";
import { tracksApi } from "./api/tracks-api.js";
import { createCreateProjectPageController } from "./page-controllers/create-project-page-controller.js";
import { createProjectMenuPageController } from "./page-controllers/project-menu-page-controller.js";
import { createProjectPlayerPageController } from "./page-controllers/project-player-page-controller.js";
import { renderConfirmProjectPage } from "./pages/confirm-project-page.js";
import { renderCreateProjectPage } from "./pages/create-project-page.js";
import { renderProjectMenuPage } from "./pages/project-menu-page.js";
import { renderProjectPlayerPage } from "./pages/project-player-page.js";
import { renderTrackList } from "./templates/track-list.js";
import {
  createAppRouter,
  type AppScreen,
} from "./router/app-router.js";
import { renderProjectList } from "./templates/project-list.js";
import type { Project } from "./types.js";

type AppElementLike = {
  innerHTML: string;
  querySelector?: <T>(selector: string) => T | null;
};

type GrooveShareAppOptions = {
  appElement: AppElementLike;
  initialScreen?: AppScreen;
};

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
}: {
  appElement: AppElementLike;
  navigateTo: (screen: AppScreen) => void;
  setSelectedProject: (project: Project) => void;
}): void {
  const addProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#add-project-button",
  );

  addProjectButton?.addEventListener("click", () => {
    navigateTo("create-project");
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
  setCreatedProject,
}: {
  appElement: AppElementLike;
  navigateTo: (screen: AppScreen) => void;
  setCreatedProject: (project: Project) => void;
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

  if (!form || !titleInput || !descriptionInput || !statusElement) {
    return;
  }

  const controller = createCreateProjectPageController({
    form,
    titleInput,
    descriptionInput,
    statusElement,
    projectsApi,
    onProjectCreated(project) {
      setCreatedProject(project);
      navigateTo("confirm-project");
    },
  });

  controller.init();
}

function initializeConfirmProjectPage({
  appElement,
  navigateTo,
}: {
  appElement: AppElementLike;
  navigateTo: (screen: AppScreen) => void;
}): void {
  const confirmProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#confirm-project-button",
  );

  confirmProjectButton?.addEventListener("click", () => {
    navigateTo("project-menu");
  });
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

  const form = getElement<HTMLFormElement>(
    appElement,
    "#player-track-upload-form",
  );
  const trackNameInput = getElement<HTMLInputElement>(
    appElement,
    "#player-track-name",
  );
  const audioFileInput = getElement<HTMLInputElement>(
    appElement,
    "#player-audio-file",
  );
  const statusElement = getElement<HTMLParagraphElement>(
    appElement,
    "#player-track-upload-status",
  );
  const trackListElement = getElement<HTMLDivElement>(
    appElement,
    "#player-track-list",
  );

  if (
    !form ||
    !trackNameInput ||
    !audioFileInput ||
    !statusElement ||
    !trackListElement
  ) {
    return;
  }

  const controller = createProjectPlayerPageController({
    project: selectedProject,
    form,
    trackNameInput,
    audioFileInput,
    statusElement,
    trackListElement,
    tracksApi,
    renderTrackList,
  });

  void controller.init();
}

function initializeCurrentPage({
  appElement,
  currentScreen,
  navigateTo,
  setCreatedProject,
  setSelectedProject,
  selectedProject,
}: {
  appElement: AppElementLike;
  currentScreen: AppScreen;
  navigateTo: (screen: AppScreen) => void;
  setCreatedProject: (project: Project) => void;
  setSelectedProject: (project: Project) => void;
  selectedProject: Project | null;
}): void {
  if (currentScreen === "project-menu") {
    initializeProjectMenuPage({
      appElement,
      navigateTo,
      setSelectedProject,
    });

    return;
  }

  if (currentScreen === "create-project") {
    initializeCreateProjectPage({
      appElement,
      navigateTo,
      setCreatedProject,
    });

    return;
  }

  if (currentScreen === "confirm-project") {
    initializeConfirmProjectPage({
      appElement,
      navigateTo,
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
  let createdProject: Project | null = null;
  let selectedProject: Project | null = null;

  function setCreatedProject(project: Project): void {
    createdProject = project;
  }

  function setSelectedProject(project: Project): void {
    selectedProject = project;
  }

  const router = createAppRouter({
    appElement,
    initialScreen,
    pageRenderers: {
      "project-menu": renderProjectMenuPage,
      "create-project": renderCreateProjectPage,
      "confirm-project": () => renderConfirmProjectPage(createdProject),
      "project-player": () => renderProjectPlayerPage(selectedProject),
    },
  });

  function start(): void {
    router.start();

    initializeCurrentPage({
      appElement,
      currentScreen: router.getCurrentScreen(),
      navigateTo,
      setCreatedProject,
      setSelectedProject,
      selectedProject,
    });
  }

  function navigateTo(screen: AppScreen): void {
    router.navigateTo(screen);

    initializeCurrentPage({
      appElement,
      currentScreen: router.getCurrentScreen(),
      navigateTo,
      setCreatedProject,
      setSelectedProject,
      selectedProject,
    });
  }

  return {
    start,
    navigateTo,
    getCurrentScreen: router.getCurrentScreen,
  };
}