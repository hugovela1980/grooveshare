import { mkdir, rm, writeFile } from "node:fs/promises";
import type http from "node:http";
import path from "node:path";
import { createAppServer } from "../src/app.js";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type { Database, Project, Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

const TEST_DB_DIR = path.join(process.cwd(), "tests/.tmp");
const TEST_DB_FILE_PATH = path.join(TEST_DB_DIR, "api-routes-db.json");
const TEST_UPLOAD_ROOT = path.join(process.cwd(), "tests/.tmp/api-route-uploads");

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

  await rm(TEST_UPLOAD_ROOT, { recursive: true, force: true });
  await mkdir(TEST_UPLOAD_ROOT, { recursive: true });
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
  const projectsStore = createProjectsJsonStore(TEST_DB_FILE_PATH);
  const tracksStore = createTracksJsonStore(TEST_DB_FILE_PATH);

  const server = createAppServer({
    projectsStore,
    tracksStore,
    clientOrigin: "http://localhost:5173",
    uploadRoot: TEST_UPLOAD_ROOT,
  });

  const baseUrl = await listenOnRandomPort(server);

  return {
    baseUrl,
    server,
  };
}

function createMultipartBody({
  boundary,
  parts,
}: {
  boundary: string;
  parts: Buffer[];
}): Buffer {
  return Buffer.concat([
    ...parts,
    Buffer.from(`--${boundary}--\r\n`, "utf-8"),
  ]);
}

function createTextPart({
  boundary,
  name,
  value,
}: {
  boundary: string;
  name: string;
  value: string;
}): Buffer {
  return Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${name}"\r\n` +
    `\r\n` +
    `${value}\r\n`,
    "utf-8",
  );
}

function createFilePart({
  boundary,
  fieldName,
  filename,
  mimeType,
  data,
}: {
  boundary: string;
  fieldName: string;
  filename: string;
  mimeType: string;
  data: Buffer;
}): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `\r\n`,
      "utf-8",
    ),
    data,
    Buffer.from("\r\n", "utf-8"),
  ]);
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
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

  tester.it("uploads an audio file for an existing project", async () => {
    const { baseUrl, server } = await createTestServer();
    const boundary = "----GrooveShareBoundary";
    const fileData = Buffer.from("fake wav data", "utf-8");

    try {
      const createProjectResponse = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Chorus Riff Idea",
          description: "Guitar riff with scratch drums",
        }),
      });

      const createProjectBody =
        (await createProjectResponse.json()) as ApiResponse<Project>;

      const projectId = createProjectBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      const multipartBody = createMultipartBody({
        boundary,
        parts: [
          createTextPart({
            boundary,
            name: "trackName",
            value: "Guitar",
          }),
          createFilePart({
            boundary,
            fieldName: "audioFile",
            filename: "guitar-riff.wav",
            mimeType: "audio/wav",
            data: fileData,
          }),
        ],
      });

      const uploadResponse = await fetch(
        `${baseUrl}/api/projects/${projectId}/tracks`,
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: bufferToArrayBuffer(multipartBody),
        },
      );

      const uploadBody = (await uploadResponse.json()) as ApiResponse<Track>;

      tester.expect(uploadResponse.status).toBe(201);
      tester.expect(uploadBody.ok).toBe(true);
      tester.expect(typeof uploadBody.data?.id).toBe("string");
      tester.expect(uploadBody.data?.projectId).toBe(projectId);
      tester.expect(uploadBody.data?.name).toBe("Guitar");
      tester.expect(uploadBody.data?.originalFilename).toBe("guitar-riff.wav");
      tester.expect(uploadBody.data?.mimeType).toBe("audio/wav");
      tester.expect(uploadBody.data?.fileSize).toBe(fileData.length);
      tester.expect(typeof uploadBody.data?.filePath).toBe("string");
      tester.expect(typeof uploadBody.data?.createdAt).toBe("string");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 404 when uploading a track for a missing project", async () => {
    const { baseUrl, server } = await createTestServer();
    const boundary = "----GrooveShareBoundary";

    try {
      const multipartBody = createMultipartBody({
        boundary,
        parts: [
          createTextPart({
            boundary,
            name: "trackName",
            value: "Guitar",
          }),
          createFilePart({
            boundary,
            fieldName: "audioFile",
            filename: "guitar-riff.wav",
            mimeType: "audio/wav",
            data: Buffer.from("fake wav data", "utf-8"),
          }),
        ],
      });

      const response = await fetch(`${baseUrl}/api/projects/not-real/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: bufferToArrayBuffer(multipartBody),
      });

      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(404);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Project not found.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 400 when upload request has no audio file", async () => {
    const { baseUrl, server } = await createTestServer();
    const boundary = "----GrooveShareBoundary";

    try {
      const createProjectResponse = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Chorus Riff Idea",
          description: "Guitar riff with scratch drums",
        }),
      });

      const createProjectBody =
        (await createProjectResponse.json()) as ApiResponse<Project>;

      const projectId = createProjectBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      const multipartBody = createMultipartBody({
        boundary,
        parts: [
          createTextPart({
            boundary,
            name: "trackName",
            value: "Guitar",
          }),
        ],
      });

      const response = await fetch(`${baseUrl}/api/projects/${projectId}/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: bufferToArrayBuffer(multipartBody),
      });

      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(400);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Audio file is required.");
    } finally {
      await closeServer(server);
    }
  });
});