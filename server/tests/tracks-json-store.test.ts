import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type { Database } from "../src/types.js";
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
    });

    const drumTrack = await store.createTrack({
      projectId: "project-1",
      name: "Drums",
      originalFilename: "drums.wav",
      filePath: "uploads/projects/project-1/track-2-drums.wav",
      mimeType: "audio/wav",
      fileSize: 200,
    });

    await store.createTrack({
      projectId: "project-2",
      name: "Bass",
      originalFilename: "bass.wav",
      filePath: "uploads/projects/project-2/track-3-bass.wav",
      mimeType: "audio/wav",
      fileSize: 300,
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
    });

    const database = await readTestDatabase();

    tester.expect(database.projects).toEqual([]);
  });
});