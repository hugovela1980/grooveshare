import type {
  AddProjectMemberInput,
  ProjectMember,
  ProjectRole,
} from "../domain/types.js";
import {
  parseApiResponse,
  type ApiTransport,
} from "./api-transport.js";

export interface ProjectMembersService {
  getProjectMembers(projectId: string): Promise<ProjectMember[]>;
  addProjectMember(
    projectId: string,
    input: AddProjectMemberInput,
  ): Promise<ProjectMember>;
  updateProjectMemberRole(
    projectId: string,
    userId: string,
    role: Exclude<ProjectRole, "owner">,
  ): Promise<ProjectMember>;
  removeProjectMember(
    projectId: string,
    userId: string,
  ): Promise<ProjectMember>;
}

export function createProjectMembersService(input: {
  apiBaseUrl: string;
  transport: ApiTransport;
}): ProjectMembersService {
  const { apiBaseUrl, transport } = input;

  return {
    async getProjectMembers(projectId) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${encodeURIComponent(projectId)}/members`,
      );
      return parseApiResponse<ProjectMember[]>(response);
    },

    async addProjectMember(projectId, memberInput) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${encodeURIComponent(projectId)}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: memberInput.email.trim().toLowerCase(),
            role: memberInput.role,
          }),
        },
      );
      return parseApiResponse<ProjectMember>(response);
    },

    async updateProjectMemberRole(projectId, userId, role) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      return parseApiResponse<ProjectMember>(response);
    },

    async removeProjectMember(projectId, userId) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      return parseApiResponse<ProjectMember>(response);
    },
  };
}
