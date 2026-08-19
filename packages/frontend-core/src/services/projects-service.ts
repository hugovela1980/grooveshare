import type {
  CreateProjectInput,
  MixSettings,
  Project,
  UpdateProjectDetailsInput,
} from "../domain/types.js";
import {
  parseApiResponse,
  type ApiRequestOptions,
  type ApiTransport,
} from "./api-transport.js";
import { PROJECT_INVITATION_HEADER } from "./invitations-service.js";

export interface ProjectsService {
  getProjects(): Promise<Project[]>;
  getProject(projectId: string, invitationToken?: string): Promise<Project>;
  createProject(projectInput: CreateProjectInput): Promise<Project>;
  updateProjectDetails(
    projectId: string,
    projectInput: UpdateProjectDetailsInput,
  ): Promise<Project>;
  deleteProject(projectId: string): Promise<Project>;
  saveMixSettings(projectId: string, mixSettings: MixSettings): Promise<Project>;
}

function invitationOptions(invitationToken?: string): ApiRequestOptions {
  if (!invitationToken) {
    return {};
  }

  return {
    headers: { [PROJECT_INVITATION_HEADER]: invitationToken },
    notifyOnUnauthorized: false,
  };
}

export function createProjectsService(input: {
  apiBaseUrl: string;
  transport: ApiTransport;
}): ProjectsService {
  const { apiBaseUrl, transport } = input;

  return {
    async getProjects() {
      const response = await transport.request(`${apiBaseUrl}/api/projects`);
      return parseApiResponse<Project[]>(response);
    },

    async getProject(projectId, invitationToken) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${projectId}`,
        invitationOptions(invitationToken),
      );
      return parseApiResponse<Project>(response);
    },

    async createProject(projectInput) {
      const response = await transport.request(`${apiBaseUrl}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectInput),
      });
      return parseApiResponse<Project>(response);
    },

    async updateProjectDetails(projectId, projectInput) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${projectId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectInput),
        },
      );
      return parseApiResponse<Project>(response);
    },

    async deleteProject(projectId) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${projectId}`,
        { method: "DELETE" },
      );
      return parseApiResponse<Project>(response);
    },

    async saveMixSettings(projectId, mixSettings) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${projectId}/mix-settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mixSettings),
        },
      );
      return parseApiResponse<Project>(response);
    },
  };
}
