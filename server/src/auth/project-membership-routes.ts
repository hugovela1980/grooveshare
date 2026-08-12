import type {
  IncomingMessage,
  ServerResponse,
} from "node:http";
import type { User } from "./types.js";
import { toPublicUser } from "./user.js";
import type {
  ProjectMembership,
  ProjectMembershipsStore,
  ProjectRole,
} from "../stores/project-memberships-store.js";
import type { UsersStore } from "../stores/users-store.js";

type JsonResponse = Record<string, unknown>;

type SendJson = (
  res: ServerResponse,
  statusCode: number,
  body: JsonResponse,
  clientOrigin: string,
) => void;

export type ProjectMember = {
  user: User;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
};

type ProjectMembersRouteOptions = {
  res: ServerResponse;
  projectId: string;
  sendJson: SendJson;
  clientOrigin: string;
  usersStore: UsersStore;
  projectMembershipsStore: ProjectMembershipsStore;
};

type ProjectMembersRequestRouteOptions =
  ProjectMembersRouteOptions & {
    req: IncomingMessage;
  };

type ProjectMemberRouteOptions =
  ProjectMembersRequestRouteOptions & {
    userId: string;
  };

type AddProjectMemberInput = {
  email: string;
  role: "viewer" | "contributor";
};

type UpdateProjectMemberInput = {
  role: "viewer" | "contributor";
};

function isAssignableRole(
  role: unknown,
): role is "viewer" | "contributor" {
  return role === "viewer" || role === "contributor";
}

function isAddProjectMemberInput(
  data: unknown,
): data is AddProjectMemberInput {
  if (!data || typeof data !== "object") {
    return false;
  }

  const input = data as Record<string, unknown>;

  return (
    typeof input.email === "string" &&
    input.email.trim().length > 0 &&
    isAssignableRole(input.role)
  );
}

function isUpdateProjectMemberInput(
  data: unknown,
): data is UpdateProjectMemberInput {
  if (!data || typeof data !== "object") {
    return false;
  }

  const input = data as Record<string, unknown>;

  return isAssignableRole(input.role);
}

async function readRequestBody(
  req: IncomingMessage,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(
        Buffer.concat(chunks).toString("utf-8"),
      );
    });

    req.on("error", () => {
      reject(
        new Error(
          "Could not read request body.",
        ),
      );
    });
  });
}

