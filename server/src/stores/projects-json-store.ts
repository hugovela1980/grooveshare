import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CreateProjectInput, Database, Project } from "../types.js";

type ProjectsStore = {
  getProjects: () => Promise<Project[]>;
  getProjectById: (projectId: string) => Promise<Project | null>;
  createProject: (projectInput: CreateProjectInput) => Promise<Project>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_FILE_PATH = path.join(__dirname, "../../data/db.json");

async function readDatabase(dbFilePath: string): Promise<Database> {
  const fileContents = await readFile(dbFilePath, "utf-8");
  return JSON.parse(fileContents) as Database;
}

async function writeDatabase(
  dbFilePath: string,
  database: Database,
): Promise<void> {
  const json = JSON.stringify(database, null, 2);
  await writeFile(dbFilePath, `${json}\n`, "utf-8");
}

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