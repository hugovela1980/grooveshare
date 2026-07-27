import type { CreateProjectInput } from "../types.js";

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

    function addPendingTrack({
        trackName,
        audioFile,
    }: AddPendingTrackInput): PendingTrackDraft {
        const pendingTrack: PendingTrackDraft = {
            id: createId(),
            trackName: trackName.trim() || audioFile.name,
            audioFile,
            originalFilename: audioFile.name,
            mimeType: audioFile.type,
            fileSize: audioFile.size,
        };

        pendingTracks = [...pendingTracks, pendingTrack];

        return pendingTrack;
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
        removePendingTrack,
        getPendingTracks,
        getSnapshot,
        clear,
    };
}