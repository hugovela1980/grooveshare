export type ApplicationScreen =
  | "auth"
  | "invitation"
  | "project-menu"
  | "create-project"
  | "project-player";

export type ApplicationRoute = {
  screen: ApplicationScreen;
  projectId?: string;
  invitationToken?: string;
};

export type ApplicationNavigationOptions = {
  replace?: boolean;
};

/**
 * Navigation is expressed in application terms. Browser history remains a
 * presentation/platform adapter concern.
 */
export interface ApplicationNavigationPort {
  navigateTo(
    route: ApplicationRoute,
    options?: ApplicationNavigationOptions,
  ): void;
  goBack(fallbackRoute: ApplicationRoute): void;
}

/**
 * Semantic actions emitted by a presentation. These names give desktop and
 * mobile one vocabulary for user intent before Stage 4 moves their handling to
 * a shared application controller.
 */
export type ApplicationAction =
  | {
      type: "open-project";
      projectId: string;
    }
  | {
      type: "return-home";
    }
  | {
      type: "log-in";
    }
  | {
      type: "log-out";
    }
  | {
      type: "accept-invitation";
    }
  | {
      type: "recover-expired-session";
    };

export interface ApplicationActionPort {
  dispatch(action: ApplicationAction): void | Promise<void>;
}
