import type {
  AddProjectMemberInput,
  ProjectMember,
  ProjectRole,
} from "../types.js";
import {
  API_BASE_URL,
  apiFetch,
  parseApiResponse,
} from "./api-client.js";

export async function getProjectMembers(
  projectId: string,
): Promise<ProjectMember[]> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/members`,
  );

  return parseApiResponse<ProjectMember[]>(response);
}

export async function addProjectMember(
  projectId: string,
  input: AddProjectMemberInput,
): Promise<ProjectMember> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/members`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        role: input.role,
      }),
    },
  );

  return parseApiResponse<ProjectMember>(response);
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: Exclude<ProjectRole, "owner">,
): Promise<ProjectMember> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    },
  );

  return parseApiResponse<ProjectMember>(response);
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
): Promise<ProjectMember> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
    },
  );

  return parseApiResponse<ProjectMember>(response);
}

export const projectMembersApi = {
  getProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
};

export type ProjectMembersApi = typeof projectMembersApi;
