import {
  createAppRouter,
  type AppScreen,
} from "./router/app-router.js";
import { renderConfirmProjectPage } from "./pages/confirm-project-page.js";
import { renderCreateProjectPage } from "./pages/create-project-page.js";
import { renderProjectMenuPage } from "./pages/project-menu-page.js";
import { renderProjectPlayerPage } from "./pages/project-player-page.js";

type AppElementLike = {
  innerHTML: string;
};

type GrooveShareAppOptions = {
  appElement: AppElementLike;
  initialScreen?: AppScreen;
};

export function createGrooveShareApp({
  appElement,
  initialScreen = "project-menu",
}: GrooveShareAppOptions) {
  return createAppRouter({
    appElement,
    initialScreen,
    pageRenderers: {
      "project-menu": renderProjectMenuPage,
      "create-project": renderCreateProjectPage,
      "confirm-project": renderConfirmProjectPage,
      "project-player": renderProjectPlayerPage,
    },
  });
}