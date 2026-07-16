import { projectsApi } from "./api/projects-api.js";
import { createCreateProjectPageController } from "./page-controllers/create-project-page-controller.js";
import { renderConfirmProjectPage } from "./pages/confirm-project-page.js";
import { renderCreateProjectPage } from "./pages/create-project-page.js";
import { renderProjectMenuPage } from "./pages/project-menu-page.js";
import { renderProjectPlayerPage } from "./pages/project-player-page.js";
import {
  createAppRouter,
  type AppScreen,
} from "./router/app-router.js";
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
}: {
  appElement: AppElementLike;
  navigateTo: (screen: AppScreen) => void;
}): void {
  const addProjectButton = getElement<HTMLButtonElement>(
    appElement,
    "#add-project-button",
  );

  addProjectButton?.addEventListener("click", () => {
    navigateTo("create-project");
  });
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

function initializeCurrentPage({
  appElement,
  currentScreen,
  navigateTo,
  setCreatedProject,
}: {
  appElement: AppElementLike;
  currentScreen: AppScreen;
  navigateTo: (screen: AppScreen) => void;
  setCreatedProject: (project: Project) => void;
}): void {
  if (currentScreen === "project-menu") {
    initializeProjectMenuPage({
      appElement,
      navigateTo,
    });

    return;
  }

  if (currentScreen === "create-project") {
    initializeCreateProjectPage({
      appElement,
      navigateTo,
      setCreatedProject,
    });
  }
}

export function createGrooveShareApp({
  appElement,
  initialScreen = "project-menu",
}: GrooveShareAppOptions) {
  let createdProject: Project | null = null;

  function setCreatedProject(project: Project): void {
    createdProject = project;
  }

  const router = createAppRouter({
    appElement,
    initialScreen,
    pageRenderers: {
      "project-menu": renderProjectMenuPage,
      "create-project": renderCreateProjectPage,
      "confirm-project": () => renderConfirmProjectPage(createdProject),
      "project-player": renderProjectPlayerPage,
    },
  });

  function start(): void {
    router.start();

    initializeCurrentPage({
      appElement,
      currentScreen: router.getCurrentScreen(),
      navigateTo,
      setCreatedProject,
    });
  }

  function navigateTo(screen: AppScreen): void {
    router.navigateTo(screen);

    initializeCurrentPage({
      appElement,
      currentScreen: router.getCurrentScreen(),
      navigateTo,
      setCreatedProject,
    });
  }

  return {
    start,
    navigateTo,
    getCurrentScreen: router.getCurrentScreen,
  };
}