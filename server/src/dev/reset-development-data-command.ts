import { loadLocalEnvironmentFile } from "../config/load-environment.js";
import { createServerConfig } from "../config/server-config.js";
import { createDatabasePool } from "../db/pool.js";
import { resetDevelopmentData } from "./reset-development-data.js";

loadLocalEnvironmentFile();

const config = createServerConfig();

if (!config.developmentRoutesEnabled) {
  throw new Error(
    "Development database reset is disabled in production.",
  );
}

const pool = createDatabasePool(config.database);

try {
  await pool.query("SELECT 1");

  await resetDevelopmentData({
    database: pool,
    uploadRoot: config.uploadRoot,
    nodeEnv: config.nodeEnv,
  });

  console.log(
    "Cleared GrooveShare development database tables and uploaded files.",
  );
} finally {
  await pool.end();
}
