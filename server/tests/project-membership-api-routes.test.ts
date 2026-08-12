import { mkdir, rm, writeFile } from "node:fs/promises";
import type http from "node:http";
import path from "node:path";
import { createAppServer } from "../src/app.js";
import type { ProjectMember } from "../src/auth/project-membership-routes.js";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type { Database } from "../src/types.js";
import { createAuthenticatedTestSession } from "./helpers/create-authenticated-test-session.js";
import { createTestProjectMembershipsStore } from "./helpers/create-test-project-memberships-store.js";
import { createTestSessionsStore } from "./helpers/create-test-sessions-store.js";
import { createTestUsersStore } from "./helpers/create-test-users-store.js";
import { tester } from "./test-runner/tester.js";

const TEST_DB_DIR = path.join(
  process.cwd(),
  "tests/.tmp",
);
const TEST_DB_FILE_PATH = path.join(
  TEST_DB_DIR,
  "project-membership-api-routes-db.json",
);
const TEST_UPLOAD_ROOT = path.join(
  process.cwd(),
  "tests/.tmp/project-membership-api-route-uploads",
);

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

  await mkdir(TEST_DB_DIR, {
    recursive: true,
  });

  await writeFile(
    TEST_DB_FILE_PATH,
    `${JSON.stringify(emptyDatabase, null, 2)}\n`,
    "utf-8",
  );

  await rm(TEST_UPLOAD_ROOT, {
    recursive: true,
    force: true,
  });
}

function listenOnRandomPort(
  server: http.Server,
): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        throw new Error(
          "Could not determine test server address.",
        );
      }

      resolve(
        `http://localhost:${address.port}`,
      );
    });
  });
}

function closeServer(
  server: http.Server,
): Promise<void> {
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
  const projectsStore =
    createProjectsJsonStore(
      TEST_DB_FILE_PATH,
    );
  const tracksStore =
    createTracksJsonStore(
      TEST_DB_FILE_PATH,
    );
  const usersStore =
    createTestUsersStore();
  const sessionsStore =
    createTestSessionsStore();
  const projectMembershipsStore =
    createTestProjectMembershipsStore();

  const server = createAppServer({
    projectsStore,
    tracksStore,
    usersStore,
    sessionsStore,
    projectMembershipsStore,
    clientOrigin:
      "http://localhost:5173",
    uploadRoot: TEST_UPLOAD_ROOT,
  });

  const baseUrl =
    await listenOnRandomPort(server);

  return {
    baseUrl,
    server,
    projectsStore,
    usersStore,
    sessionsStore,
    projectMembershipsStore,
  };
}

async function createOwnerProject({
  projectsStore,
  usersStore,
  sessionsStore,
  projectMembershipsStore,
}: Awaited<ReturnType<typeof createTestServer>>) {
  const {
    user: owner,
    cookie: ownerCookie,
  } = await createAuthenticatedTestSession({
    usersStore,
    sessionsStore,
    email: "owner@example.com",
    displayName: "Project Owner",
  });

  const project =
    await projectsStore.createProject({
      title: "Membership API Test",
      description:
        "Project used for membership API tests.",
    });

  await projectMembershipsStore
    .createMembership({
      projectId: project.id,
      userId: owner.id,
      role: "owner",
    });

  return {
    owner,
    ownerCookie,
    project,
  };
}

async function requestWithCookie(
  baseUrl: string,
  cookie: string,
  route: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(
    init.headers,
  );

  headers.set("Cookie", cookie);

  return fetch(
    `${baseUrl}${route}`,
    {
      ...init,
      headers,
    },
  );
}

