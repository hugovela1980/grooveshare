import type { CreateProjectInput, Project, Track } from "../types.js";
import {
  DEFAULT_DB_FILE_PATH,
  readDatabase,
  writeDatabase,
} from "./json-db.js";

export type ProjectsStore = {
  getProjects: () => Promise<Project[]>;
  getProjectById: (projectId: string) => Promise<Project | null>;
  createProject: (projectInput: CreateProjectInput) => Promise<Project>;
  deleteProjectById: (projectId: string) => Promise<DeleteProjectResult>;
};

export type DeleteProjectResult =
  | {
    ok: true;
    deletedProject: Project;
    deletedTracks: Track[];
  }
  | {
    ok: false;
    reason: "project-not-found";
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

  async function deleteProjectById(
    projectId: string,
  ): Promise<DeleteProjectResult> {
    const database = await readDatabase(dbFilePath);

    const projectToDelete = database.projects.find((project) => {
      return project.id === projectId;
    });

    if (!projectToDelete) {
      return {
        ok: false,
        reason: "project-not-found",
      };
    }

    const deletedTracks = database.tracks.filter((track) => {
      return track.projectId === projectId;
    });

    database.projects = database.projects.filter((project) => {
      return project.id !== projectId;
    });

    database.tracks = database.tracks.filter((track) => {
      return track.projectId !== projectId;
    });

    await writeDatabase(dbFilePath, database);

    return {
      ok: true,
      deletedProject: projectToDelete,
      deletedTracks,
    };
  }

  return {
    getProjects,
    getProjectById,
    createProject,
    deleteProjectById,
  };
}

export const projectsJsonStore = createProjectsJsonStore();

export const getProjects = projectsJsonStore.getProjects;
export const getProjectById = projectsJsonStore.getProjectById;
export const createProject = projectsJsonStore.createProject;