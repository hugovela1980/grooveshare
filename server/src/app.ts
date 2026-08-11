import { createReadStream } from "node:fs";
import { rm, rmdir, stat, writeFile } from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { handleDevResetRoute } from "./dev/dev-reset-route.js";
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
  handleLoginRoute,
  handleLogoutRoute,
  handleRegisterRoute,
} from "./auth/auth-routes.js";
import type { UsersStore } from "./stores/users-store.js";
import type { SessionsStore } from "./stores/sessions-store.js";

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
    "Access-Control-Allow-Headers": "Content-Type",
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
  clientOrigin = "http://localhost:5173",
  uploadRoot = DEFAULT_UPLOAD_ROOT,
  seedProjectDir = DEFAULT_SEED_PROJECT_DIR,
  maxUploadFileSizeBytes = DEFAULT_MAX_AUDIO_FILE_SIZE_BYTES,
}: AppOptions): http.Server {
  async function handleCreateProject(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
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

    sendJson(
      res,
      201,
      {
        ok: true,
        data: project,
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

    const relativeFilePath = path.relative(process.cwd(), absoluteFilePath);

    const track = await tracksStore.createTrack({
      projectId,
      name: trackName,
      originalFilename: audioFile.filename,
      filePath: relativeFilePath,
      mimeType: audioFile.mimeType,
      fileSize: audioFile.size,
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
        res.writeHead(204, {
          "Access-Control-Allow-Origin": clientOrigin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Credentials": "true",
        });

        res.end();
        return;
      }

      if (req.method === "GET" && req.url === "/api/health") {
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
        await handleLoginRoute({
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
        req.method === "POST" &&
        req.url === "/api/auth/logout"
      ) {
        await handleLogoutRoute({
          req,
          res,
          sendJson,
          clientOrigin,
          usersStore,
          sessionsStore,
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
      if (req.method === "GET" && req.url === "/api/dev/seed-files") {
        await handleDevSeedFilesRoute({
          res,
          sendJson,
          clientOrigin,
          seedProjectDir,
        });

        return;
      }

      if (req.method === "POST" && req.url === "/api/dev/seed-project") {
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
      // ============================================= //
      // ============================================= //
      // ============================================= //
      // Development seed routes //
      // ============================================= //
      // ============================================= //
      // ============================================= //

      if (req.method === "GET" && req.url === "/api/projects") {
        const projects = await projectsStore.getProjects();

        sendJson(
          res,
          200,
          {
            ok: true,
            data: projects,
          },
          clientOrigin,
        );

        return;
      }

      if (req.method === "POST" && req.url === "/api/projects") {
        await handleCreateProject(req, res);
        return;
      }

      const mixSettingsRouteProjectId =
        getMixSettingsRouteProjectId(req.url);

      if (req.method === "PUT" && mixSettingsRouteProjectId) {
        await handleUpdateProjectMixSettings(
          req,
          res,
          mixSettingsRouteProjectId,
        );

        return;
      }

      const projectRouteId = getProjectRouteId(req.url);

      if (req.method === "PUT" && projectRouteId) {
        await handleUpdateProjectDetails(req, res, projectRouteId);
        return;
      }

      if (req.method === "DELETE" && projectRouteId) {
        await handleDeleteProject(res, projectRouteId);
        return;
      }

      const trackAudioRouteParams = getTrackAudioRouteParams(req.url);

      if (req.method === "GET" && trackAudioRouteParams) {
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
        await handleTrackUpload(req, res, tracksRouteProjectId);
        return;
      }

      if (req.method === "GET" && tracksRouteProjectId) {
        await handleGetProjectTracks(res, tracksRouteProjectId);
        return;
      }

      const trackRouteParams = getTrackRouteParams(req.url);

      if (req.method === "PUT" && trackRouteParams) {
        await handleUpdateTrackName(
          req,
          res,
          trackRouteParams.projectId,
          trackRouteParams.trackId,
        );

        return;
      }

      if (req.method === "DELETE" && trackRouteParams) {
        await handleDeleteTrack(
          res,
          trackRouteParams.projectId,
          trackRouteParams.trackId,
        );

        return;
      }

      if (req.method === "DELETE" && req.url === "/api/dev/reset") {
        await handleDevResetRoute({
          res,
          sendJson,
          clientOrigin,
          uploadRoot,
          projectsStore,
        });

        return;
      }

      if (req.method === "GET" && req.url?.startsWith("/api/projects/")) {
        const projectId = req.url.replace("/api/projects/", "");
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

        sendJson(
          res,
          200,
          {
            ok: true,
            data: project,
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