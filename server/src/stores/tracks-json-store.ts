import type {
  CreateTrackInput,
  Track,
  UpdateTrackDetailsInput,
  UpdateTrackNameInput,
} from "../types.js";

import type {
  DeleteTrackResult,
  TracksStore,
  UpdateTrackResult,
} from "./tracks-store.js";

import {
  DEFAULT_DB_FILE_PATH,
  readDatabase,
  writeDatabase,
} from "./json-db.js";

export function createTracksJsonStore(
  dbFilePath = DEFAULT_DB_FILE_PATH,
): TracksStore {
  async function getTracksByProjectId(projectId: string): Promise<Track[]> {
    const database = await readDatabase(dbFilePath);

    return database.tracks
      .filter((track) => {
        return track.projectId === projectId;
      })
      .map((track) => ({
        ...track,
        musicalPlacement: track.musicalPlacement ?? {
          start: { bar: 1, beat: 1 },
          spanBeats: null,
        },
      }));
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
      uploadedByUserId: trackInput.uploadedByUserId,
      musicalPlacement: trackInput.musicalPlacement ?? {
        start: { bar: 1, beat: 1 },
        spanBeats: null,
      },
      createdAt: now,
    };

    database.tracks.push(track);

    await writeDatabase(dbFilePath, database);

    return track;
  }

  async function updateTrackDetails(
    projectId: string,
    trackId: string,
    trackInput: UpdateTrackDetailsInput,
  ): Promise<UpdateTrackResult> {
    const database = await readDatabase(dbFilePath);

    const projectExists = database.projects.some((project) => {
      return project.id === projectId;
    });

    if (!projectExists) {
      return { ok: false, reason: "project-not-found" };
    }

    const trackIndex = database.tracks.findIndex((track) => {
      return track.projectId === projectId && track.id === trackId;
    });

    if (trackIndex === -1) {
      return { ok: false, reason: "track-not-found" };
    }

    const existingTrack = database.tracks[trackIndex];

    if (!existingTrack) {
      return { ok: false, reason: "track-not-found" };
    }

    const updatedTrack: Track = {
      ...existingTrack,
      ...(trackInput.name !== undefined ? { name: trackInput.name } : {}),
      musicalPlacement:
        trackInput.musicalPlacement ??
        existingTrack.musicalPlacement ?? {
          start: { bar: 1, beat: 1 },
          spanBeats: null,
        },
    };

    database.tracks[trackIndex] = updatedTrack;
    await writeDatabase(dbFilePath, database);

    return { ok: true, updatedTrack };
  }

  async function updateTrackName(
    projectId: string,
    trackId: string,
    trackInput: UpdateTrackNameInput,
  ): Promise<UpdateTrackResult> {
    return updateTrackDetails(projectId, trackId, { name: trackInput.name });
  }

  async function deleteTrackById(
    projectId: string,
    trackId: string,
  ): Promise<DeleteTrackResult> {
    const database = await readDatabase(dbFilePath);

    const projectExists = database.projects.some((project) => {
      return project.id === projectId;
    });

    if (!projectExists) {
      return {
        ok: false,
        reason: "project-not-found",
      };
    }

    const deletedTrack = database.tracks.find((track) => {
      return track.projectId === projectId && track.id === trackId;
    });

    if (!deletedTrack) {
      return {
        ok: false,
        reason: "track-not-found",
      };
    }

    database.tracks = database.tracks.filter((track) => {
      return !(track.projectId === projectId && track.id === trackId);
    });

    await writeDatabase(dbFilePath, database);

    return {
      ok: true,
      deletedTrack,
    };
  }

  async function getTrackById(
    projectId: string,
    trackId: string,
  ): Promise<Track | null> {
    const database = await readDatabase(dbFilePath);

    const track = database.tracks.find((track) => {
      return track.projectId === projectId && track.id === trackId;
    });

    return track
      ? {
          ...track,
          musicalPlacement: track.musicalPlacement ?? {
            start: { bar: 1, beat: 1 },
            spanBeats: null,
          },
        }
      : null;
  }

  return {
    getTracksByProjectId,
    getTrackById,
    createTrack,
    updateTrackDetails,
    updateTrackName,
    deleteTrackById,
  };
}

export const tracksJsonStore = createTracksJsonStore();

export const getTracksByProjectId = tracksJsonStore.getTracksByProjectId;
export const getTrackById = tracksJsonStore.getTrackById;
export const createTrack = tracksJsonStore.createTrack;
export const deleteTrackById = tracksJsonStore.deleteTrackById;