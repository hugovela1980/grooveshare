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
 * Browser storage persists this value through an adapter, while its meaning and
 * lifecycle belong to the shared application layer.
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
 * Shared state shape owned by the GrooveShare application controller.
 * Concrete clients may render and interact with this state differently, while
 * the meaning and lifecycle of the state remain presentation-independent.
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
