import { loadLocalEnvironmentFile } from "../config/load-environment.js";
import { createDatabaseConfig } from "../config/server-config.js";
import { createDatabasePool } from "./pool.js";

loadLocalEnvironmentFile();

const pool = createDatabasePool(
  createDatabaseConfig(),
);

try {
  const result = await pool.query(`
    SELECT
      current_database() AS "databaseName",
      current_user AS "userName",
      NOW() AS "serverTime"
  `);

  console.log("PostgreSQL connection successful.");
  console.log(result.rows[0]);
} catch (error) {
  console.error("PostgreSQL connection failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
