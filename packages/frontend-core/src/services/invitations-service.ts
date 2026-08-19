import type { ProjectRole } from "../domain/types.js";
import {
  parseApiResponse,
  type ApiTransport,
} from "./api-transport.js";

export const PROJECT_INVITATION_HEADER = "X-GrooveShare-Invite";

export type ProjectInvitationStatus = {
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GeneratedProjectInvitation = ProjectInvitationStatus & {
  token: string;
};

export type ResolvedGuestInvitation = {
  projectId: string;
};

export type AcceptedProjectInvitation = {
  projectId: string;
  role: ProjectRole;
};

export interface InvitationsService {
  resolveGuestInvitation(token: string): Promise<ResolvedGuestInvitation>;
  acceptProjectInvitation(token: string): Promise<AcceptedProjectInvitation>;
  getProjectInvitationStatus(
    projectId: string,
  ): Promise<ProjectInvitationStatus | null>;
  generateProjectInvitation(
    projectId: string,
  ): Promise<GeneratedProjectInvitation>;
  disableProjectInvitation(
    projectId: string,
  ): Promise<ProjectInvitationStatus>;
}

function invitationHeaders(token: string): Record<string, string> {
  return {
    [PROJECT_INVITATION_HEADER]: token,
  };
}

export function createInvitationsService(input: {
  apiBaseUrl: string;
  transport: ApiTransport;
}): InvitationsService {
  const { apiBaseUrl, transport } = input;

  return {
    async resolveGuestInvitation(token) {
      const response = await transport.request(
        `${apiBaseUrl}/api/invitations/guest`,
        {
          headers: invitationHeaders(token),
          notifyOnUnauthorized: false,
        },
      );

      return parseApiResponse<ResolvedGuestInvitation>(response);
    },

    async acceptProjectInvitation(token) {
      const response = await transport.request(
        `${apiBaseUrl}/api/invitations/accept`,
        {
          method: "POST",
          headers: invitationHeaders(token),
          notifyOnUnauthorized: false,
        },
      );

      return parseApiResponse<AcceptedProjectInvitation>(response);
    },

    async getProjectInvitationStatus(projectId) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${encodeURIComponent(projectId)}/invitation`,
      );

      return parseApiResponse<ProjectInvitationStatus | null>(response);
    },

    async generateProjectInvitation(projectId) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${encodeURIComponent(projectId)}/invitation`,
        { method: "POST" },
      );

      return parseApiResponse<GeneratedProjectInvitation>(response);
    },

    async disableProjectInvitation(projectId) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${encodeURIComponent(projectId)}/invitation`,
        { method: "DELETE" },
      );

      return parseApiResponse<ProjectInvitationStatus>(response);
    },
  };
}
