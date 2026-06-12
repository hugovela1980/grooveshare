import { mkdir, writeFile } from "node:fs/promises";
import type http from "node:http";
import path from "node:path";
import { createAppServer } from "../src/app.js";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import type { Database, Project } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

const TEST_DB_DIR = path.join(process.cwd(), "tests/.tmp");
const TEST_DB_FILE_PATH = path.join(TEST_DB_DIR, "api-routes-db.json");

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function resetTestDatabase(): Promise<void> {
  const emptyDatabase: Database = {
    projects: [],
    tracks: [],
  };

  await mkdir(TEST_DB_DIR, { recursive: true });

  await writeFile(
    TEST_DB_FILE_PATH,
    `${JSON.stringify(emptyDatabase, null, 2)}\n`,
    "utf-8",
  );
}

function listenOnRandomPort(server: http.Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        throw new Error("Could not determine test server address.");
      }

      resolve(`http://localhost:${address.port}`);
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function createTestServer(): Promise<{
  baseUrl: string;
  server: http.Server;
}> {
  const store = createProjectsJsonStore(TEST_DB_FILE_PATH);

  const server = createAppServer({
    projectsStore: store,
    clientOrigin: "http://localhost:5173",
  });

  const baseUrl = await listenOnRandomPort(server);

  return {
    baseUrl,
    server,
  };
}

tester.describe("project API routes", () => {
  tester.beforeEach(async () => {
    await resetTestDatabase();
  });

  tester.it("returns API health status", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(200);
      tester.expect(body.ok).toBe(true);
      tester.expect(body.data).toBe(undefined);
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns an empty project list when no projects exist", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(`${baseUrl}/api/projects`);
      const body = (await response.json()) as ApiResponse<Project[]>;

      tester.expect(response.status).toBe(200);
      tester.expect(body.ok).toBe(true);
      tester.expect(body.data).toEqual([]);
    } finally {
      await closeServer(server);
    }
  });

  tester.it("creates a project", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Chorus Riff Idea",
          description: "Guitar riff with scratch drums",
        }),
      });

      const body = (await response.json()) as ApiResponse<Project>;

      tester.expect(response.status).toBe(201);
      tester.expect(body.ok).toBe(true);
      tester.expect(typeof body.data?.id).toBe("string");
      tester.expect(body.data?.title).toBe("Chorus Riff Idea");
      tester.expect(body.data?.description).toBe("Guitar riff with scratch drums");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns a created project by ID", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const createResponse = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Verse Groove",
          description: "Clean guitar groove for verse",
        }),
      });

      const createBody = (await createResponse.json()) as ApiResponse<Project>;
      const projectId = createBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      const getResponse = await fetch(`${baseUrl}/api/projects/${projectId}`);
      const getBody = (await getResponse.json()) as ApiResponse<Project>;

      tester.expect(getResponse.status).toBe(200);
      tester.expect(getBody.ok).toBe(true);
      tester.expect(getBody.data).toEqual(createBody.data);
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 404 when a project does not exist", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(`${baseUrl}/api/projects/not-real`);
      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(404);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Project not found.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 400 when project title is missing", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "",
          description: "Missing title test",
        }),
      });

      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(400);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe(
        "Project title is required and description must be a string.",
      );
    } finally {
      await closeServer(server);
    }
  });
});