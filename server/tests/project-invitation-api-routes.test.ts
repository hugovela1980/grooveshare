import { mkdir, rm, writeFile } from "node:fs/promises";
import type http from "node:http";
import path from "node:path";
import { createAppServer } from "../src/app.js";
import { PROJECT_INVITATION_HEADER } from "../src/auth/project-invitation.js";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type { Database } from "../src/types.js";
import { createAuthenticatedTestSession } from "./helpers/create-authenticated-test-session.js";
import { createTestProjectInvitationsStore } from "./helpers/create-test-project-invitations-store.js";
import { createTestProjectMembershipsStore } from "./helpers/create-test-project-memberships-store.js";
import { createTestSessionsStore } from "./helpers/create-test-sessions-store.js";
import { createTestUsersStore } from "./helpers/create-test-users-store.js";
import { tester } from "./test-runner/tester.js";

const TEST_ROOT = path.join(
  process.cwd(),
  "tests/.tmp/project-invitation-api",
);
const TEST_DB_FILE_PATH = path.join(TEST_ROOT, "db.json");
const TEST_UPLOAD_ROOT = path.join(TEST_ROOT, "uploads");
const TEST_AUDIO_FILE = path.join(TEST_UPLOAD_ROOT, "guest-audio.wav");

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type InvitationTokenResponse = {
  token: string;
  active: boolean;
};

