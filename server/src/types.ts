export type MixChannelSetting = {
    channelNumber: number;
    trackId: string;
    enabled: boolean;
    volume: number;
};

export type MixSettings = {
    channels: MixChannelSetting[];
};

export type Project = {
    id: string;
    title: string;
    description: string;
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
    createdAt: string;
};

export type Database = {
    projects: Project[];
    tracks: Track[];
};

export type CreateProjectInput = {
    title: string;
    description: string;
};

export type UpdateProjectDetailsInput = {
    title?: string;
    description?: string;
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
};