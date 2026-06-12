import type { CreateTrackInput, Track } from "../types.js";
import {
  DEFAULT_DB_FILE_PATH,
  readDatabase,
  writeDatabase,
} from "./json-db.js";

export type TracksStore = {
  getTracksByProjectId: (projectId: string) => Promise<Track[]>;
  createTrack: (trackInput: CreateTrackInput) => Promise<Track>;
};

export function createTracksJsonStore(
  dbFilePath = DEFAULT_DB_FILE_PATH,
): TracksStore {
  async function getTracksByProjectId(projectId: string): Promise<Track[]> {
    const database = await readDatabase(dbFilePath);

    return database.tracks.filter((track) => {
      return track.projectId === projectId;
    });
  }

  async function createTrack(trackInput: CreateTrackInput): Promise<Track> {
    const database = await readDatabase(dbFilePath);

    const now = new Date().toISOString();

    const track: Track = {
      id: crypto.randomUUID(),
      projectId: trackInput.projectId,
      name: trackInput.name,
      originalFilename: trackInput.originalFilename,
      filePath: trackInput.filePath,
      mimeType: trackInput.mimeType,
      fileSize: trackInput.fileSize,
      createdAt: now,
    };

    database.tracks.push(track);

    await writeDatabase(dbFilePath, database);

    return track;
  }

  return {
    getTracksByProjectId,
    createTrack,
  };
}

export const tracksJsonStore = createTracksJsonStore();

export const getTracksByProjectId = tracksJsonStore.getTracksByProjectId;
export const createTrack = tracksJsonStore.createTrack;