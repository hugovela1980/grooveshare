import {
  createAppRouter,
  type AppScreen,
} from "./router/app-router.js";
import { renderConfirmProjectPage } from "./pages/confirm-project-page.js";
import { renderCreateProjectPage } from "./pages/create-project-page.js";
import { renderProjectMenuPage } from "./pages/project-menu-page.js";
import { renderProjectPlayerPage } from "./pages/project-player-page.js";
import {
  initializeCreateProjectNavigation,
  initializeProjectMenuNavigation,
} from "./page-actions/page-navigation.js";

type AppElementLike = {
  innerHTML: string;
  querySelector?: <T>(selector: string) => T | null;
};

type GrooveShareAppOptions = {
  appElement: AppElementLike;
  initialScreen?: AppScreen;
};

function initializePageActions({
  appElement,
  router,
}: {
  appElement: AppElementLike;
  router: ReturnType<typeof createAppRouter>;
}): void {
  if (!appElement.querySelector) {
    return;
  }

  const currentScreen = router.getCurrentScreen();

  if (currentScreen === "project-menu") {
    const addProjectButton =
      appElement.querySelector<HTMLButtonElement>("#add-project-button");

    if (addProjectButton) {
      initializeProjectMenuNavigation({
        addProjectButton,
        router,
      });
    }

    return;
  }

  if (currentScreen === "create-project") {
    const backButton =
      appElement.querySelector<HTMLButtonElement>("#back-to-menu-button");

    if (backButton) {
      initializeCreateProjectNavigation({
        backButton,
        router,
      });
    }
  }
}

export function createGrooveShareApp({
  appElement,
  initialScreen = "project-menu",
}: GrooveShareAppOptions) {
  const router = createAppRouter({
    appElement,
    initialScreen,
    pageRenderers: {
      "project-menu": renderProjectMenuPage,
      "create-project": renderCreateProjectPage,
      "confirm-project": renderConfirmProjectPage,
      "project-player": renderProjectPlayerPage,
    },
  });

  function start(): void {
    router.start();
    initializePageActions({
      appElement,
      router: app,
    });
  }

  function navigateTo(screen: AppScreen): void {
    router.navigateTo(screen);
    initializePageActions({
      appElement,
      router: app,
    });
  }

  const app = {
    start,
    navigateTo,
    getCurrentScreen: router.getCurrentScreen,
  };

  return app;
}