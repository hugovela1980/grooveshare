import { writeFile } from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import type { ProjectsStore } from "./stores/projects-json-store.js";
import type { TracksStore } from "./stores/tracks-json-store.js";
import type { CreateProjectInput } from "./types.js";
import { parseMultipartFormData } from "./uploads/multipart-form-data.js";
import {
  DEFAULT_UPLOAD_ROOT,
  ensureProjectUploadDir,
} from "./uploads/upload-paths.js";
import {
  DEFAULT_MAX_AUDIO_FILE_SIZE_BYTES,
  validateAudioUploadFile,
} from "./uploads/upload-validation.js";

type JsonResponse = Record<string, unknown>;

type AppOptions = {
  projectsStore: ProjectsStore;
  tracksStore: TracksStore;
  clientOrigin?: string;
  uploadRoot?: string;
  maxUploadFileSizeBytes?: number;
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

function getTracksRouteProjectId(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(/^\/api\/projects\/([^/]+)\/tracks$/);
  return match?.[1] ?? null;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function createAppServer({
  projectsStore,
  tracksStore,
  clientOrigin = "http://localhost:5173",
  uploadRoot = DEFAULT_UPLOAD_ROOT,
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

  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": clientOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
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

      const tracksRouteProjectId = getTracksRouteProjectId(req.url);

      if (req.method === "POST" && tracksRouteProjectId) {
        await handleTrackUpload(req, res, tracksRouteProjectId);
        return;
      }

      if (req.method === "GET" && tracksRouteProjectId) {
        await handleGetProjectTracks(res, tracksRouteProjectId);
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