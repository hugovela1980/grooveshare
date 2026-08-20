import http from "node:http";
import { createAppServer } from "../src/app.js";
import type { Project, Track } from "../src/types.js";
import type { ProjectsStore } from "../src/stores/projects-store.js";
import type { TracksStore } from "../src/stores/tracks-store.js";
import { createTestUsersStore } from "./helpers/create-test-users-store.js";
import { createTestSessionsStore } from "./helpers/create-test-sessions-store.js";
import { createTestProjectMembershipsStore } from "./helpers/create-test-project-memberships-store.js";
import { createTestProjectInvitationsStore } from "./helpers/create-test-project-invitations-store.js";
import { createAuthenticatedTestSession } from "./helpers/create-authenticated-test-session.js";
import { tester } from "./test-runner/tester.js";

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    title: "Role Demo",
    description: "Permission test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createProjectsStore(initialProjects: Project[]): ProjectsStore {
  const projects = [...initialProjects];

  return {
    async getProjects() {
      return [...projects];
    },
    async getProjectById(projectId) {
      return projects.find((project) => project.id === projectId) ?? null;
    },
    async createProject(input) {
      const now = new Date().toISOString();
      const project = createProject({
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description,
        createdAt: now,
        updatedAt: now,
      });
      projects.push(project);
      return project;
    },
    async updateProjectDetails(projectId, input) {
      const project = projects.find((candidate) => candidate.id === projectId);
      if (!project) {
        return null;
      }
      if (input.title !== undefined) {
        project.title = input.title;
      }
      if (input.description !== undefined) {
        project.description = input.description;
      }
      return project;
    },
    async updateProjectMixSettings(projectId, mixSettings) {
      const project = projects.find((candidate) => candidate.id === projectId);
      if (!project) {
        return null;
      }
      project.mixSettings = mixSettings;
      return project;
    },
    async deleteProjectById(projectId) {
      const index = projects.findIndex((project) => project.id === projectId);
      if (index === -1) {
        return { ok: false as const, reason: "project-not-found" as const };
      }
      const [deletedProject] = projects.splice(index, 1);
      if (!deletedProject) {
        return { ok: false as const, reason: "project-not-found" as const };
      }
      return {
        ok: true as const,
        deletedProject,
        deletedTracks: [] as Track[],
      };
    },
  };
}

function createTracksStore(): TracksStore {
  return {
    async getTracksByProjectId() {
      return [];
    },
    async getTrackById() {
      return null;
    },
    async createTrack(input) {
      return {
        id: crypto.randomUUID(),
        name: input.name,
        projectId: input.projectId,
        originalFilename: input.originalFilename,
        filePath: input.filePath,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        uploadedByUserId: input.uploadedByUserId,
        createdAt: new Date().toISOString(),
      };
    },
    async updateTrackDetails() {
      return { ok: false as const, reason: "track-not-found" as const };
    },
    async updateTrackName() {
      return { ok: false as const, reason: "track-not-found" as const };
    },
    async deleteTrackById() {
      return { ok: false as const, reason: "track-not-found" as const };
    },
  };
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test server did not expose a TCP address.");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function close(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

tester.describe("project role API data", () => {
  tester.it("includes the authenticated membership role in the project list", async () => {
    const project = createProject();
    const projectsStore = createProjectsStore([project]);
    const usersStore = createTestUsersStore();
    const sessionsStore = createTestSessionsStore();
    const projectMembershipsStore = createTestProjectMembershipsStore();
    const { user, cookie } = await createAuthenticatedTestSession({
      usersStore,
      sessionsStore,
      email: "viewer@example.com",
      displayName: "Viewer",
    });

    await projectMembershipsStore.createMembership({
      projectId: project.id,
      userId: user.id,
      role: "viewer",
    });

    const server = createAppServer({
      projectsStore,
      tracksStore: createTracksStore(),
      usersStore,
      sessionsStore,
      projectMembershipsStore,
      projectInvitationsStore: createTestProjectInvitationsStore(),
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/projects`, {
        headers: { Cookie: cookie },
      });
      const body = (await response.json()) as {
        data?: Array<Project & { role?: string }>;
      };

      tester.expect(response.status).toBe(200);
      tester.expect(body.data?.[0]?.role).toBe("viewer");
    } finally {
      await close(server);
    }
  });

  tester.it("returns owner role when an authenticated user creates a project", async () => {
    const projectsStore = createProjectsStore([]);
    const usersStore = createTestUsersStore();
    const sessionsStore = createTestSessionsStore();
    const projectMembershipsStore = createTestProjectMembershipsStore();
    const { cookie } = await createAuthenticatedTestSession({
      usersStore,
      sessionsStore,
    });

    const server = createAppServer({
      projectsStore,
      tracksStore: createTracksStore(),
      usersStore,
      sessionsStore,
      projectMembershipsStore,
      projectInvitationsStore: createTestProjectInvitationsStore(),
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Project",
          description: "Created by owner",
        }),
      });
      const body = (await response.json()) as {
        data?: Project & { role?: string };
      };

      tester.expect(response.status).toBe(201);
      tester.expect(body.data?.role).toBe("owner");
    } finally {
      await close(server);
    }
  });

  tester.it("includes the current membership role when reading one project", async () => {
    const project = createProject();
    const projectsStore = createProjectsStore([project]);
    const usersStore = createTestUsersStore();
    const sessionsStore = createTestSessionsStore();
    const projectMembershipsStore = createTestProjectMembershipsStore();
    const { user, cookie } = await createAuthenticatedTestSession({
      usersStore,
      sessionsStore,
      email: "contributor@example.com",
      displayName: "Contributor",
    });

    await projectMembershipsStore.createMembership({
      projectId: project.id,
      userId: user.id,
      role: "contributor",
    });

    const server = createAppServer({
      projectsStore,
      tracksStore: createTracksStore(),
      usersStore,
      sessionsStore,
      projectMembershipsStore,
      projectInvitationsStore: createTestProjectInvitationsStore(),
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/projects/${project.id}`, {
        headers: { Cookie: cookie },
      });
      const body = (await response.json()) as {
        data?: Project & { role?: string };
      };

      tester.expect(response.status).toBe(200);
      tester.expect(body.data?.role).toBe("contributor");
    } finally {
      await close(server);
    }
  });
});
