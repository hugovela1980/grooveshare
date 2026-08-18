import type {
  IncomingMessage,
  ServerResponse,
} from "node:http";
import type { ProjectMembershipsStore } from "../stores/project-memberships-store.js";
import type {
  ProjectInvitation,
  ProjectInvitationsStore,
} from "../stores/project-invitations-store.js";
import type { SessionsStore } from "../stores/sessions-store.js";
import type { UsersStore } from "../stores/users-store.js";
import { getAuthenticatedUser } from "./authentication.js";
import {
  createProjectInvitationToken,
  getProjectInvitationToken,
  hashProjectInvitationToken,
} from "./project-invitation.js";

type JsonResponse = Record<string, unknown>;

type SendJson = (
  res: ServerResponse,
  statusCode: number,
  body: JsonResponse,
  clientOrigin: string,
) => void;

type InvitationRouteOptions = {
  res: ServerResponse;
  sendJson: SendJson;
  clientOrigin: string;
  projectInvitationsStore: ProjectInvitationsStore;
};

type OwnerInvitationRouteOptions = InvitationRouteOptions & {
  projectId: string;
  ownerUserId: string;
};

type RequestInvitationRouteOptions = InvitationRouteOptions & {
  req: IncomingMessage;
};

type AcceptInvitationRouteOptions = RequestInvitationRouteOptions & {
  usersStore: UsersStore;
  sessionsStore: SessionsStore;
  projectMembershipsStore: ProjectMembershipsStore;
};

export type ProjectInvitationStatus = {
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function toInvitationStatus(
  invitation: ProjectInvitation,
): ProjectInvitationStatus {
  return {
    active: invitation.active,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

export function getProjectInvitationRouteProjectId(
  url: string | undefined,
): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(
    /^\/api\/projects\/([^/]+)\/invitation$/,
  );

  return match?.[1] ?? null;
}

async function getInvitationFromRequest(
  req: IncomingMessage,
  projectInvitationsStore: ProjectInvitationsStore,
): Promise<ProjectInvitation | null> {
  const token = getProjectInvitationToken(req);

  if (!token) {
    return null;
  }

  return projectInvitationsStore.getActiveInvitationByTokenHash(
    hashProjectInvitationToken(token),
  );
}

export async function handleGetProjectInvitationStatus({
  res,
  projectId,
  sendJson,
  clientOrigin,
  projectInvitationsStore,
}: Omit<OwnerInvitationRouteOptions, "ownerUserId">): Promise<void> {
  const invitation =
    await projectInvitationsStore.getInvitationByProjectId(projectId);

  sendJson(
    res,
    200,
    {
      ok: true,
      data: invitation
        ? toInvitationStatus(invitation)
        : null,
    },
    clientOrigin,
  );
}

export async function handleGenerateProjectInvitation({
  res,
  projectId,
  ownerUserId,
  sendJson,
  clientOrigin,
  projectInvitationsStore,
}: OwnerInvitationRouteOptions): Promise<void> {
  const token = createProjectInvitationToken();
  const tokenHash = hashProjectInvitationToken(token);

  const invitation =
    await projectInvitationsStore.createOrReplaceInvitation({
      projectId,
      tokenHash,
      createdByUserId: ownerUserId,
    });

  res.setHeader("Cache-Control", "no-store");

  sendJson(
    res,
    201,
    {
      ok: true,
      data: {
        token,
        ...toInvitationStatus(invitation),
      },
    },
    clientOrigin,
  );
}

export async function handleDisableProjectInvitation({
  res,
  projectId,
  sendJson,
  clientOrigin,
  projectInvitationsStore,
}: Omit<OwnerInvitationRouteOptions, "ownerUserId">): Promise<void> {
  const invitation =
    await projectInvitationsStore.disableInvitation(projectId);

  if (!invitation) {
    sendJson(
      res,
      404,
      {
        ok: false,
        error: "Project invitation not found.",
      },
      clientOrigin,
    );

    return;
  }

  sendJson(
    res,
    200,
    {
      ok: true,
      data: toInvitationStatus(invitation),
    },
    clientOrigin,
  );
}

export async function handleResolveGuestInvitation({
  req,
  res,
  sendJson,
  clientOrigin,
  projectInvitationsStore,
}: RequestInvitationRouteOptions): Promise<void> {
  const invitation = await getInvitationFromRequest(
    req,
    projectInvitationsStore,
  );

  if (!invitation) {
    sendJson(
      res,
      401,
      {
        ok: false,
        error: "Invitation link is invalid or disabled.",
      },
      clientOrigin,
    );

    return;
  }

  sendJson(
    res,
    200,
    {
      ok: true,
      data: {
        projectId: invitation.projectId,
      },
    },
    clientOrigin,
  );
}

export async function handleAcceptProjectInvitation({
  req,
  res,
  sendJson,
  clientOrigin,
  projectInvitationsStore,
  usersStore,
  sessionsStore,
  projectMembershipsStore,
}: AcceptInvitationRouteOptions): Promise<void> {
  const authenticatedUser = await getAuthenticatedUser({
    req,
    usersStore,
    sessionsStore,
  });

  if (!authenticatedUser) {
    sendJson(
      res,
      401,
      {
        ok: false,
        error: "Authentication required.",
      },
      clientOrigin,
    );

    return;
  }

  const invitation = await getInvitationFromRequest(
    req,
    projectInvitationsStore,
  );

  if (!invitation) {
    sendJson(
      res,
      401,
      {
        ok: false,
        error: "Invitation link is invalid or disabled.",
      },
      clientOrigin,
    );

    return;
  }

  const existingMembership =
    await projectMembershipsStore.getMembership(
      invitation.projectId,
      authenticatedUser.id,
    );

  if (!existingMembership) {
    await projectMembershipsStore.createMembership({
      projectId: invitation.projectId,
      userId: authenticatedUser.id,
      role: "contributor",
    });
  } else if (existingMembership.role === "viewer") {
    await projectMembershipsStore.updateMembershipRole(
      invitation.projectId,
      authenticatedUser.id,
      "contributor",
    );
  }

  const membership =
    await projectMembershipsStore.getMembership(
      invitation.projectId,
      authenticatedUser.id,
    );

  if (!membership) {
    throw new Error(
      "Accepted invitation did not produce a project membership.",
    );
  }

  sendJson(
    res,
    200,
    {
      ok: true,
      data: {
        projectId: invitation.projectId,
        role: membership.role,
      },
    },
    clientOrigin,
  );
}
