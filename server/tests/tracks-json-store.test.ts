import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type { Database, Project, Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

const TEST_DB_DIR = path.join(process.cwd(), "tests/.tmp");
const TEST_DB_FILE_PATH = path.join(TEST_DB_DIR, "tracks-db.json");

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
    uploadedByUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

tester.describe("tracks JSON store", () => {
  tester.beforeEach(async () => {
    await resetTestDatabase();
  });

  tester.it("creates a track and returns the saved track", async () => {
    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const track = await store.createTrack({
      projectId: "project-1",
      name: "Guitar",
      originalFilename: "guitar-riff.wav",
      filePath: "uploads/projects/project-1/track-1-guitar-riff.wav",
      mimeType: "audio/wav",
      fileSize: 123456,
      uploadedByUserId: null,
    });

    tester.expect(typeof track.id).toBe("string");
    tester.expect(track.projectId).toBe("project-1");
    tester.expect(track.name).toBe("Guitar");
    tester.expect(track.originalFilename).toBe("guitar-riff.wav");
    tester.expect(track.filePath).toBe(
      "uploads/projects/project-1/track-1-guitar-riff.wav",
    );
    tester.expect(track.mimeType).toBe("audio/wav");
    tester.expect(track.fileSize).toBe(123456);
    tester.expect(typeof track.createdAt).toBe("string");
  });

  tester.it("writes created tracks to the JSON database file", async () => {
    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const track = await store.createTrack({
      projectId: "project-1",
      name: "Scratch Drums",
      originalFilename: "scratch-drums.wav",
      filePath: "uploads/projects/project-1/track-2-scratch-drums.wav",
      mimeType: "audio/wav",
      fileSize: 654321,
      uploadedByUserId: null,
    });

    const database = await readTestDatabase();

    tester.expect(database.tracks.length).toBe(1);
    tester.expect(database.tracks[0]).toEqual(track);
  });

  tester.it("returns tracks by project ID", async () => {
    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const guitarTrack = await store.createTrack({
      projectId: "project-1",
      name: "Guitar",
      originalFilename: "guitar.wav",
      filePath: "uploads/projects/project-1/track-1-guitar.wav",
      mimeType: "audio/wav",
      fileSize: 100,
      uploadedByUserId: null,
    });

    const drumTrack = await store.createTrack({
      projectId: "project-1",
      name: "Drums",
      originalFilename: "drums.wav",
      filePath: "uploads/projects/project-1/track-2-drums.wav",
      mimeType: "audio/wav",
      fileSize: 200,
      uploadedByUserId: null,
    });

    await store.createTrack({
      projectId: "project-2",
      name: "Bass",
      originalFilename: "bass.wav",
      filePath: "uploads/projects/project-2/track-3-bass.wav",
      mimeType: "audio/wav",
      fileSize: 300,
      uploadedByUserId: null,
    });

    const tracks = await store.getTracksByProjectId("project-1");

    tester.expect(tracks).toEqual([guitarTrack, drumTrack]);
  });

  tester.it("returns an empty track list when a project has no tracks", async () => {
    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    await store.createTrack({
      projectId: "project-2",
      name: "Bass",
      originalFilename: "bass.wav",
      filePath: "uploads/projects/project-2/track-1-bass.wav",
      mimeType: "audio/wav",
      fileSize: 300,
      uploadedByUserId: null,
    });

    const tracks = await store.getTracksByProjectId("project-1");

    tester.expect(tracks).toEqual([]);
  });

  tester.it("does not modify the projects collection when creating a track", async () => {
    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    await store.createTrack({
      projectId: "project-1",
      name: "Guitar",
      originalFilename: "guitar.wav",
      filePath: "uploads/projects/project-1/track-1-guitar.wav",
      mimeType: "audio/wav",
      fileSize: 100,
      uploadedByUserId: null,
    });

    const database = await readTestDatabase();

    tester.expect(database.projects).toEqual([]);
  });

  tester.it("deletes a track by project ID and track ID", async () => {
    const trackToDelete = createTestTrack({
      id: "track-1",
      projectId: "project-1",
    });

    const trackToKeep = createTestTrack({
      id: "track-2",
      projectId: "project-1",
      name: "Bass",
      originalFilename: "bass.wav",
      filePath: "uploads/projects/project-1/track-2-bass.wav",
    });

    await writeTestDatabase({
      projects: [createTestProject("project-1")],
      tracks: [trackToDelete, trackToKeep],
    });

    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const result = await store.deleteTrackById("project-1", "track-1");

    tester.expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected track deletion to succeed");
    }

    tester.expect(result.deletedTrack).toEqual(trackToDelete);

    const database = await readTestDatabase();

    tester.expect(database.tracks).toEqual([trackToKeep]);
  });

  tester.it("does not delete a track when the project does not exist", async () => {
    const track = createTestTrack({
      id: "track-1",
      projectId: "project-1",
    });

    await writeTestDatabase({
      projects: [],
      tracks: [track],
    });

    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const result = await store.deleteTrackById("missing-project", "track-1");

    tester.expect(result).toEqual({
      ok: false,
      reason: "project-not-found",
    });

    const database = await readTestDatabase();

    tester.expect(database.tracks).toEqual([track]);
  });

  tester.it("does not delete a track when the track does not exist", async () => {
    const track = createTestTrack({
      id: "track-1",
      projectId: "project-1",
    });

    await writeTestDatabase({
      projects: [createTestProject("project-1")],
      tracks: [track],
    });

    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const result = await store.deleteTrackById("project-1", "missing-track");

    tester.expect(result).toEqual({
      ok: false,
      reason: "track-not-found",
    });

    const database = await readTestDatabase();

    tester.expect(database.tracks).toEqual([track]);
  });

  tester.it("does not delete tracks from a different project", async () => {
    const projectOneTrack = createTestTrack({
      id: "track-1",
      projectId: "project-1",
    });

    const projectTwoTrack = createTestTrack({
      id: "track-2",
      projectId: "project-2",
      name: "Drums",
      originalFilename: "drums.wav",
      filePath: "uploads/projects/project-2/track-2-drums.wav",
    });

    await writeTestDatabase({
      projects: [createTestProject("project-1"), createTestProject("project-2")],
      tracks: [projectOneTrack, projectTwoTrack],
    });

    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const result = await store.deleteTrackById("project-1", "track-1");

    tester.expect(result.ok).toBe(true);

    const database = await readTestDatabase();

    tester.expect(database.tracks).toEqual([projectTwoTrack]);
  });

  tester.it("returns a track by project ID and track ID", async () => {
    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const createdTrack = await store.createTrack({
      projectId: "project-1",
      name: "Guitar",
      originalFilename: "guitar.wav",
      filePath: "server/uploads/projects/project-1/guitar.wav",
      mimeType: "audio/wav",
      fileSize: 123,
      uploadedByUserId: null,
    });

    const foundTrack = await store.getTrackById("project-1", createdTrack.id);

    tester.expect(foundTrack).toEqual(createdTrack);
  });

  tester.it("returns null when a track cannot be found by project ID and track ID", async () => {
    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const foundTrack = await store.getTrackById("project-1", "missing-track");

    tester.expect(foundTrack).toBe(null);
  });
  tester.it("updates a track name and persists it", async () => {
    const track = createTestTrack();

    await writeTestDatabase({
      projects: [createTestProject("project-1")],
      tracks: [track],
    });

    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const result = await store.updateTrackName(
      "project-1",
      "track-1",
      {
        name: "Lead Guitar",
      },
    );

    tester.expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected track name update to succeed.");
    }

    tester.expect(result.updatedTrack.name).toBe("Lead Guitar");

    const database = await readTestDatabase();

    tester.expect(database.tracks[0]?.name).toBe("Lead Guitar");
  });

  tester.it("returns project-not-found when updating a track for a missing project", async () => {
    const track = createTestTrack();

    await writeTestDatabase({
      projects: [],
      tracks: [track],
    });

    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const result = await store.updateTrackName(
      "missing-project",
      "track-1",
      {
        name: "Lead Guitar",
      },
    );

    tester.expect(result).toEqual({
      ok: false,
      reason: "project-not-found",
    });
  });

  tester.it("returns track-not-found when updating a missing track", async () => {
    await writeTestDatabase({
      projects: [createTestProject("project-1")],
      tracks: [],
    });

    const store = createTracksJsonStore(TEST_DB_FILE_PATH);

    const result = await store.updateTrackName(
      "project-1",
      "missing-track",
      {
        name: "Lead Guitar",
      },
    );

    tester.expect(result).toEqual({
      ok: false,
      reason: "track-not-found",
    });
  });

  tester.it("persists the user who uploaded a track", async () => {
    const store = createTracksJsonStore(TEST_DB_FILE_PATH);
    const uploaderUserId = "user-1";

    const track = await store.createTrack({
      projectId: "project-1",
      name: "Owned Guitar",
      originalFilename: "owned-guitar.wav",
      filePath: "uploads/projects/project-1/owned-guitar.wav",
      mimeType: "audio/wav",
      fileSize: 100,
      uploadedByUserId: uploaderUserId,
    });

    tester.expect(track.uploadedByUserId).toBe(uploaderUserId);

    const database = await readTestDatabase();

    tester.expect(database.tracks[0]?.uploadedByUserId).toBe(
      uploaderUserId,
    );
  });

});
