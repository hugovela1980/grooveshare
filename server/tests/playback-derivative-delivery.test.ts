import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type http from "node:http";
import path from "node:path";
import { createAppServer } from "../src/app.js";
import {
  hashProjectInvitationToken,
  PROJECT_INVITATION_HEADER,
} from "../src/auth/project-invitation.js";
import {
  CURRENT_PLAYBACK_DERIVATIVE_VERSION,
} from "../src/playback-derivative.js";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type {
  PlaybackDerivativeStatus,
  Track,
} from "../src/types.js";
import { createAuthenticatedTestSession } from "./helpers/create-authenticated-test-session.js";
import { createTestProjectInvitationsStore } from "./helpers/create-test-project-invitations-store.js";
import { createTestProjectMembershipsStore } from "./helpers/create-test-project-memberships-store.js";
import { createTestSessionsStore } from "./helpers/create-test-sessions-store.js";
import { createTestUsersStore } from "./helpers/create-test-users-store.js";
import { tester } from "./test-runner/tester.js";

const TEST_ROOT = path.join(
  process.cwd(),
  "tests/.tmp/playback-derivative-delivery",
);
const TEST_DB_FILE_PATH = path.join(TEST_ROOT, "db.json");
const ORIGINAL_FILE_PATH = path.join(TEST_ROOT, "original.wav");
const DERIVATIVE_FILE_PATH = path.join(TEST_ROOT, "derivative.opus");
const MISSING_DERIVATIVE_FILE_PATH = path.join(TEST_ROOT, "missing.opus");
const ORIGINAL_BYTES = Buffer.from("authoritative-original-audio", "utf-8");
const DERIVATIVE_BYTES = Buffer.from("playback-derivative-audio", "utf-8");

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

