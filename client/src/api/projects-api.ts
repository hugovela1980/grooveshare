import type {
  CreateProjectInput,
  MixSettings,
  Project,
  UpdateProjectDetailsInput,
} from "../types.js";

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const API_BASE_URL = "http://localhost:3000";

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !body.ok || body.data === undefined) {
    throw new Error(body.error ?? "API request failed.");
  }

  return body.data;
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE_URL}/api/projects`);
  return parseApiResponse<Project[]>(response);
}

export async function createProject(
  projectInput: CreateProjectInput,
): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
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
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(projectInput),
  });

  return parseApiResponse<Project>(response);
}

export async function deleteProject(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "DELETE",
  });

  return parseApiResponse<Project>(response);
}

export async function saveMixSettings(
  projectId: string,
  mixSettings: MixSettings,
): Promise<Project> {
  const response = await fetch(
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
  createProject,
  updateProjectDetails,
  deleteProject,
  saveMixSettings,
};