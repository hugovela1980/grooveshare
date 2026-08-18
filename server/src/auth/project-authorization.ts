import type { IncomingMessage } from "node:http";
import type {
    ProjectMembership,
    ProjectMembershipsStore,
    ProjectRole,
} from "../stores/project-memberships-store.js";
import type {
    ProjectInvitation,
    ProjectInvitationsStore,
} from "../stores/project-invitations-store.js";
import type { ProjectsStore } from "../stores/projects-store.js";
import type { SessionsStore } from "../stores/sessions-store.js";
import type { UsersStore } from "../stores/users-store.js";
import type { Project } from "../types.js";
import type { User } from "./types.js";
import { getAuthenticatedUser } from "./authentication.js";
import {
    getProjectInvitationToken,
    hashProjectInvitationToken,
} from "./project-invitation.js";

export type ProjectPermission =
    | "read"
    | "contribute"
    | "manage";

const ROLE_LEVEL: Record<ProjectRole, number> = {
    viewer: 1,
    contributor: 2,
    owner: 3,
};

const PERMISSION_LEVEL: Record<ProjectPermission, number> = {
    read: 1,
    contribute: 2,
    manage: 3,
};

export function projectRoleHasPermission(
    role: ProjectRole,
    permission: ProjectPermission,
): boolean {
    return ROLE_LEVEL[role] >= PERMISSION_LEVEL[permission];
}

type AuthorizeProjectRequestOptions = {
    req: IncomingMessage;
    projectId: string;
    permission: ProjectPermission;
    projectsStore: ProjectsStore;
    usersStore: UsersStore;
    sessionsStore: SessionsStore;
    projectMembershipsStore: ProjectMembershipsStore;
    projectInvitationsStore: ProjectInvitationsStore;
};

type AuthorizedMemberProjectRequest = {
    ok: true;
    accessKind: "member";
    user: User;
    project: Project;
    membership: ProjectMembership;
};

type AuthorizedGuestProjectRequest = {
    ok: true;
    accessKind: "guest";
    project: Project;
    invitation: ProjectInvitation;
};

type ProjectAuthorizationFailure = {
    ok: false;
    statusCode: 401 | 403 | 404;
    error: string;
};

export type ProjectAuthorizationResult =
    | AuthorizedMemberProjectRequest
    | AuthorizedGuestProjectRequest
    | ProjectAuthorizationFailure;

async function getGuestInvitation(
    req: IncomingMessage,
    projectId: string,
    projectInvitationsStore: ProjectInvitationsStore,
): Promise<ProjectInvitation | null> {
    const token = getProjectInvitationToken(req);

    if (!token) {
        return null;
    }

    const invitation =
        await projectInvitationsStore.getActiveInvitationByTokenHash(
            hashProjectInvitationToken(token),
        );

    if (!invitation || invitation.projectId !== projectId) {
        return null;
    }

    return invitation;
}

export async function authorizeProjectRequest({
    req,
    projectId,
    permission,
    projectsStore,
    usersStore,
    sessionsStore,
    projectMembershipsStore,
    projectInvitationsStore,
}: AuthorizeProjectRequestOptions): Promise<ProjectAuthorizationResult> {
    const project = await projectsStore.getProjectById(projectId);

    if (!project) {
        return {
            ok: false,
            statusCode: 404,
            error: "Project not found.",
        };
    }

    const user = await getAuthenticatedUser({
        req,
        usersStore,
        sessionsStore,
    });

    if (user) {
        const membership =
            await projectMembershipsStore.getMembership(
                projectId,
                user.id,
            );

        if (
            membership &&
            projectRoleHasPermission(
                membership.role,
                permission,
            )
        ) {
            return {
                ok: true,
                accessKind: "member",
                user,
                project,
                membership,
            };
        }
    }

    const invitation = await getGuestInvitation(
        req,
        projectId,
        projectInvitationsStore,
    );

    if (invitation) {
        if (permission !== "read") {
            return {
                ok: false,
                statusCode: 403,
                error: "Guest access is read-only.",
            };
        }

        return {
            ok: true,
            accessKind: "guest",
            project,
            invitation,
        };
    }

    if (!user) {
        return {
            ok: false,
            statusCode: 401,
            error: "Authentication required.",
        };
    }

    return {
        ok: false,
        statusCode: 403,
        error: "Project access denied.",
    };
}
