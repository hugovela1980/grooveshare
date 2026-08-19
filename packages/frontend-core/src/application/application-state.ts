import type { Project, User } from "../domain/types.js";

/**
 * Authentication is application state, not presentation state. The clients may
 * render these states differently, but they should agree on what the states
 * mean.
 */
export type AuthenticationState =
  | {
      status: "restoring";
      user: null;
    }
  | {
      status: "anonymous";
      user: null;
    }
  | {
      status: "authenticated";
      user: User;
    };

/**
 * Browser storage currently persists this value, but its meaning belongs to the
 * shared application layer. Stage 1 only centralizes the contract; persistence
 * behavior remains in each browser client for now.
 */
export type InvitationSessionState = {
  projectId: string;
  token: string;
  pendingContributor: boolean;
};

export type ApplicationLoadingState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
      message: string;
    };

export type ApplicationErrorContext =
  | "application"
  | "authentication"
  | "projects"
  | "project-player"
  | "invitation";

export type ApplicationErrorState = {
  context: ApplicationErrorContext;
  message: string;
} | null;

/**
 * Shared state shape that the future GrooveShare application controller can
 * own. Existing desktop/mobile workflows continue to own their live state in
 * Stage 1; this contract establishes the destination without changing runtime
 * behavior yet.
 */
export type GrooveShareApplicationState = {
  authentication: AuthenticationState;
  selectedProject: Project | null;
  invitation: InvitationSessionState | null;
  loading: ApplicationLoadingState;
  error: ApplicationErrorState;
};

export function createInitialApplicationState(): GrooveShareApplicationState {
  return {
    authentication: {
      status: "restoring",
      user: null,
    },
    selectedProject: null,
    invitation: null,
    loading: {
      status: "idle",
    },
    error: null,
  };
}
