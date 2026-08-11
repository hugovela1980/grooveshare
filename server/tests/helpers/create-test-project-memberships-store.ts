import type {
    CreateProjectMembershipInput,
    ProjectMembership,
    ProjectMembershipsStore,
    ProjectRole,
} from "../../src/stores/project-memberships-store.js";

export function createTestProjectMembershipsStore():
    ProjectMembershipsStore {
    const memberships: ProjectMembership[] = [];

    async function createMembership(
        membershipInput:
            CreateProjectMembershipInput,
    ): Promise<ProjectMembership> {
        const now = new Date().toISOString();

        const membership: ProjectMembership = {
            projectId:
                membershipInput.projectId,
            userId:
                membershipInput.userId,
            role:
                membershipInput.role,
            createdAt: now,
            updatedAt: now,
        };

        memberships.push(membership);

        return membership;
    }

    async function getMembership(
        projectId: string,
        userId: string,
    ): Promise<ProjectMembership | null> {
        return (
            memberships.find(
                (membership) =>
                    membership.projectId ===
                    projectId &&
                    membership.userId === userId,
            ) ?? null
        );
    }

    async function getMembershipsByProjectId(
        projectId: string,
    ): Promise<ProjectMembership[]> {
        return memberships.filter(
            (membership) =>
                membership.projectId ===
                projectId,
        );
    }

    async function getMembershipsByUserId(
        userId: string,
    ): Promise<ProjectMembership[]> {
        return memberships.filter(
            (membership) =>
                membership.userId === userId,
        );
    }

    async function updateMembershipRole(
        projectId: string,
        userId: string,
        role: ProjectRole,
    ): Promise<ProjectMembership | null> {
        const membership =
            memberships.find(
                (candidate) =>
                    candidate.projectId ===
                    projectId &&
                    candidate.userId === userId,
            );

        if (!membership) {
            return null;
        }

        membership.role = role;
        membership.updatedAt =
            new Date().toISOString();

        return membership;
    }

    async function deleteMembership(
        projectId: string,
        userId: string,
    ): Promise<boolean> {
        const index =
            memberships.findIndex(
                (membership) =>
                    membership.projectId ===
                    projectId &&
                    membership.userId === userId,
            );

        if (index === -1) {
            return false;
        }

        memberships.splice(index, 1);

        return true;
    }

    return {
        createMembership,
        getMembership,
        getMembershipsByProjectId,
        getMembershipsByUserId,
        updateMembershipRole,
        deleteMembership,
    };
}