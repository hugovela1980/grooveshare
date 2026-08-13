import { copyFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../auth/password.js";
import type { ProjectMembershipsStore, ProjectRole } from "../stores/project-memberships-store.js";
import type { ProjectsStore } from "../stores/projects-store.js";
import type { TracksStore } from "../stores/tracks-store.js";
import type { UsersStore } from "../stores/users-store.js";
import type { Project, Track } from "../types.js";
import {
  ensureProjectUploadDir,
  getProjectUploadDir,
} from "../uploads/upload-paths.js";

export const DEV_AUTHORIZATION_PROJECT_TITLE = "Authorization Role Demo";

export type DevAuthorizationAccount = {
  role: ProjectRole;
  email: string;
  displayName: string;
  password: string;
  userId: string;
};

export type DevAuthorizationSeedResult = {
  project: Project;
  tracks: Track[];
  accounts: DevAuthorizationAccount[];
};

type DevAuthorizationAccountDefinition = {
  role: ProjectRole;
  email: string;
  displayName: string;
  password: string;
};

type SeedAuthorizationScenarioOptions = {
  filenames: string[];
  seedProjectDir: string;
  uploadRoot: string;
  projectsStore: ProjectsStore;
  tracksStore: TracksStore;
  usersStore: UsersStore;
  projectMembershipsStore: ProjectMembershipsStore;
};

export const DEV_AUTHORIZATION_ACCOUNT_DEFINITIONS:
  readonly DevAuthorizationAccountDefinition[] = [
    {
      role: "owner",
      email: "dev-owner@grooveshare.local",
      displayName: "Dev Owner",
      password: "GrooveShare Dev Owner 123!",
    },
    {
      role: "contributor",
      email: "dev-contributor@grooveshare.local",
      displayName: "Dev Contributor",
      password: "GrooveShare Dev Contributor 123!",
    },
    {
      role: "viewer",
      email: "dev-viewer@grooveshare.local",
      displayName: "Dev Viewer",
      password: "GrooveShare Dev Viewer 123!",
    },
  ];

function getMimeTypeForFilename(filename: string): string {
  const extension = path.extname(filename).toLowerCase();

  if (extension === ".wav") {
    return "audio/wav";
  }

  if (extension === ".mp3") {
    return "audio/mpeg";
  }

  if (extension === ".ogg") {
    return "audio/ogg";
  }

  if (extension === ".webm") {
    return "audio/webm";
  }

  if (extension === ".flac") {
    return "audio/flac";
  }

  if (extension === ".aac") {
    return "audio/aac";
  }

  if (extension === ".m4a") {
    return "audio/mp4";
  }

  return "application/octet-stream";
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function removeExistingAuthorizationSeedProjects({
  projectsStore,
  uploadRoot,
}: {
  projectsStore: ProjectsStore;
  uploadRoot: string;
}): Promise<void> {
  const projects = await projectsStore.getProjects();
  const existingSeedProjects = projects.filter((project) => {
    return project.title === DEV_AUTHORIZATION_PROJECT_TITLE;
  });

  for (const project of existingSeedProjects) {
    const result = await projectsStore.deleteProjectById(project.id);

    if (!result.ok) {
      throw new Error(
        `Could not replace authorization seed project ${project.id}.`,
      );
    }

    await rm(
      getProjectUploadDir({
        uploadRoot,
        projectId: project.id,
      }),
      {
        recursive: true,
        force: true,
      },
    );
  }
}

async function getOrCreateDevAccount(
  accountDefinition: DevAuthorizationAccountDefinition,
  usersStore: UsersStore,
): Promise<DevAuthorizationAccount> {
  const existingUser = await usersStore.getUserByEmail(
    accountDefinition.email,
  );

  const user = existingUser ?? await usersStore.createUser({
    email: accountDefinition.email,
    displayName: accountDefinition.displayName,
    passwordHash: await hashPassword(accountDefinition.password),
  });

  return {
    role: accountDefinition.role,
    email: accountDefinition.email,
    displayName: accountDefinition.displayName,
    password: accountDefinition.password,
    userId: user.id,
  };
}

export async function seedAuthorizationScenario({
  filenames,
  seedProjectDir,
  uploadRoot,
  projectsStore,
  tracksStore,
  usersStore,
  projectMembershipsStore,
}: SeedAuthorizationScenarioOptions): Promise<DevAuthorizationSeedResult> {
  if (filenames.length < 2) {
    throw new Error(
      "Authorization seed requires at least two audio files.",
    );
  }

  await removeExistingAuthorizationSeedProjects({
    projectsStore,
    uploadRoot,
  });

  const accounts: DevAuthorizationAccount[] = [];

  for (const accountDefinition of DEV_AUTHORIZATION_ACCOUNT_DEFINITIONS) {
    accounts.push(
      await getOrCreateDevAccount(
        accountDefinition,
        usersStore,
      ),
    );
  }

  const owner = accounts.find((account) => account.role === "owner");
  const contributor = accounts.find(
    (account) => account.role === "contributor",
  );

  if (!owner || !contributor) {
    throw new Error("Authorization seed accounts could not be created.");
  }

  const project = await projectsStore.createProject({
    title: DEV_AUTHORIZATION_PROJECT_TITLE,
    description:
      "Development project seeded with Owner, Contributor, and Viewer roles.",
  });

  for (const account of accounts) {
    await projectMembershipsStore.createMembership({
      projectId: project.id,
      userId: account.userId,
      role: account.role,
    });
  }

  const uploadDir = await ensureProjectUploadDir({
    uploadRoot,
    projectId: project.id,
  });

  const tracks: Track[] = [];

  for (const [index, filename] of filenames.entries()) {
    const sourceFilePath = path.join(seedProjectDir, filename);
    const sourceFileStats = await stat(sourceFilePath);
    const storedFilename = `${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
    const destinationFilePath = path.join(uploadDir, storedFilename);

    await copyFile(sourceFilePath, destinationFilePath);

    const uploadedByUserId = index % 2 === 0
      ? owner.userId
      : contributor.userId;

    const track = await tracksStore.createTrack({
      projectId: project.id,
      name: path.parse(filename).name,
      originalFilename: filename,
      filePath: path.relative(process.cwd(), destinationFilePath),
      mimeType: getMimeTypeForFilename(filename),
      fileSize: sourceFileStats.size,
      uploadedByUserId,
    });

    tracks.push(track);
  }

  return {
    project,
    tracks,
    accounts,
  };
}
