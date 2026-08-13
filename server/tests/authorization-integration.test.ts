import { mkdir, rm, writeFile } from "node:fs/promises";
import type http from "node:http";
import path from "node:path";
import { createAppServer } from "../src/app.js";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type { Project, Track } from "../src/types.js";
import { createTestProjectMembershipsStore } from "./helpers/create-test-project-memberships-store.js";
import { createTestSessionsStore } from "./helpers/create-test-sessions-store.js";
import { createTestUsersStore } from "./helpers/create-test-users-store.js";
import { tester } from "./test-runner/tester.js";

const TEST_ROOT = path.join(
  process.cwd(),
  "tests/.tmp/authorization-integration",
);

const TEST_DB_FILE_PATH = path.join(
  TEST_ROOT,
  "db.json",
);

const TEST_UPLOAD_ROOT = path.join(
  TEST_ROOT,
  "uploads",
);

const TEST_SEED_PROJECT_DIR = path.join(
  TEST_ROOT,
  "seed-project",
);

type DevAuthorizationAccount = {
  role: "owner" | "contributor" | "viewer";
  email: string;
  displayName: string;
  password: string;
  userId: string;
};

type DevAuthorizationSeedResult = {
  project: Project;
  tracks: Track[];
  accounts: DevAuthorizationAccount[];
};

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

