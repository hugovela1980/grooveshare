import { loadEnvFile } from "node:process";
import { createAppServer } from "./app.js";
import { createDatabasePool } from "./db/pool.js";
import { createProjectsPostgresStore } from "./stores/projects-postgres-store.js";
import { createTracksPostgresStore } from "./stores/tracks-postgres-store.js";
import { createUsersPostgresStore } from "./stores/users-postgres-store.js";
import { createSessionsPostgresStore } from "./stores/sessions-postgres-store.js";
import { createProjectMembershipsPostgresStore } from "./stores/project-memberships-postgres-store.js";
import { resetDevelopmentData } from "./dev/reset-development-data.js";
import { DEFAULT_UPLOAD_ROOT } from "./uploads/upload-paths.js";

loadEnvFile();

const PORT = 3000;

const pool = createDatabasePool();

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error.", error);
});

const projectsStore =
  createProjectsPostgresStore(pool);

const tracksStore =
  createTracksPostgresStore(pool);

const usersStore =
  createUsersPostgresStore(pool);

const sessionsStore =
  createSessionsPostgresStore(pool);

const projectMembershipsStore =
  createProjectMembershipsPostgresStore(
    pool,
  );

const server = createAppServer({
  projectsStore,
  tracksStore,
  usersStore,
  sessionsStore,
  projectMembershipsStore,
  resetDevelopmentData: () => resetDevelopmentData({
    database: pool,
    uploadRoot: DEFAULT_UPLOAD_ROOT,
  }),
});

try {
  await pool.query("SELECT 1");

  server.listen(PORT, () => {
    console.log(`GrooveShare API running at http://localhost:${PORT}`);
  });
} catch (error) {
  console.error("Could not connect to PostgreSQL.", error);

  await pool.end();
  process.exitCode = 1;
}