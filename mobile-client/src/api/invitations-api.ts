export {
  PROJECT_INVITATION_HEADER,
  type AcceptedProjectInvitation,
  type GeneratedProjectInvitation,
  type InvitationsService as InvitationsApi,
  type ProjectInvitationStatus,
  type ResolvedGuestInvitation,
} from "@hugovela/frontend-core";
import { frontendServices } from "./api-client.js";

export const invitationsApi = frontendServices.invitations;
export const resolveGuestInvitation = invitationsApi.resolveGuestInvitation;
export const acceptProjectInvitation = invitationsApi.acceptProjectInvitation;
export const getProjectInvitationStatus = invitationsApi.getProjectInvitationStatus;
export const generateProjectInvitation = invitationsApi.generateProjectInvitation;
export const disableProjectInvitation = invitationsApi.disableProjectInvitation;
