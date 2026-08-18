import {
  API_BASE_URL,
  apiFetch,
  parseApiResponse,
} from "./api-client.js";

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
  role: "viewer" | "contributor" | "owner";
};

function getInvitationHeaders(token: string): HeadersInit {
  return {
    [PROJECT_INVITATION_HEADER]: token,
  };
}

export async function resolveGuestInvitation(
  token: string,
): Promise<ResolvedGuestInvitation> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/invitations/guest`,
    {
      headers: getInvitationHeaders(token),
      notifyOnUnauthorized: false,
    },
  );

  return parseApiResponse<ResolvedGuestInvitation>(response);
}

export async function acceptProjectInvitation(
  token: string,
): Promise<AcceptedProjectInvitation> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/invitations/accept`,
    {
      method: "POST",
      headers: getInvitationHeaders(token),
      notifyOnUnauthorized: false,
    },
  );

  return parseApiResponse<AcceptedProjectInvitation>(response);
}

export async function getProjectInvitationStatus(
  projectId: string,
): Promise<ProjectInvitationStatus | null> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/invitation`,
  );

  return parseApiResponse<ProjectInvitationStatus | null>(response);
}

export async function generateProjectInvitation(
  projectId: string,
): Promise<GeneratedProjectInvitation> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/invitation`,
    {
      method: "POST",
    },
  );

  return parseApiResponse<GeneratedProjectInvitation>(response);
}

export async function disableProjectInvitation(
  projectId: string,
): Promise<ProjectInvitationStatus> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/invitation`,
    {
      method: "DELETE",
    },
  );

  return parseApiResponse<ProjectInvitationStatus>(response);
}

export const invitationsApi = {
  resolveGuestInvitation,
  acceptProjectInvitation,
  getProjectInvitationStatus,
  generateProjectInvitation,
  disableProjectInvitation,
};

export type InvitationsApi = typeof invitationsApi;