async function resetTestFiles(): Promise<void> {
  await rm(TEST_ROOT, { recursive: true, force: true });
  await mkdir(TEST_ROOT, { recursive: true });
  await writeFile(
    TEST_DB_FILE_PATH,
    `${JSON.stringify({ projects: [], tracks: [] }, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(ORIGINAL_FILE_PATH, ORIGINAL_BYTES);
  await writeFile(DERIVATIVE_FILE_PATH, DERIVATIVE_BYTES);
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

async function createOwnerTrack(
  testServer: Awaited<ReturnType<typeof createTestServer>>,
  derivativeStatus: PlaybackDerivativeStatus = "ready",
): Promise<{
  ownerCookie: string;
  projectId: string;
  track: Track;
}> {
  const { user, cookie: ownerCookie } =
    await createAuthenticatedTestSession({
      usersStore: testServer.usersStore,
      sessionsStore: testServer.sessionsStore,
      email: "derivative-owner@example.com",
      displayName: "Derivative Owner",
    });
  const project = await testServer.projectsStore.createProject({
    title: "Derivative Delivery",
    description: "Protected playback derivative delivery test.",
  });

  await testServer.projectMembershipsStore.createMembership({
    projectId: project.id,
    userId: user.id,
    role: "owner",
  });

  const createdTrack = await testServer.tracksStore.createTrack({
    projectId: project.id,
    name: "Derivative Track",
    originalFilename: "original.wav",
    filePath: ORIGINAL_FILE_PATH,
    mimeType: "audio/wav",
    fileSize: ORIGINAL_BYTES.length,
    uploadedByUserId: user.id,
  });
  const derivative = derivativeStatus === "ready"
    ? {
        status: "ready" as const,
        version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
        filePath: DERIVATIVE_FILE_PATH,
        mimeType: "audio/ogg",
        fileSize: DERIVATIVE_BYTES.length,
      }
    : {
        status: derivativeStatus,
        version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
        filePath: null,
        mimeType: null,
        fileSize: null,
      };
  const updateResult = await testServer.tracksStore.updatePlaybackDerivative(
    project.id,
    createdTrack.id,
    derivative,
  );

  if (!updateResult.ok) {
    throw new Error("Could not prepare playback derivative test track.");
  }

  return {
    ownerCookie,
    projectId: project.id,
    track: updateResult.updatedTrack,
  };
}

function requestWithCookie(
  baseUrl: string,
  cookie: string,
  route: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);

  return fetch(`${baseUrl}${route}`, { ...init, headers });
}

function getDerivativeRoute(projectId: string, trackId: string): string {
  return `/api/projects/${projectId}/tracks/${trackId}/playback-derivative`;
}

tester.describe("playback derivative delivery", () => {
  tester.beforeEach(async () => {
    await resetTestFiles();
  });

  tester.it("serves ready derivative bytes and preserves original delivery", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, projectId, track } =
        await createOwnerTrack(testServer);
      const derivativeResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        getDerivativeRoute(projectId, track.id),
      );
      const derivativeBody = Buffer.from(
        await derivativeResponse.arrayBuffer(),
      );

      tester.expect(derivativeResponse.status).toBe(200);
      tester.expect(derivativeResponse.headers.get("Content-Type")).toBe(
        "audio/ogg",
      );
      tester.expect(derivativeResponse.headers.get("Content-Length")).toBe(
        String(DERIVATIVE_BYTES.length),
      );
      tester.expect(derivativeResponse.headers.get("Accept-Ranges")).toBe(
        "bytes",
      );
      tester.expect(derivativeBody).toEqual(DERIVATIVE_BYTES);
      tester.expect(derivativeBody.equals(ORIGINAL_BYTES)).toBe(false);

      const originalResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        `/api/projects/${projectId}/tracks/${track.id}/audio`,
      );
      const originalBody = Buffer.from(await originalResponse.arrayBuffer());

      tester.expect(originalResponse.status).toBe(200);
      tester.expect(originalResponse.headers.get("Content-Type")).toBe(
        "audio/wav",
      );
      tester.expect(originalResponse.headers.get("Content-Length")).toBe(
        String(ORIGINAL_BYTES.length),
      );
      tester.expect(originalBody).toEqual(ORIGINAL_BYTES);
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("matches original byte-range behavior for valid and invalid ranges", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, projectId, track } =
        await createOwnerTrack(testServer);
      const derivativeRoute = getDerivativeRoute(projectId, track.id);
      const derivativeRangeResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        derivativeRoute,
        { headers: { Range: "bytes=2-6" } },
      );

      tester.expect(derivativeRangeResponse.status).toBe(206);
      tester.expect(
        derivativeRangeResponse.headers.get("Content-Range"),
      ).toBe(`bytes 2-6/${DERIVATIVE_BYTES.length}`);
      tester.expect(
        derivativeRangeResponse.headers.get("Content-Length"),
      ).toBe("5");
      tester.expect(
        derivativeRangeResponse.headers.get("Accept-Ranges"),
      ).toBe("bytes");
      tester.expect(
        Buffer.from(await derivativeRangeResponse.arrayBuffer()),
      ).toEqual(DERIVATIVE_BYTES.subarray(2, 7));

      const originalRangeResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        `/api/projects/${projectId}/tracks/${track.id}/audio`,
        { headers: { Range: "bytes=1-3" } },
      );
      tester.expect(originalRangeResponse.status).toBe(206);
      tester.expect(
        Buffer.from(await originalRangeResponse.arrayBuffer()),
      ).toEqual(ORIGINAL_BYTES.subarray(1, 4));

      const derivativeInvalidRangeResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        derivativeRoute,
        { headers: { Range: "bytes=999-1000" } },
      );
      const originalInvalidRangeResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        `/api/projects/${projectId}/tracks/${track.id}/audio`,
        { headers: { Range: "bytes=999-1000" } },
      );

      tester.expect(derivativeInvalidRangeResponse.status).toBe(200);
      tester.expect(originalInvalidRangeResponse.status).toBe(200);
      tester.expect(
        Buffer.from(await derivativeInvalidRangeResponse.arrayBuffer()),
      ).toEqual(DERIVATIVE_BYTES);
      tester.expect(
        Buffer.from(await originalInvalidRangeResponse.arrayBuffer()),
      ).toEqual(ORIGINAL_BYTES);
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("uses project-read authorization for members, outsiders, and Guests", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, projectId, track } =
        await createOwnerTrack(testServer);
      const route = getDerivativeRoute(projectId, track.id);
      const unauthenticatedResponse = await fetch(
        `${testServer.baseUrl}${route}`,
      );
      tester.expect(unauthenticatedResponse.status).toBe(401);

      const { cookie: outsiderCookie } =
        await createAuthenticatedTestSession({
          usersStore: testServer.usersStore,
          sessionsStore: testServer.sessionsStore,
          email: "derivative-outsider@example.com",
          displayName: "Derivative Outsider",
        });
      const outsiderResponse = await requestWithCookie(
        testServer.baseUrl,
        outsiderCookie,
        route,
      );
      tester.expect(outsiderResponse.status).toBe(403);

      const memberResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        route,
      );
      tester.expect(memberResponse.status).toBe(200);
      await memberResponse.arrayBuffer();

      const invitationToken = "playback-derivative-guest-token";
      await testServer.projectInvitationsStore.createOrReplaceInvitation({
        projectId,
        tokenHash: hashProjectInvitationToken(invitationToken),
        createdByUserId: track.uploadedByUserId ?? "",
      });
      const guestResponse = await fetch(
        `${testServer.baseUrl}${route}`,
        {
          headers: {
            [PROJECT_INVITATION_HEADER]: invitationToken,
            Range: "bytes=0-7",
          },
        },
      );

      tester.expect(guestResponse.status).toBe(206);
      tester.expect(Buffer.from(await guestResponse.arrayBuffer())).toEqual(
        DERIVATIVE_BYTES.subarray(0, 8),
      );
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("does not serve originals for non-ready derivatives", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, projectId, track } =
        await createOwnerTrack(testServer, "pending");
      const route = getDerivativeRoute(projectId, track.id);

      for (const status of ["pending", "processing", "failed"] as const) {
        const updateResult =
          await testServer.tracksStore.updatePlaybackDerivative(
            projectId,
            track.id,
            {
              status,
              version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
              filePath: null,
              mimeType: null,
              fileSize: null,
            },
          );
        tester.expect(updateResult.ok).toBe(true);

        const response = await requestWithCookie(
          testServer.baseUrl,
          ownerCookie,
          route,
        );
        const body = (await response.json()) as ApiResponse<unknown>;

        tester.expect(response.status).toBe(404);
        tester.expect(body.error).toBe("Playback derivative not available.");
      }

      const originalResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        `/api/projects/${projectId}/tracks/${track.id}/audio`,
      );
      tester.expect(originalResponse.status).toBe(200);
      tester.expect(Buffer.from(await originalResponse.arrayBuffer())).toEqual(
        ORIGINAL_BYTES,
      );
    } finally {
      await closeServer(testServer.server);
    }
  });

  tester.it("reports a missing ready artifact without fallback or mutation", async () => {
    const testServer = await createTestServer();

    try {
      const { ownerCookie, projectId, track } =
        await createOwnerTrack(testServer);
      const missingUpdate =
        await testServer.tracksStore.updatePlaybackDerivative(
          projectId,
          track.id,
          {
            status: "ready",
            version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
            filePath: MISSING_DERIVATIVE_FILE_PATH,
            mimeType: "audio/ogg",
            fileSize: DERIVATIVE_BYTES.length,
          },
        );
      tester.expect(missingUpdate.ok).toBe(true);

      const response = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        getDerivativeRoute(projectId, track.id),
      );
      const body = (await response.json()) as ApiResponse<unknown>;

      tester.expect(response.status).toBe(404);
      tester.expect(body.error).toBe("Playback derivative not available.");
      tester.expect(await readFile(ORIGINAL_FILE_PATH)).toEqual(ORIGINAL_BYTES);
      await access(ORIGINAL_FILE_PATH);

      const persistedTrack = await testServer.tracksStore.getTrackById(
        projectId,
        track.id,
      );
      tester.expect(persistedTrack?.playbackDerivative.status).toBe("ready");
      tester.expect(persistedTrack?.filePath).toBe(ORIGINAL_FILE_PATH);

      const originalResponse = await requestWithCookie(
        testServer.baseUrl,
        ownerCookie,
        `/api/projects/${projectId}/tracks/${track.id}/audio`,
      );
      tester.expect(originalResponse.status).toBe(200);
      tester.expect(Buffer.from(await originalResponse.arrayBuffer())).toEqual(
        ORIGINAL_BYTES,
      );
    } finally {
      await closeServer(testServer.server);
    }
  });
});
