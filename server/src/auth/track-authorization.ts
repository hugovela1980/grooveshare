import type { IncomingMessage } from "node:http";
import type { ProjectMembershipsStore } from "../stores/project-memberships-store.js";
import type { ProjectInvitationsStore } from "../stores/project-invitations-store.js";
import type { ProjectsStore } from "../stores/projects-store.js";
import type { SessionsStore } from "../stores/sessions-store.js";
import type { TracksStore } from "../stores/tracks-store.js";
import type { UsersStore } from "../stores/users-store.js";
import type { Track } from "../types.js";
import type { User } from "./types.js";
import { authorizeProjectRequest } from "./project-authorization.js";

type AuthorizeTrackManagementRequestOptions = {
    req: IncomingMessage;
    projectId: string;
    trackId: string;
    projectsStore: ProjectsStore;
    tracksStore: TracksStore;
    usersStore: UsersStore;
    sessionsStore: SessionsStore;
    projectMembershipsStore: ProjectMembershipsStore;
    projectInvitationsStore: ProjectInvitationsStore;
};

type AuthorizedTrackManagementRequest = {
    ok: true;
    user: User;
    track: Track;
};

type TrackManagementAuthorizationFailure = {
    ok: false;
    statusCode: 401 | 403 | 404;
    error: string;
};

export type TrackManagementAuthorizationResult =
    | AuthorizedTrackManagementRequest
    | TrackManagementAuthorizationFailure;

export async function authorizeTrackManagementRequest({
    req,
    projectId,
    trackId,
    projectsStore,
    tracksStore,
    usersStore,
    sessionsStore,
    projectMembershipsStore,
    projectInvitationsStore,
}: AuthorizeTrackManagementRequestOptions): Promise<TrackManagementAuthorizationResult> {
    const projectAuthorization =
        await authorizeProjectRequest({
            req,
            projectId,
            permission: "contribute",
            projectsStore,
            usersStore,
            sessionsStore,
            projectMembershipsStore,
            projectInvitationsStore,
        });

    if (projectAuthorization.ok === false) {
        return projectAuthorization;
    }

    if (projectAuthorization.accessKind !== "member") {
        return {
            ok: false,
            statusCode: 403,
            error: "Guest access is read-only.",
        };
    }

    const track = await tracksStore.getTrackById(
        projectId,
        trackId,
    );

    if (!track) {
        return {
            ok: false,
            statusCode: 404,
            error: "Track not found.",
        };
    }

    if (
        projectAuthorization.membership.role !== "owner" &&
        track.uploadedByUserId !== projectAuthorization.user.id
    ) {
        return {
            ok: false,
            statusCode: 403,
            error: "Track access denied.",
        };
    }

    return {
        ok: true,
        user: projectAuthorization.user,
        track,
    };
}
