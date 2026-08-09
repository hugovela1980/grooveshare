import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

async function readTestDatabase(): Promise<Database> {
  const fileContents = await readFile(TEST_DB_FILE_PATH, "utf-8");

  return JSON.parse(fileContents) as Database;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
    maxUploadFileSizeBytes: 20,
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

  tester.it("returns 415 when uploaded file type is unsupported", async () => {
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
            value: "Not Audio",
          }),
          createFilePart({
            boundary,
            fieldName: "audioFile",
            filename: "notes.txt",
            mimeType: "text/plain",
            data: Buffer.from("not audio", "utf-8"),
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

      tester.expect(response.status).toBe(415);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Unsupported audio file type.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 413 when uploaded file is too large", async () => {
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
            value: "Big Guitar File",
          }),
          createFilePart({
            boundary,
            fieldName: "audioFile",
            filename: "big-guitar.wav",
            mimeType: "audio/wav",
            data: Buffer.from("this file is too large for this test", "utf-8"),
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

      tester.expect(response.status).toBe(413);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Audio file is too large.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns tracks for a project", async () => {
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
          createFilePart({
            boundary,
            fieldName: "audioFile",
            filename: "guitar-riff.wav",
            mimeType: "audio/wav",
            data: Buffer.from("fake wav data", "utf-8"),
          }),
        ],
      });

      await fetch(`${baseUrl}/api/projects/${projectId}/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: bufferToArrayBuffer(multipartBody),
      });

      const response = await fetch(`${baseUrl}/api/projects/${projectId}/tracks`);
      const body = (await response.json()) as ApiResponse<Track[]>;

      tester.expect(response.status).toBe(200);
      tester.expect(body.ok).toBe(true);
      tester.expect(body.data?.length).toBe(1);
      tester.expect(body.data?.[0].projectId).toBe(projectId);
      tester.expect(body.data?.[0].name).toBe("Guitar");
      tester.expect(body.data?.[0].originalFilename).toBe("guitar-riff.wav");
      tester.expect(body.data?.[0].mimeType).toBe("audio/wav");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 404 when listing tracks for a missing project", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(`${baseUrl}/api/projects/not-real/tracks`);
      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(404);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Project not found.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("serves an uploaded audio file for a track", async () => {
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
          title: "Audio Route Test",
          description: "Testing audio file serving",
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
      const uploadedTrack = uploadBody.data;

      if (!uploadedTrack) {
        throw new Error("Uploaded track was missing from response.");
      }

      const audioResponse = await fetch(
        `${baseUrl}/api/projects/${projectId}/tracks/${uploadedTrack.id}/audio`,
      );

      const audioBody = Buffer.from(await audioResponse.arrayBuffer());

      tester.expect(audioResponse.status).toBe(200);
      tester.expect(audioResponse.headers.get("Content-Type")).toBe("audio/wav");
      tester.expect(audioBody.toString("utf-8")).toBe(fileData.toString("utf-8"));
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 404 when serving audio for a missing track", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const createProjectResponse = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Missing Audio Track Test",
          description: "Testing missing audio route",
        }),
      });

      const createProjectBody =
        (await createProjectResponse.json()) as ApiResponse<Project>;

      const projectId = createProjectBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      const response = await fetch(
        `${baseUrl}/api/projects/${projectId}/tracks/missing-track/audio`,
      );

      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(404);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Track not found.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("deletes a track and its uploaded audio file", async () => {
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
          title: "Delete Track Test",
          description: "Testing track deletion",
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
      const uploadedTrack = uploadBody.data;

      if (!uploadedTrack) {
        throw new Error("Uploaded track was missing from response.");
      }

      const absoluteUploadedFilePath = path.resolve(
        process.cwd(),
        uploadedTrack.filePath,
      );
      const projectUploadDir = path.dirname(absoluteUploadedFilePath);

      tester.expect(await fileExists(absoluteUploadedFilePath)).toBe(true);
      tester.expect(await fileExists(projectUploadDir)).toBe(true);

      const deleteResponse = await fetch(
        `${baseUrl}/api/projects/${projectId}/tracks/${uploadedTrack.id}`,
        {
          method: "DELETE",
        },
      );

      const deleteBody = (await deleteResponse.json()) as ApiResponse<Track>;

      tester.expect(deleteResponse.status).toBe(200);
      tester.expect(deleteBody.ok).toBe(true);
      tester.expect(deleteBody.data).toEqual(uploadedTrack);

      const database = await readTestDatabase();

      tester.expect(database.tracks).toEqual([]);
      tester.expect(await fileExists(absoluteUploadedFilePath)).toBe(false);
      tester.expect(await fileExists(projectUploadDir)).toBe(false);
    } finally {
      await closeServer(server);
    }
  });

  tester.it("does not remove the project upload folder when deleting one track and another track still exists", async () => {
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
          title: "Keep Project Folder Test",
          description: "Testing track deletion with multiple tracks",
        }),
      });

      const createProjectBody =
        (await createProjectResponse.json()) as ApiResponse<Project>;

      const projectId = createProjectBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      async function uploadTrack(filename: string): Promise<Track> {
        const multipartBody = createMultipartBody({
          boundary,
          parts: [
            createTextPart({
              boundary,
              name: "trackName",
              value: filename,
            }),
            createFilePart({
              boundary,
              fieldName: "audioFile",
              filename,
              mimeType: "audio/wav",
              data: fileData,
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

        const body = (await response.json()) as ApiResponse<Track>;

        if (!body.data) {
          throw new Error("Uploaded track was missing from response.");
        }

        return body.data;
      }

      const trackToDelete = await uploadTrack("delete-me.wav");
      const trackToKeep = await uploadTrack("keep-me.wav");

      const deletedFilePath = path.resolve(process.cwd(), trackToDelete.filePath);
      const keptFilePath = path.resolve(process.cwd(), trackToKeep.filePath);
      const projectUploadDir = path.dirname(deletedFilePath);

      tester.expect(await fileExists(deletedFilePath)).toBe(true);
      tester.expect(await fileExists(keptFilePath)).toBe(true);
      tester.expect(await fileExists(projectUploadDir)).toBe(true);

      const deleteResponse = await fetch(
        `${baseUrl}/api/projects/${projectId}/tracks/${trackToDelete.id}`,
        {
          method: "DELETE",
        },
      );

      const deleteBody = (await deleteResponse.json()) as ApiResponse<Track>;

      tester.expect(deleteResponse.status).toBe(200);
      tester.expect(deleteBody.ok).toBe(true);
      tester.expect(deleteBody.data).toEqual(trackToDelete);

      const database = await readTestDatabase();

      tester.expect(database.tracks.length).toBe(1);
      tester.expect(database.tracks[0]?.id).toBe(trackToKeep.id);
      tester.expect(await fileExists(deletedFilePath)).toBe(false);
      tester.expect(await fileExists(keptFilePath)).toBe(true);
      tester.expect(await fileExists(projectUploadDir)).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 404 when deleting a track from a missing project", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/projects/not-real/tracks/track-1`,
        {
          method: "DELETE",
        },
      );

      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(404);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Project not found.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 404 when deleting a missing track from an existing project", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const createProjectResponse = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Missing Track Test",
          description: "Testing missing track deletion",
        }),
      });

      const createProjectBody =
        (await createProjectResponse.json()) as ApiResponse<Project>;

      const projectId = createProjectBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      const response = await fetch(
        `${baseUrl}/api/projects/${projectId}/tracks/not-real`,
        {
          method: "DELETE",
        },
      );

      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(404);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Track not found.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("deletes a project, its linked track metadata, and uploaded audio files", async () => {
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
          title: "Delete Project Test",
          description: "Testing project deletion",
        }),
      });

      const createProjectBody =
        (await createProjectResponse.json()) as ApiResponse<Project>;

      const project = createProjectBody.data;

      if (!project) {
        throw new Error("Created project was missing from response.");
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
        `${baseUrl}/api/projects/${project.id}/tracks`,
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: bufferToArrayBuffer(multipartBody),
        },
      );

      const uploadBody = (await uploadResponse.json()) as ApiResponse<Track>;
      const uploadedTrack = uploadBody.data;

      if (!uploadedTrack) {
        throw new Error("Uploaded track was missing from response.");
      }

      const absoluteUploadedFilePath = path.resolve(
        process.cwd(),
        uploadedTrack.filePath,
      );

      const projectUploadDir = path.dirname(absoluteUploadedFilePath);

      tester.expect(await fileExists(absoluteUploadedFilePath)).toBe(true);
      tester.expect(await fileExists(projectUploadDir)).toBe(true);

      const deleteResponse = await fetch(
        `${baseUrl}/api/projects/${project.id}`,
        {
          method: "DELETE",
        },
      );

      const deleteBody = (await deleteResponse.json()) as ApiResponse<Project>;

      tester.expect(deleteResponse.status).toBe(200);
      tester.expect(deleteBody.ok).toBe(true);
      tester.expect(deleteBody.data).toEqual(project);

      const database = await readTestDatabase();

      tester.expect(database.projects).toEqual([]);
      tester.expect(database.tracks).toEqual([]);
      tester.expect(await fileExists(absoluteUploadedFilePath)).toBe(false);
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 404 when deleting a missing project", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(`${baseUrl}/api/projects/not-real`, {
        method: "DELETE",
      });

      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(404);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Project not found.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("does not delete other projects, tracks, or uploaded files", async () => {
    const { baseUrl, server } = await createTestServer();
    const boundary = "----GrooveShareBoundary";
    const fileData = Buffer.from("fake wav data", "utf-8");

    try {
      async function createProject(title: string): Promise<Project> {
        const response = await fetch(`${baseUrl}/api/projects`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description: "Testing project deletion isolation",
          }),
        });

        const body = (await response.json()) as ApiResponse<Project>;

        if (!body.data) {
          throw new Error("Created project was missing from response.");
        }

        return body.data;
      }

      async function uploadTrack(projectId: string, filename: string): Promise<Track> {
        const multipartBody = createMultipartBody({
          boundary,
          parts: [
            createTextPart({
              boundary,
              name: "trackName",
              value: filename,
            }),
            createFilePart({
              boundary,
              fieldName: "audioFile",
              filename,
              mimeType: "audio/wav",
              data: fileData,
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

        const body = (await response.json()) as ApiResponse<Track>;

        if (!body.data) {
          throw new Error("Uploaded track was missing from response.");
        }

        return body.data;
      }

      const projectToDelete = await createProject("Project to Delete");
      const projectToKeep = await createProject("Project to Keep");

      const trackToDelete = await uploadTrack(projectToDelete.id, "delete-me.wav");
      const trackToKeep = await uploadTrack(projectToKeep.id, "keep-me.wav");

      const deletedFilePath = path.resolve(process.cwd(), trackToDelete.filePath);
      const keptFilePath = path.resolve(process.cwd(), trackToKeep.filePath);

      tester.expect(await fileExists(deletedFilePath)).toBe(true);
      tester.expect(await fileExists(keptFilePath)).toBe(true);

      const deleteResponse = await fetch(
        `${baseUrl}/api/projects/${projectToDelete.id}`,
        {
          method: "DELETE",
        },
      );

      tester.expect(deleteResponse.status).toBe(200);

      const database = await readTestDatabase();

      tester.expect(database.projects).toEqual([projectToKeep]);
      tester.expect(database.tracks).toEqual([trackToKeep]);
      tester.expect(await fileExists(deletedFilePath)).toBe(false);
      tester.expect(await fileExists(keptFilePath)).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  tester.it("updates mix settings for a project", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const createResponse = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Mix Settings Test",
          description: "Testing saved mix settings",
        }),
      });

      const createBody =
        (await createResponse.json()) as ApiResponse<Project>;

      const projectId = createBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      const mixSettings = {
        channels: [
          {
            channelNumber: 1,
            trackId: "track-1",
            enabled: true,
            volume: 0.75,
          },
          {
            channelNumber: 2,
            trackId: "track-2",
            enabled: false,
            volume: 0.4,
          },
        ],
      };

      const response = await fetch(
        `${baseUrl}/api/projects/${projectId}/mix-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mixSettings),
        },
      );

      const body = (await response.json()) as ApiResponse<Project>;

      tester.expect(response.status).toBe(200);
      tester.expect(body.ok).toBe(true);
      tester.expect(body.data?.mixSettings).toEqual(mixSettings);

      const getResponse = await fetch(
        `${baseUrl}/api/projects/${projectId}`,
      );

      const getBody =
        (await getResponse.json()) as ApiResponse<Project>;

      tester.expect(getBody.data?.mixSettings).toEqual(mixSettings);
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 404 when updating mix settings for a missing project", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/projects/missing-project/mix-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channels: [],
          }),
        },
      );

      const body =
        (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(404);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Project not found.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 400 for invalid mix settings", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const createResponse = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Invalid Mix Test",
          description: "Testing invalid mix settings",
        }),
      });

      const createBody =
        (await createResponse.json()) as ApiResponse<Project>;

      const projectId = createBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      const response = await fetch(
        `${baseUrl}/api/projects/${projectId}/mix-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channels: [
              {
                channelNumber: 1,
                trackId: "track-1",
                enabled: true,
                volume: 2,
              },
            ],
          }),
        },
      );

      const body =
        (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(400);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Invalid mix settings.");
    } finally {
      await closeServer(server);
    }
  });
  tester.it("updates project title and description details", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const createResponse = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Original Title",
          description: "Original description",
        }),
      });

      const createBody = (await createResponse.json()) as ApiResponse<Project>;
      const projectId = createBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      const titleResponse = await fetch(`${baseUrl}/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      const titleBody = (await titleResponse.json()) as ApiResponse<Project>;

      tester.expect(titleResponse.status).toBe(200);
      tester.expect(titleBody.data?.title).toBe("Updated Title");
      tester.expect(titleBody.data?.description).toBe("Original description");

      const descriptionResponse = await fetch(
        `${baseUrl}/api/projects/${projectId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: "Updated description",
          }),
        },
      );

      tester.expect(descriptionResponse.status).toBe(200);

      const getResponse = await fetch(`${baseUrl}/api/projects/${projectId}`);
      const getBody = (await getResponse.json()) as ApiResponse<Project>;

      tester.expect(getBody.data?.title).toBe("Updated Title");
      tester.expect(getBody.data?.description).toBe("Updated description");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 400 for invalid project detail updates", async () => {
    const { baseUrl, server } = await createTestServer();

    try {
      const createResponse = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Project",
          description: "Description",
        }),
      });

      const createBody = (await createResponse.json()) as ApiResponse<Project>;
      const projectId = createBody.data?.id;

      if (!projectId) {
        throw new Error("Created project did not include an ID.");
      }

      const response = await fetch(`${baseUrl}/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "   ",
        }),
      });

      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(400);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Invalid project details.");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("updates a track name", async () => {
    const project: Project = {
      id: "project-1",
      title: "Project One",
      description: "Test project",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const track: Track = {
      id: "track-1",
      projectId: "project-1",
      name: "Guitar",
      originalFilename: "guitar.wav",
      filePath: "uploads/projects/project-1/guitar.wav",
      mimeType: "audio/wav",
      fileSize: 100,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    await writeFile(
      TEST_DB_FILE_PATH,
      `${JSON.stringify({ projects: [project], tracks: [track] }, null, 2)}\n`,
      "utf-8",
    );

    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/projects/project-1/tracks/track-1`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Lead Guitar",
          }),
        },
      );

      const body = (await response.json()) as ApiResponse<Track>;

      tester.expect(response.status).toBe(200);
      tester.expect(body.ok).toBe(true);
      tester.expect(body.data?.name).toBe("Lead Guitar");

      const tracksResponse = await fetch(
        `${baseUrl}/api/projects/project-1/tracks`,
      );
      const tracksBody = (await tracksResponse.json()) as ApiResponse<Track[]>;

      tester.expect(tracksBody.data?.[0]?.name).toBe("Lead Guitar");
    } finally {
      await closeServer(server);
    }
  });

  tester.it("returns 400 for an invalid track name update", async () => {
    const project: Project = {
      id: "project-1",
      title: "Project One",
      description: "Test project",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const track: Track = {
      id: "track-1",
      projectId: "project-1",
      name: "Guitar",
      originalFilename: "guitar.wav",
      filePath: "uploads/projects/project-1/guitar.wav",
      mimeType: "audio/wav",
      fileSize: 100,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    await writeFile(
      TEST_DB_FILE_PATH,
      `${JSON.stringify({ projects: [project], tracks: [track] }, null, 2)}\n`,
      "utf-8",
    );

    const { baseUrl, server } = await createTestServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/projects/project-1/tracks/track-1`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "   ",
          }),
        },
      );

      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(400);
      tester.expect(body.ok).toBe(false);
      tester.expect(body.error).toBe("Invalid track name.");
    } finally {
      await closeServer(server);
    }
  });

});