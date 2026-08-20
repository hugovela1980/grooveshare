import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import type { Database, Project, Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

const TEST_DB_DIR = path.join(process.cwd(), "tests/.tmp");
const TEST_DB_FILE_PATH = path.join(TEST_DB_DIR, "db.json");

async function writeTestDatabase(database: Database): Promise<void> {
  await mkdir(TEST_DB_DIR, { recursive: true });

  await writeFile(
    TEST_DB_FILE_PATH,
    `${JSON.stringify(database, null, 2)}\n`,
    "utf-8",
  );
}

function createTestProject(id = "project-1"): Project {
  return {
    id,
    title: `Project ${id}`,
    description: "Test project",
    musicalTimeline: {
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function createTestTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    projectId: "project-1",
    name: "Guitar",
    originalFilename: "guitar.wav",
    filePath: "uploads/projects/project-1/track-1-guitar.wav",
    mimeType: "audio/wav",
    fileSize: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
    uploadedByUserId: overrides.uploadedByUserId ?? null,
  };
}

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
    tester.expect(project.musicalTimeline).toEqual({
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    });
    tester.expect(typeof project.createdAt).toBe("string");
    tester.expect(typeof project.updatedAt).toBe("string");
    tester.expect(project.mixSettings).toEqual({ channels: [] });
  });

  tester.it("creates a project with explicit musical timing", async () => {
    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const project = await store.createProject({
      title: "DAW Session",
      description: "Imported stems",
      musicalTimeline: {
        bpm: 92.5,
        timeSignature: { numerator: 7, denominator: 8 },
      },
    });

    tester.expect(project.musicalTimeline).toEqual({
      bpm: 92.5,
      timeSignature: { numerator: 7, denominator: 8 },
    });
  });

  tester.it("normalizes legacy projects without musical timing", async () => {
    const legacyProject: Project = {
      id: "legacy-project",
      title: "Legacy",
      description: "Predates musical timing",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    await writeTestDatabase({ projects: [legacyProject], tracks: [] });

    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);
    const project = await store.getProjectById("legacy-project");

    tester.expect(project?.musicalTimeline).toEqual({
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    });
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

  tester.it("deletes a project and its linked track metadata", async () => {
    const projectToDelete = createTestProject("project-1");
    const projectToKeep = createTestProject("project-2");

    const linkedTrack = createTestTrack({
      id: "track-1",
      projectId: "project-1",
    });

    const otherProjectTrack = createTestTrack({
      id: "track-2",
      projectId: "project-2",
      name: "Bass",
      originalFilename: "bass.wav",
      filePath: "uploads/projects/project-2/track-2-bass.wav",
    });

    await writeTestDatabase({
      projects: [projectToDelete, projectToKeep],
      tracks: [linkedTrack, otherProjectTrack],
    });

    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const result = await store.deleteProjectById("project-1");

    tester.expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected project deletion to succeed.");
    }

    tester.expect(result.deletedProject).toEqual(projectToDelete);
    tester.expect(result.deletedTracks).toEqual([linkedTrack]);

    const database = await readTestDatabase();

    tester.expect(database.projects).toEqual([projectToKeep]);
    tester.expect(database.tracks).toEqual([otherProjectTrack]);
  });

  tester.it("does not delete anything when the project does not exist", async () => {
    const existingProject = createTestProject("project-1");
    const existingTrack = createTestTrack({
      id: "track-1",
      projectId: "project-1",
    });

    await writeTestDatabase({
      projects: [existingProject],
      tracks: [existingTrack],
    });

    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const result = await store.deleteProjectById("missing-project");

    tester.expect(result).toEqual({
      ok: false,
      reason: "project-not-found",
    });

    const database = await readTestDatabase();

    tester.expect(database.projects).toEqual([existingProject]);
    tester.expect(database.tracks).toEqual([existingTrack]);
  });

  tester.it("returns all deleted tracks linked to the deleted project", async () => {
    const projectToDelete = createTestProject("project-1");

    const guitarTrack = createTestTrack({
      id: "track-1",
      projectId: "project-1",
      name: "Guitar",
    });

    const drumTrack = createTestTrack({
      id: "track-2",
      projectId: "project-1",
      name: "Drums",
      originalFilename: "drums.wav",
      filePath: "uploads/projects/project-1/track-2-drums.wav",
    });

    await writeTestDatabase({
      projects: [projectToDelete],
      tracks: [guitarTrack, drumTrack],
    });

    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const result = await store.deleteProjectById("project-1");

    tester.expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected project deletion to succeed.");
    }

    tester.expect(result.deletedTracks).toEqual([guitarTrack, drumTrack]);

    const database = await readTestDatabase();

    tester.expect(database.projects).toEqual([]);
    tester.expect(database.tracks).toEqual([]);
  });

  tester.it("saves mix settings for a project", async () => {
    const project = createTestProject("project-1");

    await writeTestDatabase({
      projects: [project],
      tracks: [],
    });

    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const updatedProject = await store.updateProjectMixSettings(
      "project-1",
      {
        channels: [
          {
            channelNumber: 1,
            trackId: "track-1",
            enabled: true,
            volume: 0.75,
          },
          {
            channelNumber: 2,
            trackId: "track-2",
            enabled: false,
            volume: 0.25,
          },
        ],
      },
    );

    tester.expect(updatedProject?.mixSettings).toEqual({
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: true,
          volume: 0.75,
        },
        {
          channelNumber: 2,
          trackId: "track-2",
          enabled: false,
          volume: 0.25,
        },
      ],
    });

    const database = await readTestDatabase();

    tester.expect(database.projects[0]?.mixSettings).toEqual({
      channels: [
        {
          channelNumber: 1,
          trackId: "track-1",
          enabled: true,
          volume: 0.75,
        },
        {
          channelNumber: 2,
          trackId: "track-2",
          enabled: false,
          volume: 0.25,
        },
      ],
    });
  });

  tester.it("returns null when saving mix settings for a missing project", async () => {
    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const result = await store.updateProjectMixSettings(
      "missing-project",
      {
        channels: [],
      },
    );

    tester.expect(result).toBe(null);
  });
  tester.it("updates project title and description details", async () => {
    const project = createTestProject("project-1");

    await writeTestDatabase({
      projects: [project],
      tracks: [],
    });

    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const updatedTitleProject = await store.updateProjectDetails(
      "project-1",
      {
        title: "Updated Project Title",
      },
    );

    tester.expect(updatedTitleProject?.title).toBe("Updated Project Title");
    tester.expect(updatedTitleProject?.description).toBe("Test project");

    const updatedDescriptionProject = await store.updateProjectDetails(
      "project-1",
      {
        description: "Updated project description",
      },
    );

    tester.expect(updatedDescriptionProject?.title).toBe("Updated Project Title");
    tester.expect(updatedDescriptionProject?.description).toBe(
      "Updated project description",
    );

    const database = await readTestDatabase();

    tester.expect(database.projects[0]?.title).toBe("Updated Project Title");
    tester.expect(database.projects[0]?.description).toBe(
      "Updated project description",
    );
  });

  tester.it("returns null when updating details for a missing project", async () => {
    const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

    const result = await store.updateProjectDetails(
      "missing-project",
      {
        title: "Updated Project Title",
      },
    );

    tester.expect(result).toBe(null);
  });

});