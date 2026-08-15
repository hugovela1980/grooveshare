import { createAppServer } from "./app.js";
import { loadLocalEnvironmentFile } from "./config/load-environment.js";
import { createServerConfig } from "./config/server-config.js";
import { createDatabasePool } from "./db/pool.js";
import { resetDevelopmentData } from "./dev/reset-development-data.js";
import { createProjectMembershipsPostgresStore } from "./stores/project-memberships-postgres-store.js";
import { createProjectsPostgresStore } from "./stores/projects-postgres-store.js";
import { createSessionsPostgresStore } from "./stores/sessions-postgres-store.js";
import { createTracksPostgresStore } from "./stores/tracks-postgres-store.js";
import { createUsersPostgresStore } from "./stores/users-postgres-store.js";

loadLocalEnvironmentFile();

const config = createServerConfig();
const pool = createDatabasePool(config.database);

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error.", error);
});

const projectsStore = createProjectsPostgresStore(pool);
const tracksStore = createTracksPostgresStore(pool);
const usersStore = createUsersPostgresStore(pool);
const sessionsStore = createSessionsPostgresStore(pool);
const projectMembershipsStore =
  createProjectMembershipsPostgresStore(pool);

const server = createAppServer({
  projectsStore,
  tracksStore,
  usersStore,
  sessionsStore,
  projectMembershipsStore,
  clientOrigin: config.clientOrigin,
  uploadRoot: config.uploadRoot,
  secureCookies: config.secureCookies,
  developmentRoutesEnabled: config.developmentRoutesEnabled,
  resetDevelopmentData: config.developmentRoutesEnabled
    ? () =>
        resetDevelopmentData({
          database: pool,
          uploadRoot: config.uploadRoot,
          nodeEnv: config.nodeEnv,
        })
    : undefined,
});

try {
  await pool.query("SELECT 1");

  server.listen(config.port, config.host, () => {
    console.log(
      `GrooveShare API listening on ${config.host}:${config.port} (${config.nodeEnv}).`,
    );
  });
} catch (error) {
  console.error("Could not connect to PostgreSQL.", error);

  await pool.end();
  process.exitCode = 1;
}
