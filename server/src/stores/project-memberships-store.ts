export type ProjectRole =
    | "owner"
    | "contributor"
    | "viewer";

export type ProjectMembership = {
    projectId: string;
    userId: string;
    role: ProjectRole;
    createdAt: string;
    updatedAt: string;
};

export type CreateProjectMembershipInput = {
    projectId: string;
    userId: string;
    role: ProjectRole;
};

export type ProjectMembershipsStore = {
    createMembership: (
        membershipInput:
            CreateProjectMembershipInput,
    ) => Promise<ProjectMembership>;

    getMembership: (
        projectId: string,
        userId: string,
    ) => Promise<ProjectMembership | null>;

    getMembershipsByProjectId: (
        projectId: string,
    ) => Promise<ProjectMembership[]>;

    getMembershipsByUserId: (
        userId: string,
    ) => Promise<ProjectMembership[]>;

    updateMembershipRole: (
        projectId: string,
        userId: string,
        role: ProjectRole,
    ) => Promise<ProjectMembership | null>;

    deleteMembership: (
        projectId: string,
        userId: string,
    ) => Promise<boolean>;
};
