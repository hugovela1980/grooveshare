import type {
    CreateTrackInput,
    Track,
    UpdatePlaybackDerivativeInput,
    UpdateTrackDetailsInput,
    UpdateTrackNameInput,
} from "../types.js";

export type UpdateTrackResult =
    | {
        ok: true;
        updatedTrack: Track;
    }
    | {
        ok: false;
        reason: "project-not-found" | "track-not-found";
    };

export type DeleteTrackResult =
    | {
        ok: true;
        deletedTrack: Track;
    }
    | {
        ok: false;
        reason: "project-not-found" | "track-not-found";
    };

export type TracksStore = {
    getTracksByProjectId: (projectId: string) => Promise<Track[]>;
    createTrack: (trackInput: CreateTrackInput) => Promise<Track>;

    updateTrackDetails: (
        projectId: string,
        trackId: string,
        trackInput: UpdateTrackDetailsInput,
    ) => Promise<UpdateTrackResult>;

    updateTrackName: (
        projectId: string,
        trackId: string,
        trackInput: UpdateTrackNameInput,
    ) => Promise<UpdateTrackResult>;

    updatePlaybackDerivative: (
        projectId: string,
        trackId: string,
        derivative: UpdatePlaybackDerivativeInput,
    ) => Promise<UpdateTrackResult>;

    deleteTrackById: (
        projectId: string,
        trackId: string,
    ) => Promise<DeleteTrackResult>;

    getTrackById: (
        projectId: string,
        trackId: string,
    ) => Promise<Track | null>;
};