tester.describe(
  "project membership API routes",
  () => {
    tester.beforeEach(async () => {
      await resetTestDatabase();
    });

    tester.it(
      "requires authentication to list project members",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
        } = testServer;

        try {
          const { project } =
            await createOwnerProject(
              testServer,
            );

          const response = await fetch(
            `${baseUrl}/api/projects/${project.id}/members`,
          );
          const body =
            (await response.json()) as ApiResponse<unknown>;

          tester.expect(
            response.status,
          ).toBe(401);
          tester.expect(body.ok).toBe(
            false,
          );
          tester.expect(
            body.error,
          ).toBe(
            "Authentication required.",
          );
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "allows the owner to list project members without exposing password hashes",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
          usersStore,
          projectMembershipsStore,
        } = testServer;

        try {
          const {
            ownerCookie,
            project,
          } = await createOwnerProject(
            testServer,
          );

          const viewer =
            await usersStore.createUser({
              email: "viewer@example.com",
              displayName: "Viewer",
              passwordHash:
                "viewer-test-hash",
            });

          await projectMembershipsStore
            .createMembership({
              projectId: project.id,
              userId: viewer.id,
              role: "viewer",
            });

          const response =
            await requestWithCookie(
              baseUrl,
              ownerCookie,
              `/api/projects/${project.id}/members`,
            );
          const body =
            (await response.json()) as ApiResponse<ProjectMember[]>;

          tester.expect(
            response.status,
          ).toBe(200);
          tester.expect(body.ok).toBe(
            true,
          );
          tester.expect(
            body.data?.length,
          ).toBe(2);
          tester.expect(
            body.data?.[1]?.user.email,
          ).toBe("viewer@example.com");
          tester.expect(
            "passwordHash" in
              (body.data?.[1]?.user as Record<string, unknown>),
          ).toBe(false);
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "does not let a contributor manage project members",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
          usersStore,
          sessionsStore,
          projectMembershipsStore,
        } = testServer;

        try {
          const { project } =
            await createOwnerProject(
              testServer,
            );

          const {
            user: contributor,
            cookie: contributorCookie,
          } =
            await createAuthenticatedTestSession({
              usersStore,
              sessionsStore,
              email:
                "contributor@example.com",
              displayName: "Contributor",
            });

          await projectMembershipsStore
            .createMembership({
              projectId: project.id,
              userId: contributor.id,
              role: "contributor",
            });

          const response =
            await requestWithCookie(
              baseUrl,
              contributorCookie,
              `/api/projects/${project.id}/members`,
            );
          const body =
            (await response.json()) as ApiResponse<unknown>;

          tester.expect(
            response.status,
          ).toBe(403);
          tester.expect(
            body.error,
          ).toBe(
            "Project access denied.",
          );
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "allows the owner to add a registered user as a viewer",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
          usersStore,
          projectMembershipsStore,
        } = testServer;

        try {
          const {
            ownerCookie,
            project,
          } = await createOwnerProject(
            testServer,
          );

          const viewer =
            await usersStore.createUser({
              email: "viewer@example.com",
              displayName: "Viewer",
              passwordHash:
                "viewer-test-hash",
            });

          const response =
            await requestWithCookie(
              baseUrl,
              ownerCookie,
              `/api/projects/${project.id}/members`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  email:
                    " VIEWER@EXAMPLE.COM ",
                  role: "viewer",
                }),
              },
            );
          const body =
            (await response.json()) as ApiResponse<ProjectMember>;

          tester.expect(
            response.status,
          ).toBe(201);
          tester.expect(
            body.data?.user.id,
          ).toBe(viewer.id);
          tester.expect(
            body.data?.role,
          ).toBe("viewer");

          const membership =
            await projectMembershipsStore
              .getMembership(
                project.id,
                viewer.id,
              );

          tester.expect(
            membership?.role,
          ).toBe("viewer");
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "returns 404 when adding an email that does not belong to a user",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
        } = testServer;

        try {
          const {
            ownerCookie,
            project,
          } = await createOwnerProject(
            testServer,
          );

          const response =
            await requestWithCookie(
              baseUrl,
              ownerCookie,
              `/api/projects/${project.id}/members`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  email:
                    "missing@example.com",
                  role: "viewer",
                }),
              },
            );
          const body =
            (await response.json()) as ApiResponse<unknown>;

          tester.expect(
            response.status,
          ).toBe(404);
          tester.expect(
            body.error,
          ).toBe("User not found.");
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "does not allow owner to be assigned through the member route",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
          usersStore,
        } = testServer;

        try {
          const {
            ownerCookie,
            project,
          } = await createOwnerProject(
            testServer,
          );

          await usersStore.createUser({
            email: "member@example.com",
            displayName: "Member",
            passwordHash:
              "member-test-hash",
          });

          const response =
            await requestWithCookie(
              baseUrl,
              ownerCookie,
              `/api/projects/${project.id}/members`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  email:
                    "member@example.com",
                  role: "owner",
                }),
              },
            );

          tester.expect(
            response.status,
          ).toBe(400);
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "returns 409 when adding an existing project member again",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
          usersStore,
          projectMembershipsStore,
        } = testServer;

        try {
          const {
            ownerCookie,
            project,
          } = await createOwnerProject(
            testServer,
          );

          const member =
            await usersStore.createUser({
              email: "member@example.com",
              displayName: "Member",
              passwordHash:
                "member-test-hash",
            });

          await projectMembershipsStore
            .createMembership({
              projectId: project.id,
              userId: member.id,
              role: "viewer",
            });

          const response =
            await requestWithCookie(
              baseUrl,
              ownerCookie,
              `/api/projects/${project.id}/members`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  email:
                    "member@example.com",
                  role: "contributor",
                }),
              },
            );
          const body =
            (await response.json()) as ApiResponse<unknown>;

          tester.expect(
            response.status,
          ).toBe(409);
          tester.expect(
            body.error,
          ).toBe(
            "User is already a project member.",
          );
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "allows the owner to change a viewer to a contributor",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
          usersStore,
          projectMembershipsStore,
        } = testServer;

        try {
          const {
            ownerCookie,
            project,
          } = await createOwnerProject(
            testServer,
          );

          const member =
            await usersStore.createUser({
              email: "member@example.com",
              displayName: "Member",
              passwordHash:
                "member-test-hash",
            });

          await projectMembershipsStore
            .createMembership({
              projectId: project.id,
              userId: member.id,
              role: "viewer",
            });

          const response =
            await requestWithCookie(
              baseUrl,
              ownerCookie,
              `/api/projects/${project.id}/members/${member.id}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  role: "contributor",
                }),
              },
            );
          const body =
            (await response.json()) as ApiResponse<ProjectMember>;

          tester.expect(
            response.status,
          ).toBe(200);
          tester.expect(
            body.data?.role,
          ).toBe("contributor");

          const membership =
            await projectMembershipsStore
              .getMembership(
                project.id,
                member.id,
              );

          tester.expect(
            membership?.role,
          ).toBe("contributor");
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "does not allow the owner membership to be changed through the member route",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
        } = testServer;

        try {
          const {
            owner,
            ownerCookie,
            project,
          } = await createOwnerProject(
            testServer,
          );

          const response =
            await requestWithCookie(
              baseUrl,
              ownerCookie,
              `/api/projects/${project.id}/members/${owner.id}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  role: "contributor",
                }),
              },
            );
          const body =
            (await response.json()) as ApiResponse<unknown>;

          tester.expect(
            response.status,
          ).toBe(409);
          tester.expect(
            body.error,
          ).toBe(
            "Project owner role cannot be changed here.",
          );
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "allows the owner to remove a non-owner member",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
          usersStore,
          projectMembershipsStore,
        } = testServer;

        try {
          const {
            ownerCookie,
            project,
          } = await createOwnerProject(
            testServer,
          );

          const member =
            await usersStore.createUser({
              email: "member@example.com",
              displayName: "Member",
              passwordHash:
                "member-test-hash",
            });

          await projectMembershipsStore
            .createMembership({
              projectId: project.id,
              userId: member.id,
              role: "viewer",
            });

          const response =
            await requestWithCookie(
              baseUrl,
              ownerCookie,
              `/api/projects/${project.id}/members/${member.id}`,
              {
                method: "DELETE",
              },
            );
          const body =
            (await response.json()) as ApiResponse<ProjectMember>;

          tester.expect(
            response.status,
          ).toBe(200);
          tester.expect(
            body.data?.user.id,
          ).toBe(member.id);

          const membership =
            await projectMembershipsStore
              .getMembership(
                project.id,
                member.id,
              );

          tester.expect(
            membership,
          ).toBe(null);
        } finally {
          await closeServer(server);
        }
      },
    );

    tester.it(
      "does not allow the project owner to be removed",
      async () => {
        const testServer =
          await createTestServer();
        const {
          baseUrl,
          server,
        } = testServer;

        try {
          const {
            owner,
            ownerCookie,
            project,
          } = await createOwnerProject(
            testServer,
          );

          const response =
            await requestWithCookie(
              baseUrl,
              ownerCookie,
              `/api/projects/${project.id}/members/${owner.id}`,
              {
                method: "DELETE",
              },
            );
          const body =
            (await response.json()) as ApiResponse<unknown>;

          tester.expect(
            response.status,
          ).toBe(409);
          tester.expect(
            body.error,
          ).toBe(
            "Project owner cannot be removed.",
          );
        } finally {
          await closeServer(server);
        }
      },
    );
  },
);
