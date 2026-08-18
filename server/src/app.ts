import { createReadStream } from "node:fs";
import { rm, rmdir, stat, writeFile } from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { handleDevResetRoute } from "./dev/dev-reset-route.js";
import { handleDevAuthorizationSeedRoute } from "./dev/dev-authorization-seed-route.js";
import {
  DEFAULT_SEED_PROJECT_DIR,
  handleDevSeedFilesRoute,
  handleDevSeedProjectRoute,
} from "./dev/dev-seed-routes.js";
import type { ProjectsStore } from "./stores/projects-store.js";
import type { TracksStore } from "./stores/tracks-store.js";
import type {
  CreateProjectInput,
  MixSettings,
  UpdateProjectDetailsInput,
  UpdateTrackNameInput,
} from "./types.js";
import { parseMultipartFormData } from "./uploads/multipart-form-data.js";
import {
  DEFAULT_UPLOAD_ROOT,
  ensureProjectUploadDir,
  getProjectUploadDir,
} from "./uploads/upload-paths.js";
import {
  DEFAULT_MAX_AUDIO_FILE_SIZE_BYTES,
  validateAudioUploadFile,
} from "./uploads/upload-validation.js";
import {
  handleCurrentUserRoute,
  handleLoginRoute,
  handleLogoutRoute,
  handleRegisterRoute,
} from "./auth/auth-routes.js";
import type { UsersStore } from "./stores/users-store.js";
import type { SessionsStore } from "./stores/sessions-store.js";
import type {
  ProjectMembershipsStore,
  ProjectRole,
} from "./stores/project-memberships-store.js";
import type { ProjectInvitationsStore } from "./stores/project-invitations-store.js";
import {
  getAuthenticatedUser,
} from "./auth/authentication.js";
import {
  authorizeProjectRequest,
  type ProjectPermission,
} from "./auth/project-authorization.js";
import {
  authorizeTrackManagementRequest,
} from "./auth/track-authorization.js";
import {
  getProjectMemberRouteParams,
  getProjectMembersRouteProjectId,
  handleAddProjectMember,
  handleDeleteProjectMember,
  handleListProjectMembers,
  handleUpdateProjectMember,
} from "./auth/project-membership-routes.js";
import {
  getProjectInvitationRouteProjectId,
  handleAcceptProjectInvitation,
  handleDisableProjectInvitation,
  handleGenerateProjectInvitation,
  handleGetProjectInvitationStatus,
  handleResolveGuestInvitation,
} from "./auth/project-invitation-routes.js";

type JsonResponse = Record<string, unknown>;

type AppOptions = {
  projectsStore: ProjectsStore;
  tracksStore: TracksStore;
  usersStore: UsersStore;
  clientOrigin?: string;
  uploadRoot?: string;
  seedProjectDir?: string;
  maxUploadFileSizeBytes?: number;
  sessionsStore: SessionsStore;
  projectMembershipsStore: ProjectMembershipsStore;
  projectInvitationsStore: ProjectInvitationsStore;
  resetDevelopmentData?: () => Promise<void>;
  secureCookies?: boolean;
  developmentRoutesEnabled?: boolean;
  requestLoggingEnabled?: boolean;
};

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: JsonResponse,
  clientOrigin: string,
): void {
  const json = JSON.stringify(data);

  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": clientOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range, X-GrooveShare-Invite",
    "Access-Control-Allow-Credentials": "true",
  });

  res.end(json);
}

async function readRequestBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", () => {
      reject(new Error("Could not read request body"));
    });
  });
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const body = await readRequestBuffer(req);

  return body.toString("utf-8");
}

function isCreateProjectInput(data: unknown): data is CreateProjectInput {
  if (!data || typeof data !== "object") {
    return false;
  }

  const input = data as Record<string, unknown>;

  return (
    typeof input.title === "string" &&
    input.title.trim().length > 0 &&
    typeof input.description === "string"
  );
}

function isUpdateProjectDetailsInput(
  data: unknown,
): data is UpdateProjectDetailsInput {
  if (!data || typeof data !== "object") {
    return false;
  }

  const input = data as Record<string, unknown>;
  const hasTitle = Object.hasOwn(input, "title");
  const hasDescription = Object.hasOwn(input, "description");

  if (!hasTitle && !hasDescription) {
    return false;
  }

  if (
    hasTitle &&
    (typeof input.title !== "string" || input.title.trim().length === 0)
  ) {
    return false;
  }

  if (hasDescription && typeof input.description !== "string") {
    return false;
  }

  return true;
}

