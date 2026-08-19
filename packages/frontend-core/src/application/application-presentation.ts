import type {
  CreateProjectInput,
  Project,
  User,
} from "../domain/types.js";
import type { InvitationPresentationState } from "./invitation-guest-workflow.js";

export type AuthenticationPresentationState = {
  message: string;
};

export type ProjectsPresentationState = {
  currentUser: User | null;
  statusMessage: string;
};

export type CreateProjectPresentationState = {
  projectDraft: CreateProjectInput | null;
};

export type ProjectPlayerPresentationState = {
  project: Project | null;
  currentUser: User | null;
  invitation: InvitationPresentationState;
  statusMessage: string;
};

export type LoadingPresentationState = {
  message: string;
};

export type ErrorPresentationState = {
  message: string;
};

/**
 * The application says what needs to be presented. A concrete client decides
 * how to present it. TOutput keeps this contract presentation-technology
 * neutral: browser adapters currently return HTML strings, while a future
 * presentation could return nothing, a virtual tree, or another view value.
 */
export interface ApplicationPresentationPort<TOutput = void> {
  showAuthentication(state: AuthenticationPresentationState): TOutput;
  showProjects(state: ProjectsPresentationState): TOutput;
  showCreateProject(state: CreateProjectPresentationState): TOutput;
  showProjectPlayer(state: ProjectPlayerPresentationState): TOutput;
  showLoading(state: LoadingPresentationState): TOutput;
  showError(state: ErrorPresentationState): TOutput;
}