async function resetTestFiles(): Promise<void> {
  const emptyDatabase: Database = {
    projects: [],
    tracks: [],
  };

  await rm(TEST_ROOT, { recursive: true, force: true });
  await mkdir(TEST_UPLOAD_ROOT, { recursive: true });
  await writeFile(
    TEST_DB_FILE_PATH,
    `${JSON.stringify(emptyDatabase, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(TEST_AUDIO_FILE, Buffer.from("guest-audio-data"));
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

async function createTestServer() {
  const projectsStore = createProjectsJsonStore(TEST_DB_FILE_PATH);
  const tracksStore = createTracksJsonStore(TEST_DB_FILE_PATH);
  const usersStore = createTestUsersStore();
  const sessionsStore = createTestSessionsStore();
  const projectMembershipsStore = createTestProjectMembershipsStore();
  const projectInvitationsStore = createTestProjectInvitationsStore();

  const server = createAppServer({
    projectsStore,
    tracksStore,
    usersStore,
    sessionsStore,
    projectMembershipsStore,
    projectInvitationsStore,
    clientOrigin: "http://localhost:5173",
    uploadRoot: TEST_UPLOAD_ROOT,
    requestLoggingEnabled: false,
  });

  const baseUrl = await listenOnRandomPort(server);

  return {
    baseUrl,
    server,
    projectsStore,
    tracksStore,
    usersStore,
    sessionsStore,
    projectMembershipsStore,
    projectInvitationsStore,
  };
}

async function createOwnerProject(
  testServer: Awaited<ReturnType<typeof createTestServer>>,
) {
  const { user: owner, cookie: ownerCookie } =
    await createAuthenticatedTestSession({
      usersStore: testServer.usersStore,
      sessionsStore: testServer.sessionsStore,
      email: "invitation-owner@example.com",
      displayName: "Invitation Owner",
    });

  const project = await testServer.projectsStore.createProject({
    title: "Guest Invitation Project",
    description: "Invitation API integration project.",
  });

  await testServer.projectMembershipsStore.createMembership({
    projectId: project.id,
    userId: owner.id,
    role: "owner",
  });

  const track = await testServer.tracksStore.createTrack({
    projectId: project.id,
    name: "Guest Audio",
    originalFilename: "guest-audio.wav",
    filePath: TEST_AUDIO_FILE,
    mimeType: "audio/wav",
    fileSize: Buffer.byteLength("guest-audio-data"),
    uploadedByUserId: owner.id,
  });

  return { owner, ownerCookie, project, track };
}

async function requestWithCookie(
  baseUrl: string,
  cookie: string,
  route: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);

  return fetch(`${baseUrl}${route}`, { ...init, headers });
}

async function requestWithInvitation(
  baseUrl: string,
  token: string,
  route: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(PROJECT_INVITATION_HEADER, token);

  return fetch(`${baseUrl}${route}`, { ...init, headers });
}

async function generateInvitation(
  baseUrl: string,
  ownerCookie: string,
  projectId: string,
): Promise<string> {
  const response = await requestWithCookie(
    baseUrl,
    ownerCookie,
    `/api/projects/${projectId}/invitation`,
    { method: "POST" },
  );
  const body = (await response.json()) as ApiResponse<InvitationTokenResponse>;

  if (!body.data?.token) {
    throw new Error("Test invitation generation did not return a token.");
  }

  return body.data.token;
}

tester.describe("project invitation API routes", () => {
  tester.beforeEach(async () => {
    await resetTestFiles();
  });

  tester.it("lets only an Owner generate and inspect a project invitation", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, project } = await createOwnerProject(testServer);
      const { cookie: contributorCookie, user: contributor } =
        await createAuthenticatedTestSession({
          usersStore: testServer.usersStore,
          sessionsStore: testServer.sessionsStore,
          email: "invitation-contributor@example.com",
          displayName: "Contributor",
        });

      await testServer.projectMembershipsStore.createMembership({
        projectId: project.id,
        userId: contributor.id,
        role: "contributor",
      });

      const denied = await requestWithCookie(
        testServer.baseUrl,
        contributorCookie,
        `/api/projects/${project.id}/invitation`,
        { method: "POST" },
      );
      tester.expect(denied.status).toBe(403);

      const token = await generateInvitation(
        testServer.baseUrl,
        ownerCookie,
        project.id,
      );
      tester.expect(token.length >= 40).toBe(true);

      const statusResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        `/api/projects/${project.id}/invitation`,
      );
      const statusBody = (await statusResponse.json()) as ApiResponse<{
        active: boolean;
        token?: string;
      }>;

      tester.expect(statusResponse.status).toBe(200);
      tester.expect(statusBody.data?.active).toBe(true);
      tester.expect(statusBody.data?.token).toBe(undefined);
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("allows the same active link to authorize multiple Guest sessions", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, project } = await createOwnerProject(testServer);
      const token = await generateInvitation(
        testServer.baseUrl,
        ownerCookie,
        project.id,
      );

      const first = await requestWithInvitation(
        testServer.baseUrl,
        token,
        "/api/invitations/guest",
      );
      const second = await requestWithInvitation(
        testServer.baseUrl,
        token,
        "/api/invitations/guest",
      );

      tester.expect(first.status).toBe(200);
      tester.expect(second.status).toBe(200);
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("allows a Guest to read project details, track metadata, and audio", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, project, track } = await createOwnerProject(testServer);
      const token = await generateInvitation(
        testServer.baseUrl,
        ownerCookie,
        project.id,
      );

      const projectResponse = await requestWithInvitation(
        testServer.baseUrl,
        token,
        `/api/projects/${project.id}`,
      );
      const projectBody = (await projectResponse.json()) as ApiResponse<{
        access: string;
        role: string | null;
      }>;

      tester.expect(projectResponse.status).toBe(200);
      tester.expect(projectBody.data?.access).toBe("guest");
      tester.expect(projectBody.data?.role).toBe(null);

      const tracksResponse = await requestWithInvitation(
        testServer.baseUrl,
        token,
        `/api/projects/${project.id}/tracks`,
      );
      tester.expect(tracksResponse.status).toBe(200);

      const audioResponse = await requestWithInvitation(
        testServer.baseUrl,
        token,
        `/api/projects/${project.id}/tracks/${track.id}/audio`,
        { headers: { Range: "bytes=0-4" } },
      );
      tester.expect(audioResponse.status).toBe(206);
      tester.expect(await audioResponse.text()).toBe("guest");
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("denies Guest mutations while allowing Guest read access", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, project, track } = await createOwnerProject(testServer);
      const token = await generateInvitation(
        testServer.baseUrl,
        ownerCookie,
        project.id,
      );

      const updateProject = await requestWithInvitation(
        testServer.baseUrl,
        token,
        `/api/projects/${project.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Guest Edit" }),
        },
      );
      tester.expect(updateProject.status).toBe(403);

      const updateMix = await requestWithInvitation(
        testServer.baseUrl,
        token,
        `/api/projects/${project.id}/mix-settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channels: [] }),
        },
      );
      tester.expect(updateMix.status).toBe(403);

      const updateTrack = await requestWithInvitation(
        testServer.baseUrl,
        token,
        `/api/projects/${project.id}/tracks/${track.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Guest Rename" }),
        },
      );
      tester.expect(updateTrack.status).toBe(403);

      const deleteTrack = await requestWithInvitation(
        testServer.baseUrl,
        token,
        `/api/projects/${project.id}/tracks/${track.id}`,
        { method: "DELETE" },
      );
      tester.expect(deleteTrack.status).toBe(403);

      const members = await requestWithInvitation(
        testServer.baseUrl,
        token,
        `/api/projects/${project.id}/members`,
      );
      tester.expect(members.status).toBe(403);
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("invalidates the old token when an Owner regenerates the link", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, project } = await createOwnerProject(testServer);
      const firstToken = await generateInvitation(
        testServer.baseUrl,
        ownerCookie,
        project.id,
      );
      const secondToken = await generateInvitation(
        testServer.baseUrl,
        ownerCookie,
        project.id,
      );

      tester.expect(firstToken === secondToken).toBe(false);

      const oldResponse = await requestWithInvitation(
        testServer.baseUrl,
        firstToken,
        `/api/projects/${project.id}`,
      );
      const newResponse = await requestWithInvitation(
        testServer.baseUrl,
        secondToken,
        `/api/projects/${project.id}`,
      );

      tester.expect(oldResponse.status).toBe(401);
      tester.expect(newResponse.status).toBe(200);
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("rejects invalid and disabled invitation links", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, project } = await createOwnerProject(testServer);
      const invalidResponse = await requestWithInvitation(
        testServer.baseUrl,
        "not-a-valid-invitation-token",
        `/api/projects/${project.id}`,
      );
      tester.expect(invalidResponse.status).toBe(401);

      const token = await generateInvitation(
        testServer.baseUrl,
        ownerCookie,
        project.id,
      );

      const disableResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        `/api/projects/${project.id}/invitation`,
        { method: "DELETE" },
      );
      tester.expect(disableResponse.status).toBe(200);

      const disabledResponse = await requestWithInvitation(
        testServer.baseUrl,
        token,
        `/api/projects/${project.id}`,
      );
      tester.expect(disabledResponse.status).toBe(401);
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("requires authentication to accept an invitation", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, project } = await createOwnerProject(testServer);
      const token = await generateInvitation(
        testServer.baseUrl,
        ownerCookie,
        project.id,
      );

      const response = await requestWithInvitation(
        testServer.baseUrl,
        token,
        "/api/invitations/accept",
        { method: "POST" },
      );

      tester.expect(response.status).toBe(401);
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("creates or upgrades Contributor membership when an authenticated user accepts", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, owner, project } = await createOwnerProject(testServer);
      const token = await generateInvitation(
        testServer.baseUrl,
        ownerCookie,
        project.id,
      );

      const { user: newUser, cookie: newUserCookie } =
        await createAuthenticatedTestSession({
          usersStore: testServer.usersStore,
          sessionsStore: testServer.sessionsStore,
          email: "new-contributor@example.com",
          displayName: "New Contributor",
        });

      const newUserAccept = await requestWithCookie(
        testServer.baseUrl,
        newUserCookie,
        "/api/invitations/accept",
        {
          method: "POST",
          headers: { [PROJECT_INVITATION_HEADER]: token },
        },
      );
      tester.expect(newUserAccept.status).toBe(200);
      tester.expect(
        (await testServer.projectMembershipsStore.getMembership(
          project.id,
          newUser.id,
        ))?.role,
      ).toBe("contributor");

      const { user: viewer, cookie: viewerCookie } =
        await createAuthenticatedTestSession({
          usersStore: testServer.usersStore,
          sessionsStore: testServer.sessionsStore,
          email: "upgrade-viewer@example.com",
          displayName: "Upgrade Viewer",
        });
      await testServer.projectMembershipsStore.createMembership({
        projectId: project.id,
        userId: viewer.id,
        role: "viewer",
      });

      const viewerAccept = await requestWithCookie(
        testServer.baseUrl,
        viewerCookie,
        "/api/invitations/accept",
        {
          method: "POST",
          headers: { [PROJECT_INVITATION_HEADER]: token },
        },
      );
      tester.expect(viewerAccept.status).toBe(200);
      tester.expect(
        (await testServer.projectMembershipsStore.getMembership(
          project.id,
          viewer.id,
        ))?.role,
      ).toBe("contributor");

      const { user: contributor, cookie: contributorCookie } =
        await createAuthenticatedTestSession({
          usersStore: testServer.usersStore,
          sessionsStore: testServer.sessionsStore,
          email: "existing-contributor@example.com",
          displayName: "Existing Contributor",
        });
      await testServer.projectMembershipsStore.createMembership({
        projectId: project.id,
        userId: contributor.id,
        role: "contributor",
      });

      const contributorAccept = await requestWithCookie(
        testServer.baseUrl,
        contributorCookie,
        "/api/invitations/accept",
        {
          method: "POST",
          headers: { [PROJECT_INVITATION_HEADER]: token },
        },
      );
      tester.expect(contributorAccept.status).toBe(200);
      tester.expect(
        (await testServer.projectMembershipsStore.getMembership(
          project.id,
          contributor.id,
        ))?.role,
      ).toBe("contributor");

      const ownerAccept = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        "/api/invitations/accept",
        {
          method: "POST",
          headers: { [PROJECT_INVITATION_HEADER]: token },
        },
      );
      tester.expect(ownerAccept.status).toBe(200);
      tester.expect(
        (await testServer.projectMembershipsStore.getMembership(
          project.id,
          owner.id,
        ))?.role,
      ).toBe("owner");
    } finally {
      await closeServer(testServer.server);
    }
  });
});
