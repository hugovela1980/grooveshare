import type {
    CreateProjectInput,
    MixSettings,
    Project,
    Track,
    UpdateProjectDetailsInput,
} from "../types.js";

export type ProjectsStore = {
    getProjects: () => Promise<Project[]>;
    getProjectById: (projectId: string) => Promise<Project | null>;
    createProject: (projectInput: CreateProjectInput) => Promise<Project>;

    updateProjectDetails: (
        projectId: string,
        projectInput: UpdateProjectDetailsInput,
    ) => Promise<Project | null>;

    updateProjectMixSettings: (
        projectId: string,
        mixSettings: MixSettings,
    ) => Promise<Project | null>;

    deleteProjectById: (
        projectId: string,
    ) => Promise<DeleteProjectResult>;
};

export type DeleteProjectResult =
    | {
        ok: true;
        deletedProject: Project;
        deletedTracks: Track[];
    }
    | {
        ok: false;
        reason: "project-not-found";
    };