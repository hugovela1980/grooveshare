import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import type { Database } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

const TEST_DB_DIR = path.join(process.cwd(), "tests/.tmp");
const TEST_DB_FILE_PATH = path.join(TEST_DB_DIR, "db.json");

async function resetTestDatabase(): Promise<void> {
  const emptyDatabase: Database = {
    projects: [],
    tracks: [],
  };

  await mkdir(TEST_DB_DIR, { recursive: true });

  await writeFile(
    TEST_DB_FILE_PATH,
    `${JSON.stringify(emptyDatabase, null, 2)}\n`,
    "utf-8",
  );
}

async function readTestDatabase(): Promise<Database> {
  const fileContents = await readFile(TEST_DB_FILE_PATH, "utf-8");
  return JSON.parse(fileContents) as Database;
}

tester.describe("projects JSON store", () => {
  tester.beforeEach(async () => {
    await resetTestDatabase();
  });

  tester.it("returns an empty project list when no projects exist", async () => {
    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const projects = await store.getProjects();

    tester.expect(projects).toEqual([]);
  });

  tester.it("creates a project and returns the saved project", async () => {
    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const project = await store.createProject({
      title: "Chorus Riff Idea",
      description: "Guitar riff with scratch drums",
    });

    tester.expect(typeof project.id).toBe("string");
    tester.expect(project.title).toBe("Chorus Riff Idea");
    tester.expect(project.description).toBe("Guitar riff with scratch drums");
    tester.expect(typeof project.createdAt).toBe("string");
    tester.expect(typeof project.updatedAt).toBe("string");
  });

  tester.it("writes created projects to the JSON database file", async () => {
    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const project = await store.createProject({
      title: "Chorus Riff Idea",
      description: "Guitar riff with scratch drums",
    });

    const database = await readTestDatabase();

    tester.expect(database.projects.length).toBe(1);
    tester.expect(database.projects[0]).toEqual(project);
  });

  tester.it("returns a project by ID", async () => {
    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const project = await store.createProject({
      title: "Verse Groove",
      description: "Clean guitar groove for verse",
    });

    const foundProject = await store.getProjectById(project.id);

    tester.expect(foundProject).toEqual(project);
  });

  tester.it("returns null when a project ID does not exist", async () => {
    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const foundProject = await store.getProjectById("missing-project-id");

    tester.expect(foundProject).toBe(null);
  });

  tester.it("does not modify the tracks collection when creating a project", async () => {
    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    await store.createProject({
      title: "Bridge Riff",
      description: "Bridge idea with no tracks yet",
    });

    const database = await readTestDatabase();

    tester.expect(database.tracks).toEqual([]);
  });
});