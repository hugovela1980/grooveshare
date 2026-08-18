import type {
  CreateProjectInput,
  MixSettings,
  Project,
  UpdateProjectDetailsInput,
} from "../types.js";
import {
  API_BASE_URL,
  apiFetch,
  parseApiResponse,
} from "./api-client.js";
import { PROJECT_INVITATION_HEADER } from "./invitations-api.js";

function getInvitationRequestOptions(invitationToken?: string): RequestInit & {
  notifyOnUnauthorized?: boolean;
} {
  if (!invitationToken) {
    return {};
  }

  return {
    headers: {
      [PROJECT_INVITATION_HEADER]: invitationToken,
    },
    notifyOnUnauthorized: false,
  };
}

export async function getProjects(): Promise<Project[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/projects`);
  return parseApiResponse<Project[]>(response);
}

export async function getProject(
  projectId: string,
  invitationToken?: string,
): Promise<Project> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${projectId}`,
    getInvitationRequestOptions(invitationToken),
  );
  return parseApiResponse<Project>(response);
}

export async function createProject(
  projectInput: CreateProjectInput,
): Promise<Project> {
  const response = await apiFetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(projectInput),
  });

  return parseApiResponse<Project>(response);
}

export async function updateProjectDetails(
  projectId: string,
  projectInput: UpdateProjectDetailsInput,
): Promise<Project> {
  const response = await apiFetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(projectInput),
  });

  return parseApiResponse<Project>(response);
}

export async function deleteProject(projectId: string): Promise<Project> {
  const response = await apiFetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "DELETE",
  });

  return parseApiResponse<Project>(response);
}

export async function saveMixSettings(
  projectId: string,
  mixSettings: MixSettings,
): Promise<Project> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${projectId}/mix-settings`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mixSettings),
    },
  );

  return parseApiResponse<Project>(response);
}

export const projectsApi = {
  getProjects,
  getProject,
  createProject,
  updateProjectDetails,
  deleteProject,
  saveMixSettings,
};
