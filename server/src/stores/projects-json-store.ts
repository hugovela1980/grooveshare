import type {
  CreateProjectInput,
  MixSettings,
  Project,
  UpdateProjectDetailsInput,
} from "../types.js";

import { normalizeMusicalTimeline } from "../musical-timeline.js";

import type {
  DeleteProjectResult,
  ProjectsStore,
} from "./projects-store.js";

import {
  DEFAULT_DB_FILE_PATH,
  readDatabase,
  writeDatabase,
} from "./json-db.js";

export function createProjectsJsonStore(
  dbFilePath = DEFAULT_DB_FILE_PATH,
): ProjectsStore {
  function normalizeProject(project: Project): Project {
    return {
      ...project,
      musicalTimeline: normalizeMusicalTimeline(project.musicalTimeline),
    };
  }

  async function getProjects(): Promise<Project[]> {
    const database = await readDatabase(dbFilePath);
    return database.projects.map(normalizeProject);
  }

  async function getProjectById(projectId: string): Promise<Project | null> {
    const database = await readDatabase(dbFilePath);

    const project = database.projects.find((project) => {
      return project.id === projectId;
    });

    return project ? normalizeProject(project) : null;
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
      musicalTimeline: normalizeMusicalTimeline(projectInput.musicalTimeline),
      mixSettings: {
        channels: [],
      },
      createdAt: now,
      updatedAt: now,
    };

    database.projects.push(project);

    await writeDatabase(dbFilePath, database);

    return project;
  }

  async function updateProjectDetails(
    projectId: string,
    projectInput: UpdateProjectDetailsInput,
  ): Promise<Project | null> {
    const database = await readDatabase(dbFilePath);

    const projectIndex = database.projects.findIndex((project) => {
      return project.id === projectId;
    });

    if (projectIndex === -1) {
      return null;
    }

    const existingProject = database.projects[projectIndex];

    if (!existingProject) {
      return null;
    }

    const updatedProject: Project = {
      ...existingProject,
      ...(projectInput.title !== undefined
        ? { title: projectInput.title }
        : {}),
      ...(projectInput.description !== undefined
        ? { description: projectInput.description }
        : {}),
      ...(projectInput.musicalTimeline !== undefined
        ? { musicalTimeline: normalizeMusicalTimeline(projectInput.musicalTimeline) }
        : { musicalTimeline: normalizeMusicalTimeline(existingProject.musicalTimeline) }),
      updatedAt: new Date().toISOString(),
    };

    database.projects[projectIndex] = updatedProject;

    await writeDatabase(dbFilePath, database);

    return updatedProject;
  }

  async function updateProjectMixSettings(
    projectId: string,
    mixSettings: MixSettings,
  ): Promise<Project | null> {
    const database = await readDatabase(dbFilePath);

    const projectIndex = database.projects.findIndex((project) => {
      return project.id === projectId;
    });

    if (projectIndex === -1) {
      return null;
    }

    const existingProject = database.projects[projectIndex];

    if (!existingProject) {
      return null;
    }

    const updatedProject: Project = {
      ...existingProject,
      musicalTimeline: normalizeMusicalTimeline(existingProject.musicalTimeline),
      mixSettings,
      updatedAt: new Date().toISOString(),
    };

    database.projects[projectIndex] = updatedProject;

    await writeDatabase(dbFilePath, database);

    return updatedProject;
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
      deletedProject: normalizeProject(projectToDelete),
      deletedTracks,
    };
  }

  return {
    getProjects,
    getProjectById,
    createProject,
    updateProjectDetails,
    updateProjectMixSettings,
    deleteProjectById,
  };
}

export const projectsJsonStore = createProjectsJsonStore();

export const getProjects = projectsJsonStore.getProjects;
export const getProjectById = projectsJsonStore.getProjectById;
export const createProject = projectsJsonStore.createProject;