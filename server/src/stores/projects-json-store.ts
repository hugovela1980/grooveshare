import type { CreateProjectInput, Project } from "../types.js";
import {
  DEFAULT_DB_FILE_PATH,
  readDatabase,
  writeDatabase,
} from "./json-db.js";

export type ProjectsStore = {
  getProjects: () => Promise<Project[]>;
  getProjectById: (projectId: string) => Promise<Project | null>;
  createProject: (projectInput: CreateProjectInput) => Promise<Project>;
};

export function createProjectsJsonStore(
  dbFilePath = DEFAULT_DB_FILE_PATH,
): ProjectsStore {
  async function getProjects(): Promise<Project[]> {
    const database = await readDatabase(dbFilePath);
    return database.projects;
  }

  async function getProjectById(projectId: string): Promise<Project | null> {
    const database = await readDatabase(dbFilePath);

    const project = database.projects.find((project) => {
      return project.id === projectId;
    });

    return project ?? null;
  }

  async function createProject(
    projectInput: CreateProjectInput,
  ): Promise<Project> {
    const database = await readDatabase(dbFilePath);

    const now = new Date().toISOString();

    const project: Project = {
      id: crypto.randomUUID(),
      title: projectInput.title,
      description: projectInput.description,
      createdAt: now,
      updatedAt: now,
    };

    database.projects.push(project);

    await writeDatabase(dbFilePath, database);

    return project;
  }

  return {
    getProjects,
    getProjectById,
    createProject,
  };
}

export const projectsJsonStore = createProjectsJsonStore();

export const getProjects = projectsJsonStore.getProjects;
export const getProjectById = projectsJsonStore.getProjectById;
export const createProject = projectsJsonStore.createProject;