import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { createDatabasePool } from "../../src/db/pool.js";

const currentDirectory = path.dirname(
    fileURLToPath(import.meta.url),
);

const serverRoot = path.resolve(
    currentDirectory,
    "../..",
);

loadEnvFile(
    path.join(serverRoot, ".env"),
);

export const postgresTestPool = createDatabasePool({
    database:
        process.env.PGTESTDATABASE ??
        "grooveshare_test",
});

export async function resetPostgresTestDatabase(): Promise<void> {
    await postgresTestPool.query(`
    TRUNCATE TABLE
      project_mix_channels,
      project_memberships,
      tracks,
      projects,
      sessions,
      users
    CASCADE
  `);
}

export async function closePostgresTestDatabase(): Promise<void> {
    await postgresTestPool.end();
}