function listenOnRandomPort(server: http.Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        throw new Error(
          "Could not determine authorization test server address.",
        );
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

async function resetAuthorizationTestFiles(): Promise<void> {
  await rm(TEST_ROOT, {
    recursive: true,
    force: true,
  });

  await mkdir(TEST_SEED_PROJECT_DIR, {
    recursive: true,
  });

  await writeFile(
    TEST_DB_FILE_PATH,
    `${JSON.stringify({ projects: [], tracks: [] }, null, 2)}\n`,
    "utf-8",
  );

  await writeFile(
    path.join(TEST_SEED_PROJECT_DIR, "Owner Guitar.wav"),
    Buffer.from("owner audio", "utf-8"),
  );

  await writeFile(
    path.join(TEST_SEED_PROJECT_DIR, "Contributor Guitar.wav"),
    Buffer.from("contributor audio", "utf-8"),
  );
}

async function createAuthorizationTestServer({
  developmentRoutesEnabled = true,
}: {
  developmentRoutesEnabled?: boolean;
} = {}): Promise<{
  baseUrl: string;
  server: http.Server;
}> {
  const projectsStore = createProjectsJsonStore(
    TEST_DB_FILE_PATH,
  );
  const tracksStore = createTracksJsonStore(
    TEST_DB_FILE_PATH,
  );
  const usersStore = createTestUsersStore();
  const sessionsStore = createTestSessionsStore();
  const projectMembershipsStore =
    createTestProjectMembershipsStore();

  const server = createAppServer({
    projectsStore,
    tracksStore,
    usersStore,
    sessionsStore,
    projectMembershipsStore,
    clientOrigin: "http://localhost:5173",
    uploadRoot: TEST_UPLOAD_ROOT,
    seedProjectDir: TEST_SEED_PROJECT_DIR,
    maxUploadFileSizeBytes: 1024,
    developmentRoutesEnabled,
  });

  const baseUrl = await listenOnRandomPort(server);

  return {
    baseUrl,
    server,
  };
}

async function login(
  baseUrl: string,
  account: Pick<DevAuthorizationAccount, "email" | "password">,
): Promise<string> {
  const response = await globalThis.fetch(
    `${baseUrl}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
      }),
    },
  );

  tester.expect(response.status).toBe(200);

  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Login did not return a session cookie.");
  }

  return setCookie.split(";", 1)[0] ?? setCookie;
}

function getAccount(
  accounts: DevAuthorizationAccount[],
  role: "owner" | "contributor" | "viewer",
): DevAuthorizationAccount {
  const account = accounts.find(
    (candidate) => candidate.role === role,
  );

  if (!account) {
    throw new Error(`Authorization seed did not return a ${role} account.`);
  }

  return account;
}

function getTrackUploadedBy(
  tracks: Track[],
  userId: string,
): Track {
  const track = tracks.find(
    (candidate) => candidate.uploadedByUserId === userId,
  );

  if (!track) {
    throw new Error("Authorization seed did not return the expected owned track.");
  }

  return track;
}

function createMultipartBody({
  boundary,
  trackName,
  filename,
  data,
}: {
  boundary: string;
  trackName: string;
  filename: string;
  data: Buffer;
}): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="trackName"\r\n` +
        `\r\n` +
        `${trackName}\r\n`,
      "utf-8",
    ),
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="audioFile"; filename="${filename}"\r\n` +
        `Content-Type: audio/wav\r\n` +
        `\r\n`,
      "utf-8",
    ),
    data,
    Buffer.from("\r\n", "utf-8"),
    Buffer.from(`--${boundary}--\r\n`, "utf-8"),
  ]);
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

async function requestWithCookie(
  baseUrl: string,
  cookie: string,
  route: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);

  return globalThis.fetch(
    `${baseUrl}${route}`,
    {
      ...init,
      headers,
    },
  );
}

tester.describe("authorization integration", () => {
  tester.beforeEach(async () => {
    await resetAuthorizationTestFiles();
  });

  tester.it(
    "hides the authorization seed route in production",
    async () => {
      const {
        baseUrl,
        server,
      } = await createAuthorizationTestServer({
        developmentRoutesEnabled: false,
      });

      try {
        const response = await globalThis.fetch(
          `${baseUrl}/api/dev/seed-authorization`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filenames: [
                "Owner Guitar.wav",
                "Contributor Guitar.wav",
              ],
            }),
          },
        );

        tester.expect(response.status).toBe(404);
      } finally {
        await closeServer(server);
      }
    },
  );

  tester.it(
    "replaces the previous authorization demo project when reseeded",
    async () => {
      const { baseUrl, server } = await createAuthorizationTestServer();

      try {
        const seedRequest = () => globalThis.fetch(
          `${baseUrl}/api/dev/seed-authorization`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filenames: [
                "Owner Guitar.wav",
                "Contributor Guitar.wav",
              ],
            }),
          },
        );

        const firstResponse = await seedRequest();
        const firstBody =
          (await firstResponse.json()) as ApiResponse<DevAuthorizationSeedResult>;
        const secondResponse = await seedRequest();
        const secondBody =
          (await secondResponse.json()) as ApiResponse<DevAuthorizationSeedResult>;

        if (!firstBody.data || !secondBody.data) {
          throw new Error("Authorization seed response did not include data.");
        }

        tester.expect(firstResponse.status).toBe(201);
        tester.expect(secondResponse.status).toBe(201);
        tester.expect(
          firstBody.data.project.id === secondBody.data.project.id,
        ).toBe(false);

        const owner = getAccount(secondBody.data.accounts, "owner");
        const ownerCookie = await login(baseUrl, owner);
        const projectsResponse = await requestWithCookie(
          baseUrl,
          ownerCookie,
          "/api/projects",
        );
        const projectsBody =
          (await projectsResponse.json()) as ApiResponse<Project[]>;

        tester.expect(projectsResponse.status).toBe(200);
        tester.expect(projectsBody.data?.length).toBe(1);
        tester.expect(projectsBody.data?.[0]?.id).toBe(
          secondBody.data.project.id,
        );
      } finally {
        await closeServer(server);
      }
    },
  );

  tester.it(
    "enforces the full Owner, Contributor, Viewer, and non-member permission flow",
    async () => {
      const {
        baseUrl,
        server,
      } = await createAuthorizationTestServer();

      try {
        const seedResponse = await globalThis.fetch(
          `${baseUrl}/api/dev/seed-authorization`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filenames: [
                "Owner Guitar.wav",
                "Contributor Guitar.wav",
              ],
            }),
          },
        );

        tester.expect(seedResponse.status).toBe(201);

        const seedBody =
          (await seedResponse.json()) as ApiResponse<DevAuthorizationSeedResult>;

        if (!seedBody.data) {
          throw new Error("Authorization seed response did not include data.");
        }

        const {
          project,
          tracks,
          accounts,
        } = seedBody.data;

        tester.expect(accounts.length).toBe(3);
        tester.expect(tracks.length).toBe(2);

        const owner = getAccount(accounts, "owner");
        const contributor = getAccount(accounts, "contributor");
        const viewer = getAccount(accounts, "viewer");

        const ownerTrack = getTrackUploadedBy(
          tracks,
          owner.userId,
        );
        const contributorTrack = getTrackUploadedBy(
          tracks,
          contributor.userId,
        );

        const unauthenticatedResponse = await globalThis.fetch(
          `${baseUrl}/api/projects/${project.id}`,
        );

        tester.expect(unauthenticatedResponse.status).toBe(401);

        const ownerCookie = await login(baseUrl, owner);
        const contributorCookie = await login(baseUrl, contributor);
        const viewerCookie = await login(baseUrl, viewer);

        const registerOutsiderResponse = await globalThis.fetch(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: "dev-outsider@grooveshare.local",
              displayName: "Dev Outsider",
              password: "GrooveShare Dev Outsider 123!",
            }),
          },
        );

        tester.expect(registerOutsiderResponse.status).toBe(201);

        const outsiderCookie = await login(baseUrl, {
          email: "dev-outsider@grooveshare.local",
          password: "GrooveShare Dev Outsider 123!",
        });

        const outsiderReadResponse = await requestWithCookie(
          baseUrl,
          outsiderCookie,
          `/api/projects/${project.id}`,
        );

        tester.expect(outsiderReadResponse.status).toBe(403);

        const viewerReadResponse = await requestWithCookie(
          baseUrl,
          viewerCookie,
          `/api/projects/${project.id}`,
        );

        tester.expect(viewerReadResponse.status).toBe(200);

        const viewerTracksResponse = await requestWithCookie(
          baseUrl,
          viewerCookie,
          `/api/projects/${project.id}/tracks`,
        );

        tester.expect(viewerTracksResponse.status).toBe(200);

        const viewerAudioResponse = await requestWithCookie(
          baseUrl,
          viewerCookie,
          `/api/projects/${project.id}/tracks/${ownerTrack.id}/audio`,
        );

        tester.expect(viewerAudioResponse.status).toBe(200);
        tester.expect(
          viewerAudioResponse.headers.get("Content-Type"),
        ).toBe("audio/wav");
        await viewerAudioResponse.arrayBuffer();

        const viewerUploadBoundary = "----GrooveShareViewerBoundary";
        const viewerUploadBody = createMultipartBody({
          boundary: viewerUploadBoundary,
          trackName: "Viewer Upload Attempt",
          filename: "viewer.wav",
          data: Buffer.from("viewer audio", "utf-8"),
        });

        const viewerUploadResponse = await requestWithCookie(
          baseUrl,
          viewerCookie,
          `/api/projects/${project.id}/tracks`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                `multipart/form-data; boundary=${viewerUploadBoundary}`,
            },
            body: bufferToArrayBuffer(viewerUploadBody),
          },
        );

        tester.expect(viewerUploadResponse.status).toBe(403);

        const viewerDeleteResponse = await requestWithCookie(
          baseUrl,
          viewerCookie,
          `/api/projects/${project.id}/tracks/${ownerTrack.id}`,
          {
            method: "DELETE",
          },
        );

        tester.expect(viewerDeleteResponse.status).toBe(403);

        const viewerMixResponse = await requestWithCookie(
          baseUrl,
          viewerCookie,
          `/api/projects/${project.id}/mix-settings`,
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

        tester.expect(viewerMixResponse.status).toBe(403);

        const viewerMembersResponse = await requestWithCookie(
          baseUrl,
          viewerCookie,
          `/api/projects/${project.id}/members`,
        );

        tester.expect(viewerMembersResponse.status).toBe(403);

        const contributorReadResponse = await requestWithCookie(
          baseUrl,
          contributorCookie,
          `/api/projects/${project.id}`,
        );

        tester.expect(contributorReadResponse.status).toBe(200);

        const contributorOwnRenameResponse = await requestWithCookie(
          baseUrl,
          contributorCookie,
          `/api/projects/${project.id}/tracks/${contributorTrack.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Contributor Renamed Own Track",
            }),
          },
        );

        tester.expect(contributorOwnRenameResponse.status).toBe(200);

        const contributorOwnerTrackRenameResponse = await requestWithCookie(
          baseUrl,
          contributorCookie,
          `/api/projects/${project.id}/tracks/${ownerTrack.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Contributor Tried Owner Track",
            }),
          },
        );

        tester.expect(contributorOwnerTrackRenameResponse.status).toBe(403);

        const contributorOwnerTrackDeleteResponse = await requestWithCookie(
          baseUrl,
          contributorCookie,
          `/api/projects/${project.id}/tracks/${ownerTrack.id}`,
          {
            method: "DELETE",
          },
        );

        tester.expect(contributorOwnerTrackDeleteResponse.status).toBe(403);

        const boundary = "----GrooveShareAuthorizationBoundary";
        const uploadData = Buffer.from("new contributor audio", "utf-8");
        const multipartBody = createMultipartBody({
          boundary,
          trackName: "Contributor New Upload",
          filename: "contributor-new.wav",
          data: uploadData,
        });

        const contributorUploadResponse = await requestWithCookie(
          baseUrl,
          contributorCookie,
          `/api/projects/${project.id}/tracks`,
          {
            method: "POST",
            headers: {
              "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
            body: bufferToArrayBuffer(multipartBody),
          },
        );

        tester.expect(contributorUploadResponse.status).toBe(201);

        const contributorUploadBody =
          (await contributorUploadResponse.json()) as ApiResponse<Track>;
        const contributorUploadedTrack = contributorUploadBody.data;

        if (!contributorUploadedTrack) {
          throw new Error("Contributor upload did not return a track.");
        }

        tester.expect(
          contributorUploadedTrack.uploadedByUserId,
        ).toBe(contributor.userId);

        const contributorDeleteOwnResponse = await requestWithCookie(
          baseUrl,
          contributorCookie,
          `/api/projects/${project.id}/tracks/${contributorUploadedTrack.id}`,
          {
            method: "DELETE",
          },
        );

        tester.expect(contributorDeleteOwnResponse.status).toBe(200);

        const contributorProjectUpdateResponse = await requestWithCookie(
          baseUrl,
          contributorCookie,
          `/api/projects/${project.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: "Contributor Cannot Manage Project",
            }),
          },
        );

        tester.expect(contributorProjectUpdateResponse.status).toBe(403);

        const contributorMembersResponse = await requestWithCookie(
          baseUrl,
          contributorCookie,
          `/api/projects/${project.id}/members`,
        );

        tester.expect(contributorMembersResponse.status).toBe(403);

        const ownerProjectUpdateResponse = await requestWithCookie(
          baseUrl,
          ownerCookie,
          `/api/projects/${project.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: "Owner Managed Project",
            }),
          },
        );

        tester.expect(ownerProjectUpdateResponse.status).toBe(200);

        const ownerRenameContributorTrackResponse = await requestWithCookie(
          baseUrl,
          ownerCookie,
          `/api/projects/${project.id}/tracks/${contributorTrack.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Owner Managed Contributor Track",
            }),
          },
        );

        tester.expect(ownerRenameContributorTrackResponse.status).toBe(200);

        const ownerDeleteContributorTrackResponse = await requestWithCookie(
          baseUrl,
          ownerCookie,
          `/api/projects/${project.id}/tracks/${contributorTrack.id}`,
          {
            method: "DELETE",
          },
        );

        tester.expect(ownerDeleteContributorTrackResponse.status).toBe(200);

        const ownerMembersResponse = await requestWithCookie(
          baseUrl,
          ownerCookie,
          `/api/projects/${project.id}/members`,
        );

        tester.expect(ownerMembersResponse.status).toBe(200);

        const ownerMembersBody =
          (await ownerMembersResponse.json()) as ApiResponse<unknown[]>;

        tester.expect(ownerMembersBody.data?.length).toBe(3);

        const ownerDeleteProjectResponse = await requestWithCookie(
          baseUrl,
          ownerCookie,
          `/api/projects/${project.id}`,
          {
            method: "DELETE",
          },
        );

        tester.expect(ownerDeleteProjectResponse.status).toBe(200);
      } finally {
        await closeServer(server);
      }
    },
  );
});