function isUpdateTrackNameInput(data: unknown): data is UpdateTrackNameInput {
  if (!data || typeof data !== "object") {
    return false;
  }

  const input = data as Record<string, unknown>;

  return typeof input.name === "string" && input.name.trim().length > 0;
}

function isMixSettings(data: unknown): data is MixSettings {
  if (!data || typeof data !== "object") {
    return false;
  }

  const input = data as Record<string, unknown>;

  if (!Array.isArray(input.channels)) {
    return false;
  }

  if (input.channels.length > 4) {
    return false;
  }

  return input.channels.every((channel) => {
    if (!channel || typeof channel !== "object") {
      return false;
    }

    const channelInput = channel as Record<string, unknown>;

    return (
      typeof channelInput.channelNumber === "number" &&
      Number.isInteger(channelInput.channelNumber) &&
      channelInput.channelNumber >= 1 &&
      channelInput.channelNumber <= 4 &&
      typeof channelInput.trackId === "string" &&
      channelInput.trackId.trim().length > 0 &&
      typeof channelInput.enabled === "boolean" &&
      typeof channelInput.volume === "number" &&
      Number.isFinite(channelInput.volume) &&
      channelInput.volume >= 0 &&
      channelInput.volume <= 1
    );
  });
}

function getProjectRouteId(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(/^\/api\/projects\/([^/]+)$/);

  return match?.[1] ?? null;
}

function getMixSettingsRouteProjectId(
  url: string | undefined,
): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(
    /^\/api\/projects\/([^/]+)\/mix-settings$/,
  );

  return match?.[1] ?? null;
}

function getTracksRouteProjectId(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(/^\/api\/projects\/([^/]+)\/tracks$/);

  return match?.[1] ?? null;
}

function getTrackRouteParams(
  url: string | undefined,
): { projectId: string; trackId: string } | null {
  if (!url) {
    return null;
  }

  const match = url.match(/^\/api\/projects\/([^/]+)\/tracks\/([^/]+)$/);

  if (!match) {
    return null;
  }

  return {
    projectId: match[1],
    trackId: match[2],
  };
}

function getTrackAudioRouteParams(
  url: string | undefined,
): { projectId: string; trackId: string } | null {
  if (!url) {
    return null;
  }

  const match = url.match(
    /^\/api\/projects\/([^/]+)\/tracks\/([^/]+)\/audio$/,
  );

  if (!match) {
    return null;
  }

  return {
    projectId: match[1],
    trackId: match[2],
  };
}

type ByteRange = {
  start: number;
  end: number;
};

