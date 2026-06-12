export type Project = {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
};

export type Track = {
    id: string;
    projectId: string;
    name: string;
    orignalFilename: string;
    filePath: string;
    mimeType: string;
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