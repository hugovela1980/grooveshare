import { loadLocalEnvironmentFile } from "../config/load-environment.js";
import { createServerConfig } from "../config/server-config.js";
import { createDatabasePool } from "../db/pool.js";
import { createProjectMembershipsPostgresStore } from "../stores/project-memberships-postgres-store.js";
import { createProjectsPostgresStore } from "../stores/projects-postgres-store.js";
import { createTracksPostgresStore } from "../stores/tracks-postgres-store.js";
import { createUsersPostgresStore } from "../stores/users-postgres-store.js";
import {
  seedAuthorizationScenario,
} from "./authorization-seed.js";
import {
  DEFAULT_SEED_PROJECT_DIR,
  getSeedAudioFiles,
} from "./dev-seed-routes.js";

const AUTHORIZATION_SEED_TRACK_LIMIT = 3;

loadLocalEnvironmentFile();

const config = createServerConfig();

if (!config.developmentRoutesEnabled) {
  throw new Error(
    "Authorization development seeding is disabled in production.",
  );
}

const pool = createDatabasePool(config.database);

try {
  await pool.query("SELECT 1");

  const seedFiles = await getSeedAudioFiles(
    DEFAULT_SEED_PROJECT_DIR,
  );

  if (seedFiles.length < 2) {
    throw new Error(
      "Add at least two audio files to server/data/seed-project before seeding the authorization scenario.",
    );
  }

  const result = await seedAuthorizationScenario({
    filenames: seedFiles
      .slice(0, AUTHORIZATION_SEED_TRACK_LIMIT)
      .map((seedFile) => seedFile.filename),
    seedProjectDir: DEFAULT_SEED_PROJECT_DIR,
    uploadRoot: config.uploadRoot,
    projectsStore: createProjectsPostgresStore(pool),
    tracksStore: createTracksPostgresStore(pool),
    usersStore: createUsersPostgresStore(pool),
    projectMembershipsStore:
      createProjectMembershipsPostgresStore(pool),
  });

  console.log("Authorization development scenario created.");
  console.log(`Project: ${result.project.title}`);
  console.log(`Project ID: ${result.project.id}`);
  console.log("");
  console.log("Development accounts:");

  for (const account of result.accounts) {
    console.log(
      `${account.role.padEnd(11)} ${account.email}  password: ${account.password}`,
    );
  }

  console.log("");
  console.log("Seeded tracks:");

  for (const track of result.tracks) {
    const account = result.accounts.find(
      (candidate) => candidate.userId === track.uploadedByUserId,
    );

    console.log(
      `${track.name} -> ${account?.role ?? "unknown"}`,
    );
  }
} finally {
  await pool.end();
}