function parseByteRange(
  rangeHeader: string | undefined,
  fileSize: number,
): ByteRange | null {
  if (!rangeHeader) {
    return null;
  }

  const match = rangeHeader.match(
    /^bytes=(\d*)-(\d*)$/,
  );

  if (!match) {
    return null;
  }

  const startText = match[1] ?? "";
  const endText = match[2] ?? "";

  if (!startText && !endText) {
    return null;
  }

  if (!startText) {
    const suffixLength = Number(endText);

    if (
      !Number.isFinite(suffixLength) ||
      suffixLength <= 0
    ) {
      return null;
    }

    return {
      start: Math.max(
        fileSize - suffixLength,
        0,
      ),
      end: fileSize - 1,
    };
  }

  const start = Number(startText);

  if (
    !Number.isFinite(start) ||
    start < 0 ||
    start >= fileSize
  ) {
    return null;
  }

  const requestedEnd = endText
    ? Number(endText)
    : fileSize - 1;

  if (
    !Number.isFinite(requestedEnd) ||
    requestedEnd < start
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(
      requestedEnd,
      fileSize - 1,
    ),
  };
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function createAppServer({
  projectsStore,
  tracksStore,
  usersStore,
  sessionsStore,
  projectMembershipsStore,
  projectInvitationsStore,
  clientOrigin = "http://localhost:5173",
  uploadRoot = DEFAULT_UPLOAD_ROOT,
  seedProjectDir = DEFAULT_SEED_PROJECT_DIR,
  maxUploadFileSizeBytes = DEFAULT_MAX_AUDIO_FILE_SIZE_BYTES,
  resetDevelopmentData,
  secureCookies = false,
  developmentRoutesEnabled = true,
  requestLoggingEnabled = process.env.NODE_ENV !== "test",
}: AppOptions): http.Server {
  function logApiRequest(
    req: IncomingMessage,
    description: string,
  ): void {
    if (!requestLoggingEnabled) {
      return;
    }

    console.log(
      `[API] ${req.method ?? "UNKNOWN"} - ${description}`,
    );
  }

  async function requireProjectPermission(
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    permission: ProjectPermission,
  ): Promise<boolean> {
    const authorization =
      await authorizeProjectRequest({
        req,
        projectId,
        permission,
        projectsStore,
        usersStore,
        sessionsStore,
        projectMembershipsStore,
        projectInvitationsStore,
      });

    if (authorization.ok) {
      return true;
    }

    sendJson(
      res,
      authorization.statusCode,
      {
        ok: false,
        error: authorization.error,
      },
      clientOrigin,
    );

    return false;
  }

  async function handleGetProjects(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const authenticatedUser =
      await getAuthenticatedUser({
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

    const memberships =
      await projectMembershipsStore
        .getMembershipsByUserId(
          authenticatedUser.id,
        );

    const roleByProjectId = new Map<string, ProjectRole>(
      memberships.map((membership) => [
        membership.projectId,
        membership.role,
      ]),
    );

    const projects =
      await projectsStore.getProjects();

    const visibleProjects = projects.flatMap((project) => {
      const role = roleByProjectId.get(project.id);

      return role
        ? [{ ...project, role }]
        : [];
    });

    sendJson(
      res,
      200,
      {
        ok: true,
        data: visibleProjects,
      },
      clientOrigin,
    );
  }

  async function handleCreateProject(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const authenticatedUser =
      await getAuthenticatedUser({
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

    const body = await readRequestBody(req);
    const parsedBody = JSON.parse(body) as unknown;

    if (!isCreateProjectInput(parsedBody)) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error: "Project title is required and description must be a string.",
        },
        clientOrigin,
      );

      return;
    }

    const project = await projectsStore.createProject({
      title: parsedBody.title.trim(),
      description: parsedBody.description.trim(),
    });

    try {
      await projectMembershipsStore.createMembership({
        projectId: project.id,
        userId: authenticatedUser.id,
        role: "owner",
      });
    } catch (error) {
      await projectsStore.deleteProjectById(
        project.id,
      );

      throw error;
    }

    sendJson(
      res,
      201,
      {
        ok: true,
        data: {
          ...project,
          role: "owner",
        },
      },
      clientOrigin,
    );
  }

  async function handleUpdateProjectDetails(
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
  ): Promise<void> {
    const body = await readRequestBody(req);

    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(body) as unknown;
    } catch {
      sendJson(
        res,
        400,
        {
          ok: false,
          error: "Invalid project details.",
        },
        clientOrigin,
      );

      return;
    }

    if (!isUpdateProjectDetailsInput(parsedBody)) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error: "Invalid project details.",
        },
        clientOrigin,
      );

      return;
    }

    const projectInput: UpdateProjectDetailsInput = {
      ...(parsedBody.title !== undefined
        ? { title: parsedBody.title.trim() }
        : {}),
      ...(parsedBody.description !== undefined
        ? { description: parsedBody.description.trim() }
        : {}),
    };

    const project = await projectsStore.updateProjectDetails(
      projectId,
      projectInput,
    );

    if (!project) {
      sendJson(
        res,
        404,
        {
          ok: false,
          error: "Project not found.",
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
        data: project,
      },
      clientOrigin,
    );
  }

  async function handleUpdateProjectMixSettings(
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
  ): Promise<void> {
    const body = await readRequestBody(req);

    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(body) as unknown;
    } catch {
      sendJson(
        res,
        400,
        {
          ok: false,
          error: "Invalid mix settings.",
        },
        clientOrigin,
      );

      return;
    }

    if (!isMixSettings(parsedBody)) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error: "Invalid mix settings.",
        },
        clientOrigin,
      );

      return;
    }

    const project =
      await projectsStore.updateProjectMixSettings(
        projectId,
        parsedBody,
      );

    if (!project) {
      sendJson(
        res,
        404,
        {
          ok: false,
          error: "Project not found.",
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
        data: project,
      },
      clientOrigin,
    );
  }

  async function handleTrackUpload(
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    uploadedByUserId: string,
  ): Promise<void> {
    const project = await projectsStore.getProjectById(projectId);

    if (!project) {
      sendJson(
        res,
        404,
        {
          ok: false,
          error: "Project not found.",
        },
        clientOrigin,
      );

      return;
    }

    const body = await readRequestBuffer(req);

    const parsedForm = parseMultipartFormData({
      contentType: req.headers["content-type"],
      body,
    });

    const audioFile = parsedForm.files.find((file) => {
      return file.fieldName === "audioFile";
    });

    if (!audioFile) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error: "Audio file is required.",
        },
        clientOrigin,
      );

      return;
    }

    const audioFileValidation = validateAudioUploadFile(audioFile, {
      maxFileSizeBytes: maxUploadFileSizeBytes,
    });

    if (!audioFileValidation.ok) {
      sendJson(
        res,
        audioFileValidation.statusCode,
        {
          ok: false,
          error: audioFileValidation.error,
        },
        clientOrigin,
      );

      return;
    }

    const trackName = parsedForm.fields.trackName?.trim() || audioFile.filename;

    const uploadDir = await ensureProjectUploadDir({
      uploadRoot,
      projectId,
    });

    const safeFilename = sanitizeFilename(audioFile.filename);
    const storedFilename = `${crypto.randomUUID()}-${safeFilename}`;
    const absoluteFilePath = path.join(uploadDir, storedFilename);

    await writeFile(absoluteFilePath, audioFile.data);

    const track = await tracksStore.createTrack({
      projectId,
      name: trackName,
      originalFilename: audioFile.filename,
      filePath: absoluteFilePath,
      mimeType: audioFileValidation.mimeType,
      fileSize: audioFile.size,
      uploadedByUserId,
    });

    sendJson(
      res,
      201,
      {
        ok: true,
        data: track,
      },
      clientOrigin,
    );
  }

  async function handleGetProjectTracks(
    res: ServerResponse,
    projectId: string,
  ): Promise<void> {
    const project = await projectsStore.getProjectById(projectId);

    if (!project) {
      sendJson(
        res,
        404,
        {
          ok: false,
          error: "Project not found.",
        },
        clientOrigin,
      );

      return;
    }

    const tracks = await tracksStore.getTracksByProjectId(projectId);

    sendJson(
      res,
      200,
      {
        ok: true,
        data: tracks,
      },
      clientOrigin,
    );
  }

  async function handleGetTrackAudio(
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    trackId: string,
  ): Promise<void> {
    const project = await projectsStore.getProjectById(projectId);

    if (!project) {
      sendJson(
        res,
        404,
        {
          ok: false,
          error: "Project not found.",
        },
        clientOrigin,
      );

      return;
    }

    const track = await tracksStore.getTrackById(projectId, trackId);

    if (!track) {
      sendJson(
        res,
        404,
        {
          ok: false,
          error: "Track not found.",
        },
        clientOrigin,
      );

      return;
    }

    const absoluteFilePath = path.isAbsolute(track.filePath)
      ? track.filePath
      : path.resolve(process.cwd(), track.filePath);

    const fileStats = await stat(absoluteFilePath);
    const fileSize = fileStats.size;

    const byteRange = parseByteRange(
      req.headers.range,
      fileSize,
    );

    if (byteRange) {
      const { start, end } = byteRange;

      const contentLength = end - start + 1;

      res.writeHead(206, {
        "Content-Type": track.mimeType,
        "Content-Length": contentLength,
        "Content-Range":
          `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin":
          clientOrigin,
        "Access-Control-Allow-Credentials":
          "true",
      });

      createReadStream(absoluteFilePath, {
        start,
        end,
      }).pipe(res);

      return;
    }

    res.writeHead(200, {
      "Content-Type": track.mimeType,
      "Content-Length": fileSize,
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin":
        clientOrigin,
      "Access-Control-Allow-Credentials":
        "true",
    });

    createReadStream(absoluteFilePath).pipe(res);
  }

  async function deleteUploadedTrackFile(filePath: string): Promise<void> {
    const absoluteFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    await rm(absoluteFilePath, {
      force: true,
    });
  }

  async function deleteProjectUploadDirIfEmpty(projectId: string): Promise<void> {
    const projectUploadDir = getProjectUploadDir({
      uploadRoot,
      projectId,
    });

    try {
      await rmdir(projectUploadDir);
    } catch (error) {
      const fileSystemError = error as NodeJS.ErrnoException;

      if (
        fileSystemError.code === "ENOENT" ||
        fileSystemError.code === "ENOTEMPTY"
      ) {
        return;
      }

      throw error;
    }
  }

  async function handleUpdateTrackName(
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    trackId: string,
  ): Promise<void> {
    const body = await readRequestBody(req);

    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(body) as unknown;
    } catch {
      sendJson(
        res,
        400,
        {
          ok: false,
          error: "Invalid track name.",
        },
        clientOrigin,
      );

      return;
    }

    if (!isUpdateTrackNameInput(parsedBody)) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error: "Invalid track name.",
        },
        clientOrigin,
      );

      return;
    }

    const result = await tracksStore.updateTrackName(
      projectId,
      trackId,
      {
        name: parsedBody.name.trim(),
      },
    );

    if (!result.ok) {
      const error =
        result.reason === "project-not-found"
          ? "Project not found."
          : "Track not found.";

      sendJson(
        res,
        404,
        {
          ok: false,
          error,
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
        data: result.updatedTrack,
      },
      clientOrigin,
    );
  }

  async function handleDeleteTrack(
    res: ServerResponse,
    projectId: string,
    trackId: string,
  ): Promise<void> {
    const result = await tracksStore.deleteTrackById(projectId, trackId);

    if (!result.ok) {
      if (result.reason === "project-not-found") {
        sendJson(
          res,
          404,
          {
            ok: false,
            error: "Project not found.",
          },
          clientOrigin,
        );

        return;
      }

      sendJson(
        res,
        404,
        {
          ok: false,
          error: "Track not found.",
        },
        clientOrigin,
      );

      return;
    }

    await deleteUploadedTrackFile(result.deletedTrack.filePath);
    await deleteProjectUploadDirIfEmpty(projectId);

    sendJson(
      res,
      200,
      {
        ok: true,
        data: result.deletedTrack,
      },
      clientOrigin,
    );
  }

  async function handleDeleteProject(
    res: ServerResponse,
    projectId: string,
  ): Promise<void> {
    const result = await projectsStore.deleteProjectById(projectId);

    if (!result.ok) {
      sendJson(
        res,
        404,
        {
          ok: false,
          error: "Project not found.",
        },
        clientOrigin,
      );

      return;
    }

    await Promise.all(
      result.deletedTracks.map((track) => {
        return deleteUploadedTrackFile(track.filePath);
      }),
    );

    const projectUploadDir = getProjectUploadDir({
      uploadRoot,
      projectId,
    });

    await rm(projectUploadDir, {
      recursive: true,
      force: true,
    });

    sendJson(
      res,
      200,
      {
        ok: true,
        data: result.deletedProject,
      },
      clientOrigin,
    );
  }

  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      if (req.method === "OPTIONS") {
        logApiRequest(req, "CORS preflight request");
        res.writeHead(204, {
          "Access-Control-Allow-Origin": clientOrigin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Range, X-GrooveShare-Invite",
          "Access-Control-Allow-Credentials": "true",
        });

        res.end();
        return;
      }

      if (req.method === "GET" && req.url === "/api/health") {
        logApiRequest(req, "Check API health");
        sendJson(
          res,
          200,
          {
            ok: true,
            app: "GrooveShare API",
            message: "Server is healthy",
          },
          clientOrigin,
        );

        return;
      }

      if (
        req.method === "POST" &&
        req.url === "/api/auth/register"
      ) {
        logApiRequest(req, "Register user account");
        await handleRegisterRoute({
          req,
          res,
          sendJson,
          clientOrigin,
          usersStore,
        });

        return;
      }

      if (
        req.method === "POST" &&
        req.url === "/api/auth/login"
      ) {
        logApiRequest(req, "Log in user");
        await handleLoginRoute({
          req,
          res,
          sendJson,
          clientOrigin,
          usersStore,
          sessionsStore,
          secureCookie: secureCookies,
        });

        return;
      }

      if (
        req.method === "POST" &&
        req.url === "/api/auth/logout"
      ) {
        logApiRequest(req, "Log out user");
        await handleLogoutRoute({
          req,
          res,
          sendJson,
          clientOrigin,
          usersStore,
          sessionsStore,
          secureCookie: secureCookies,
        });

        return;
      }

      if (
        req.method === "GET" &&
        req.url === "/api/auth/me"
      ) {
        logApiRequest(req, "Load current user session");
        await handleCurrentUserRoute({
          req,
          res,
          sendJson,
          clientOrigin,
          usersStore,
          sessionsStore,
        });

        return;
      }

      if (
        req.method === "GET" &&
        req.url === "/api/invitations/guest"
      ) {
        logApiRequest(req, "Resolve guest project invitation");
        await handleResolveGuestInvitation({
          req,
          res,
          sendJson,
          clientOrigin,
          projectInvitationsStore,
        });
        return;
      }

      if (
        req.method === "POST" &&
        req.url === "/api/invitations/accept"
      ) {
        logApiRequest(req, "Accept project invitation");
        await handleAcceptProjectInvitation({
          req,
          res,
          sendJson,
          clientOrigin,
          projectInvitationsStore,
          usersStore,
          sessionsStore,
          projectMembershipsStore,
        });
        return;
      }

      // ============================================= //
      // ============================================= //
      // ============================================= //
      // Development seed routes //
      // ============================================= //
      // ============================================= //
      // ============================================= //
      if (
        developmentRoutesEnabled &&
        req.method === "GET" &&
        req.url === "/api/dev/seed-files"
      ) {
        logApiRequest(req, "List development seed audio files");
        await handleDevSeedFilesRoute({
          res,
          sendJson,
          clientOrigin,
          seedProjectDir,
        });

        return;
      }

      if (
        developmentRoutesEnabled &&
        req.method === "POST" &&
        req.url === "/api/dev/seed-project"
      ) {
        logApiRequest(req, "Create development seed project");
        await handleDevSeedProjectRoute({
          req,
          res,
          sendJson,
          clientOrigin,
          projectsStore,
          tracksStore,
          uploadRoot,
          seedProjectDir,
        });

        return;
      }

      if (
        developmentRoutesEnabled &&
        req.method === "POST" &&
        req.url === "/api/dev/seed-authorization"
      ) {
        logApiRequest(req, "Seed development authorization data");
        await handleDevAuthorizationSeedRoute({
          req,
          res,
          sendJson,
          clientOrigin,
          projectsStore,
          tracksStore,
          usersStore,
          projectMembershipsStore,
          uploadRoot,
          seedProjectDir,
        });

        return;
      }
      // ============================================= //
      // ============================================= //
      // ============================================= //
      // Development seed routes //
      // ============================================= //
      // ============================================= //
      // ============================================= //

      if (req.method === "GET" && req.url === "/api/projects") {
        logApiRequest(req, "List accessible projects");
        await handleGetProjects(req, res);
        return;
      }

      if (req.method === "POST" && req.url === "/api/projects") {
        logApiRequest(req, "Create project");
        await handleCreateProject(req, res);
        return;
      }

      const projectInvitationRouteProjectId =
        getProjectInvitationRouteProjectId(req.url);

      if (req.method === "GET" && projectInvitationRouteProjectId) {
        logApiRequest(req, "Load project invitation status");
        if (
          !await requireProjectPermission(
            req,
            res,
            projectInvitationRouteProjectId,
            "manage",
          )
        ) {
          return;
        }

        await handleGetProjectInvitationStatus({
          res,
          projectId: projectInvitationRouteProjectId,
          sendJson,
          clientOrigin,
          projectInvitationsStore,
        });
        return;
      }

      if (req.method === "POST" && projectInvitationRouteProjectId) {
        logApiRequest(req, "Generate or regenerate project invitation");
        const authorization = await authorizeProjectRequest({
          req,
          projectId: projectInvitationRouteProjectId,
          permission: "manage",
          projectsStore,
          usersStore,
          sessionsStore,
          projectMembershipsStore,
          projectInvitationsStore,
        });

        if (authorization.ok === false) {
          sendJson(
            res,
            authorization.statusCode,
            {
              ok: false,
              error: authorization.error,
            },
            clientOrigin,
          );
          return;
        }

        if (authorization.accessKind !== "member") {
          sendJson(
            res,
            403,
            {
              ok: false,
              error: "Project access denied.",
            },
            clientOrigin,
          );
          return;
        }

        await handleGenerateProjectInvitation({
          res,
          projectId: projectInvitationRouteProjectId,
          ownerUserId: authorization.user.id,
          sendJson,
          clientOrigin,
          projectInvitationsStore,
        });
        return;
      }

      if (req.method === "DELETE" && projectInvitationRouteProjectId) {
        logApiRequest(req, "Disable project invitation");
        if (
          !await requireProjectPermission(
            req,
            res,
            projectInvitationRouteProjectId,
            "manage",
          )
        ) {
          return;
        }

        await handleDisableProjectInvitation({
          res,
          projectId: projectInvitationRouteProjectId,
          sendJson,
          clientOrigin,
          projectInvitationsStore,
        });
        return;
      }

      const projectMemberRouteParams =
        getProjectMemberRouteParams(req.url);

      if (req.method === "PUT" && projectMemberRouteParams) {
        logApiRequest(req, "Update project member role");
        if (
          !await requireProjectPermission(
            req,
            res,
            projectMemberRouteParams.projectId,
            "manage",
          )
        ) {
          return;
        }

        await handleUpdateProjectMember({
          req,
          res,
          projectId: projectMemberRouteParams.projectId,
          userId: projectMemberRouteParams.userId,
          sendJson,
          clientOrigin,
          usersStore,
          projectMembershipsStore,
        });

        return;
      }

      if (req.method === "DELETE" && projectMemberRouteParams) {
        logApiRequest(req, "Remove project member");
        if (
          !await requireProjectPermission(
            req,
            res,
            projectMemberRouteParams.projectId,
            "manage",
          )
        ) {
          return;
        }

        await handleDeleteProjectMember({
          res,
          projectId: projectMemberRouteParams.projectId,
          userId: projectMemberRouteParams.userId,
          sendJson,
          clientOrigin,
          usersStore,
          projectMembershipsStore,
        });

        return;
      }

      const projectMembersRouteProjectId =
        getProjectMembersRouteProjectId(req.url);

      if (req.method === "GET" && projectMembersRouteProjectId) {
        logApiRequest(req, "List project members");
        if (
          !await requireProjectPermission(
            req,
            res,
            projectMembersRouteProjectId,
            "manage",
          )
        ) {
          return;
        }

        await handleListProjectMembers({
          res,
          projectId: projectMembersRouteProjectId,
          sendJson,
          clientOrigin,
          usersStore,
          projectMembershipsStore,
        });

        return;
      }

      if (req.method === "POST" && projectMembersRouteProjectId) {
        logApiRequest(req, "Add project member");
        if (
          !await requireProjectPermission(
            req,
            res,
            projectMembersRouteProjectId,
            "manage",
          )
        ) {
          return;
        }

        await handleAddProjectMember({
          req,
          res,
          projectId: projectMembersRouteProjectId,
          sendJson,
          clientOrigin,
          usersStore,
          projectMembershipsStore,
        });

        return;
      }

      const mixSettingsRouteProjectId =
        getMixSettingsRouteProjectId(req.url);

      if (req.method === "PUT" && mixSettingsRouteProjectId) {
        logApiRequest(req, "Update project mix settings");
        if (
          !await requireProjectPermission(
            req,
            res,
            mixSettingsRouteProjectId,
            "contribute",
          )
        ) {
          return;
        }

        await handleUpdateProjectMixSettings(
          req,
          res,
          mixSettingsRouteProjectId,
        );

        return;
      }

      const projectRouteId = getProjectRouteId(req.url);

      if (req.method === "GET" && projectRouteId) {
        logApiRequest(req, "Load project details");
        const authorization =
          await authorizeProjectRequest({
            req,
            projectId: projectRouteId,
            permission: "read",
            projectsStore,
            usersStore,
            sessionsStore,
            projectMembershipsStore,
            projectInvitationsStore,
          });

        if (authorization.ok === false) {
          sendJson(
            res,
            authorization.statusCode,
            {
              ok: false,
              error: authorization.error,
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
            data: authorization.accessKind === "member"
              ? {
                  ...authorization.project,
                  role: authorization.membership.role,
                }
              : {
                  ...authorization.project,
                  access: "guest",
                  role: null,
                },
          },
          clientOrigin,
        );

        return;
      }

      if (req.method === "PUT" && projectRouteId) {
        logApiRequest(req, "Update project details");
        if (
          !await requireProjectPermission(
            req,
            res,
            projectRouteId,
            "manage",
          )
        ) {
          return;
        }

        await handleUpdateProjectDetails(req, res, projectRouteId);
        return;
      }

      if (req.method === "DELETE" && projectRouteId) {
        logApiRequest(req, "Delete project");
        if (
          !await requireProjectPermission(
            req,
            res,
            projectRouteId,
            "manage",
          )
        ) {
          return;
        }

        await handleDeleteProject(res, projectRouteId);
        return;
      }

      const trackAudioRouteParams = getTrackAudioRouteParams(req.url);

      if (req.method === "GET" && trackAudioRouteParams) {
        logApiRequest(req, "Stream track audio");
        if (
          !await requireProjectPermission(
            req,
            res,
            trackAudioRouteParams.projectId,
            "read",
          )
        ) {
          return;
        }

        await handleGetTrackAudio(
          req,
          res,
          trackAudioRouteParams.projectId,
          trackAudioRouteParams.trackId,
        );

        return;
      }

      const tracksRouteProjectId = getTracksRouteProjectId(req.url);

      if (req.method === "POST" && tracksRouteProjectId) {
        logApiRequest(req, "Upload project track");
        const authorization =
          await authorizeProjectRequest({
            req,
            projectId: tracksRouteProjectId,
            permission: "contribute",
            projectsStore,
            usersStore,
            sessionsStore,
            projectMembershipsStore,
            projectInvitationsStore,
          });

        if (authorization.ok === false) {
          sendJson(
            res,
            authorization.statusCode,
            {
              ok: false,
              error: authorization.error,
            },
            clientOrigin,
          );

          return;
        }

        if (authorization.accessKind !== "member") {
          sendJson(
            res,
            403,
            {
              ok: false,
              error: "Guest access is read-only.",
            },
            clientOrigin,
          );
          return;
        }

        await handleTrackUpload(
          req,
          res,
          tracksRouteProjectId,
          authorization.user.id,
        );
        return;
      }

      if (req.method === "GET" && tracksRouteProjectId) {
        logApiRequest(req, "List project tracks");
        if (
          !await requireProjectPermission(
            req,
            res,
            tracksRouteProjectId,
            "read",
          )
        ) {
          return;
        }

        await handleGetProjectTracks(res, tracksRouteProjectId);
        return;
      }

      const trackRouteParams = getTrackRouteParams(req.url);

      if (req.method === "PUT" && trackRouteParams) {
        logApiRequest(req, "Update track details");
        const authorization =
          await authorizeTrackManagementRequest({
            req,
            projectId: trackRouteParams.projectId,
            trackId: trackRouteParams.trackId,
            projectsStore,
            tracksStore,
            usersStore,
            sessionsStore,
            projectMembershipsStore,
            projectInvitationsStore,
          });

        if (authorization.ok === false) {
          sendJson(
            res,
            authorization.statusCode,
            {
              ok: false,
              error: authorization.error,
            },
            clientOrigin,
          );

          return;
        }

        await handleUpdateTrackName(
          req,
          res,
          trackRouteParams.projectId,
          trackRouteParams.trackId,
        );

        return;
      }

      if (req.method === "DELETE" && trackRouteParams) {
        logApiRequest(req, "Delete track");
        const authorization =
          await authorizeTrackManagementRequest({
            req,
            projectId: trackRouteParams.projectId,
            trackId: trackRouteParams.trackId,
            projectsStore,
            tracksStore,
            usersStore,
            sessionsStore,
            projectMembershipsStore,
            projectInvitationsStore,
          });

        if (authorization.ok === false) {
          sendJson(
            res,
            authorization.statusCode,
            {
              ok: false,
              error: authorization.error,
            },
            clientOrigin,
          );

          return;
        }

        await handleDeleteTrack(
          res,
          trackRouteParams.projectId,
          trackRouteParams.trackId,
        );

        return;
      }

      if (
        developmentRoutesEnabled &&
        req.method === "DELETE" &&
        req.url === "/api/dev/reset"
      ) {
        logApiRequest(req, "Reset development data");
        await handleDevResetRoute({
          res,
          sendJson,
          clientOrigin,
          uploadRoot,
          projectsStore,
          resetDevelopmentData,
        });

        return;
      }

      if (req.url?.startsWith("/api/")) {
        logApiRequest(req, "Unmatched API request");
      }

      sendJson(
        res,
        404,
        {
          ok: false,
          error: "Not found",
        },
        clientOrigin,
      );
    } catch (error) {
      console.error(error);

      sendJson(
        res,
        500,
        {
          ok: false,
          error: "Internal server error",
        },
        clientOrigin,
      );
    }
  }

  return http.createServer((req, res) => {
    void handleRequest(req, res);
  });
}