async function readJsonBody(
  req: IncomingMessage,
): Promise<unknown | null> {
  const body = await readRequestBody(req);

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

async function toProjectMember(
  membership: ProjectMembership,
  usersStore: UsersStore,
): Promise<ProjectMember> {
  const storedUser =
    await usersStore.getUserById(
      membership.userId,
    );

  if (!storedUser) {
    throw new Error(
      "Project membership references a missing user.",
    );
  }

  return {
    user: toPublicUser(storedUser),
    role: membership.role,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
}

export function getProjectMembersRouteProjectId(
  url: string | undefined,
): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(
    /^\/api\/projects\/([^/]+)\/members$/,
  );

  return match?.[1] ?? null;
}

export function getProjectMemberRouteParams(
  url: string | undefined,
): { projectId: string; userId: string } | null {
  if (!url) {
    return null;
  }

  const match = url.match(
    /^\/api\/projects\/([^/]+)\/members\/([^/]+)$/,
  );

  if (!match) {
    return null;
  }

  return {
    projectId: match[1],
    userId: match[2],
  };
}

export async function handleListProjectMembers({
  res,
  projectId,
  sendJson,
  clientOrigin,
  usersStore,
  projectMembershipsStore,
}: ProjectMembersRouteOptions): Promise<void> {
  const memberships =
    await projectMembershipsStore
      .getMembershipsByProjectId(projectId);

  const members = await Promise.all(
    memberships.map((membership) => {
      return toProjectMember(
        membership,
        usersStore,
      );
    }),
  );

  sendJson(
    res,
    200,
    {
      ok: true,
      data: members,
    },
    clientOrigin,
  );
}

export async function handleAddProjectMember({
  req,
  res,
  projectId,
  sendJson,
  clientOrigin,
  usersStore,
  projectMembershipsStore,
}: ProjectMembersRequestRouteOptions): Promise<void> {
  const parsedBody = await readJsonBody(req);

  if (!isAddProjectMemberInput(parsedBody)) {
    sendJson(
      res,
      400,
      {
        ok: false,
        error:
          "Member email and role of viewer or contributor are required.",
      },
      clientOrigin,
    );

    return;
  }

  const storedUser =
    await usersStore.getUserByEmail(
      parsedBody.email,
    );

  if (!storedUser) {
    sendJson(
      res,
      404,
      {
        ok: false,
        error: "User not found.",
      },
      clientOrigin,
    );

    return;
  }

  const existingMembership =
    await projectMembershipsStore
      .getMembership(
        projectId,
        storedUser.id,
      );

  if (existingMembership) {
    sendJson(
      res,
      409,
      {
        ok: false,
        error:
          "User is already a project member.",
      },
      clientOrigin,
    );

    return;
  }

  const membership =
    await projectMembershipsStore
      .createMembership({
        projectId,
        userId: storedUser.id,
        role: parsedBody.role,
      });

  sendJson(
    res,
    201,
    {
      ok: true,
      data: {
        user: toPublicUser(storedUser),
        role: membership.role,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      },
    },
    clientOrigin,
  );
}

export async function handleUpdateProjectMember({
  req,
  res,
  projectId,
  userId,
  sendJson,
  clientOrigin,
  usersStore,
  projectMembershipsStore,
}: ProjectMemberRouteOptions): Promise<void> {
  const parsedBody = await readJsonBody(req);

  if (!isUpdateProjectMemberInput(parsedBody)) {
    sendJson(
      res,
      400,
      {
        ok: false,
        error:
          "Member role must be viewer or contributor.",
      },
      clientOrigin,
    );

    return;
  }

  const membership =
    await projectMembershipsStore
      .getMembership(projectId, userId);

  if (!membership) {
    sendJson(
      res,
      404,
      {
        ok: false,
        error: "Project member not found.",
      },
      clientOrigin,
    );

    return;
  }

  if (membership.role === "owner") {
    sendJson(
      res,
      409,
      {
        ok: false,
        error:
          "Project owner role cannot be changed here.",
      },
      clientOrigin,
    );

    return;
  }

  const updatedMembership =
    await projectMembershipsStore
      .updateMembershipRole(
        projectId,
        userId,
        parsedBody.role,
      );

  if (!updatedMembership) {
    sendJson(
      res,
      404,
      {
        ok: false,
        error: "Project member not found.",
      },
      clientOrigin,
    );

    return;
  }

  const member = await toProjectMember(
    updatedMembership,
    usersStore,
  );

  sendJson(
    res,
    200,
    {
      ok: true,
      data: member,
    },
    clientOrigin,
  );
}

export async function handleDeleteProjectMember({
  res,
  projectId,
  userId,
  sendJson,
  clientOrigin,
  usersStore,
  projectMembershipsStore,
}: Omit<ProjectMemberRouteOptions, "req">): Promise<void> {
  const membership =
    await projectMembershipsStore
      .getMembership(projectId, userId);

  if (!membership) {
    sendJson(
      res,
      404,
      {
        ok: false,
        error: "Project member not found.",
      },
      clientOrigin,
    );

    return;
  }

  if (membership.role === "owner") {
    sendJson(
      res,
      409,
      {
        ok: false,
        error:
          "Project owner cannot be removed.",
      },
      clientOrigin,
    );

    return;
  }

  const member = await toProjectMember(
    membership,
    usersStore,
  );

  const deleted =
    await projectMembershipsStore
      .deleteMembership(projectId, userId);

  if (!deleted) {
    sendJson(
      res,
      404,
      {
        ok: false,
        error: "Project member not found.",
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
      data: member,
    },
    clientOrigin,
  );
}
