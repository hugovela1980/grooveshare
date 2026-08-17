import type { CreateProjectInput } from "../types.js";

export const MAX_PENDING_TRACKS = 4;

export type ProjectDraft = CreateProjectInput;

export type PendingTrackDraft = {
    id: string;
    trackName: string;
    audioFile: File;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
};

export type AddPendingTrackInput = {
    trackName: string;
    audioFile: File;
};

type ProjectDraftSnapshot = {
    project: ProjectDraft | null;
    pendingTracks: PendingTrackDraft[];
};

type CreateProjectDraftStateOptions = {
    createId?: () => string;
};

export function createProjectDraftState({
    createId = () => crypto.randomUUID(),
}: CreateProjectDraftStateOptions = {}) {
    let project: ProjectDraft | null = null;
    let pendingTracks: PendingTrackDraft[] = [];

    function setProjectDraft(input: CreateProjectInput): void {
        project = {
            title: input.title.trim(),
            description: input.description.trim(),
        };
    }

    function getProjectDraft(): ProjectDraft | null {
        return project;
    }

    function getPendingTrackSlotsRemaining(): number {
        return Math.max(MAX_PENDING_TRACKS - pendingTracks.length, 0);
    }

    function canAddPendingTracks(trackCount: number): boolean {
        return trackCount <= getPendingTrackSlotsRemaining();
    }

    function createPendingTrack({
        trackName,
        audioFile,
    }: AddPendingTrackInput): PendingTrackDraft {
        return {
            id: createId(),
            trackName: trackName.trim() || audioFile.name,
            audioFile,
            originalFilename: audioFile.name,
            mimeType: audioFile.type,
            fileSize: audioFile.size,
        };
    }

    function addPendingTracks(
        inputs: AddPendingTrackInput[],
    ): PendingTrackDraft[] {
        if (!canAddPendingTracks(inputs.length)) {
            throw new Error(
                `A project can include up to ${MAX_PENDING_TRACKS} audio tracks.`,
            );
        }

        const newPendingTracks = inputs.map(createPendingTrack);

        pendingTracks = [...pendingTracks, ...newPendingTracks];

        return newPendingTracks;
    }

    function addPendingTrack(input: AddPendingTrackInput): PendingTrackDraft {
        return addPendingTracks([input])[0];
    }

    function updatePendingTrackName(trackDraftId: string, trackName: string): void {
        pendingTracks = pendingTracks.map((track) => {
            if (track.id !== trackDraftId) {
                return track;
            }

            return {
                ...track,
                trackName: trackName.trim() || track.originalFilename,
            };
        });
    }

    function removePendingTrack(trackDraftId: string): void {
        pendingTracks = pendingTracks.filter((track) => {
            return track.id !== trackDraftId;
        });
    }

    function getPendingTracks(): PendingTrackDraft[] {
        return pendingTracks;
    }

    function getSnapshot(): ProjectDraftSnapshot {
        return {
            project,
            pendingTracks,
        };
    }

    function clear(): void {
        project = null;
        pendingTracks = [];
    }

    return {
        setProjectDraft,
        getProjectDraft,
        addPendingTrack,
        addPendingTracks,
        updatePendingTrackName,
        removePendingTrack,
        getPendingTracks,
        getPendingTrackSlotsRemaining,
        canAddPendingTracks,
        getSnapshot,
        clear,
    };
}