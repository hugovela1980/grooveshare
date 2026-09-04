import type {
  CreateTrackInput,
  Track,
  UpdatePlaybackDerivativeInput,
  UpdateTrackDetailsInput,
  UpdateTrackNameInput,
} from "../types.js";
import {
  createPendingPlaybackDerivative,
  normalizePlaybackDerivative,
  validatePlaybackDerivative,
} from "../playback-derivative.js";

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

function normalizeTrack(track: Track): Track {
  return {
    ...track,
    playbackDerivative: normalizePlaybackDerivative(track.playbackDerivative),
    musicalPlacement: track.musicalPlacement ?? {
      start: { bar: 1, beat: 1 },
      spanBeats: null,
    },
    alignmentOffsetSeconds: track.alignmentOffsetSeconds ?? 0,
    mediaLeadInSeconds: track.mediaLeadInSeconds ?? 0,
  };
}

export function createTracksJsonStore(
  dbFilePath = DEFAULT_DB_FILE_PATH,
): TracksStore {
  async function getTracksByProjectId(projectId: string): Promise<Track[]> {
    const database = await readDatabase(dbFilePath);

    return database.tracks
      .filter((track) => {
        return track.projectId === projectId;
      })
      .map(normalizeTrack);
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
      playbackDerivative: createPendingPlaybackDerivative(),
      uploadedByUserId: trackInput.uploadedByUserId,
      musicalPlacement: trackInput.musicalPlacement ?? {
        start: { bar: 1, beat: 1 },
        spanBeats: null,
      },
      alignmentOffsetSeconds: trackInput.alignmentOffsetSeconds ?? 0,
      mediaLeadInSeconds: trackInput.mediaLeadInSeconds ?? 0,
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

    const normalizedExistingTrack = normalizeTrack(existingTrack);
    const updatedTrack: Track = {
      ...normalizedExistingTrack,
      ...(trackInput.name !== undefined ? { name: trackInput.name } : {}),
      musicalPlacement:
        trackInput.musicalPlacement ??
        normalizedExistingTrack.musicalPlacement ?? {
          start: { bar: 1, beat: 1 },
          spanBeats: null,
        },
      alignmentOffsetSeconds:
        trackInput.alignmentOffsetSeconds ??
        normalizedExistingTrack.alignmentOffsetSeconds ??
        0,
      mediaLeadInSeconds: normalizedExistingTrack.mediaLeadInSeconds ?? 0,
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

  async function updatePlaybackDerivative(
    projectId: string,
    trackId: string,
    derivativeInput: UpdatePlaybackDerivativeInput,
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
    const existingTrack = database.tracks[trackIndex];

    if (trackIndex === -1 || !existingTrack) {
      return { ok: false, reason: "track-not-found" };
    }

    const updatedTrack: Track = {
      ...normalizeTrack(existingTrack),
      playbackDerivative: validatePlaybackDerivative(derivativeInput),
    };

    database.tracks[trackIndex] = updatedTrack;
    await writeDatabase(dbFilePath, database);

    return { ok: true, updatedTrack };
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
      deletedTrack: {
        ...deletedTrack,
        playbackDerivative: normalizePlaybackDerivative(
          deletedTrack.playbackDerivative,
        ),
      },
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
      ? normalizeTrack(track)
      : null;
  }

  return {
    getTracksByProjectId,
    getTrackById,
    createTrack,
    updateTrackDetails,
    updateTrackName,
    updatePlaybackDerivative,
    deleteTrackById,
  };
}

export const tracksJsonStore = createTracksJsonStore();

export const getTracksByProjectId = tracksJsonStore.getTracksByProjectId;
export const getTrackById = tracksJsonStore.getTrackById;
export const createTrack = tracksJsonStore.createTrack;
export const deleteTrackById = tracksJsonStore.deleteTrackById;
