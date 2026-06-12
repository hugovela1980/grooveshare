import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { ProjectsStore } from "./stores/projects-json-store.js";
import type { CreateProjectInput } from "./types.js";

type JsonResponse = Record<string, unknown>;

type AppOptions = {
  projectsStore: ProjectsStore;
  clientOrigin?: string;
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

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      resolve(body);
    });

    req.on("error", () => {
      reject(new Error("Could not read request body"));
    });
  });
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

export function createAppServer({
  projectsStore,
  clientOrigin = "http://localhost:5173",
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