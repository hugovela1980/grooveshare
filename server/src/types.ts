export type MixChannelSetting = {
    channelNumber: number;
    trackId: string;
    enabled: boolean;
    volume: number;
};

export type MixSettings = {
    channels: MixChannelSetting[];
};

export type TimeSignature = {
    numerator: number;
    denominator: number;
};

export type MusicalTimeline = {
    bpm: number;
    timeSignature: TimeSignature;
};

export type MusicalPosition = {
    bar: number;
    beat: number;
};

export type TrackMusicalPlacement = {
    start: MusicalPosition;
    spanBeats: number | null;
};

export type Project = {
    id: string;
    title: string;
    description: string;
    musicalTimeline?: MusicalTimeline;
    mixSettings?: MixSettings;
    createdAt: string;
    updatedAt: string;
};

export type Track = {
    id: string;
    projectId: string;
    name: string;
    originalFilename: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    uploadedByUserId: string | null;
    musicalPlacement?: TrackMusicalPlacement;
    alignmentOffsetSeconds?: number;
    createdAt: string;
};

export type Database = {
    projects: Project[];
    tracks: Track[];
};

export type CreateProjectInput = {
    title: string;
    description: string;
    musicalTimeline?: MusicalTimeline;
};

export type UpdateProjectDetailsInput = {
    title?: string;
    description?: string;
    musicalTimeline?: MusicalTimeline;
};

export type UpdateTrackDetailsInput = {
    name?: string;
    musicalPlacement?: TrackMusicalPlacement;
    alignmentOffsetSeconds?: number;
};

export type UpdateTrackNameInput = {
    name: string;
};

export type CreateTrackInput = {
    projectId: string;
    name: string;
    originalFilename: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    uploadedByUserId: string | null;
    musicalPlacement?: TrackMusicalPlacement;
    alignmentOffsetSeconds?: number;
};