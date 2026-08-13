import { loadEnvFile } from "node:process";
import { createDatabasePool } from "../db/pool.js";
import { DEFAULT_UPLOAD_ROOT } from "../uploads/upload-paths.js";
import { resetDevelopmentData } from "./reset-development-data.js";

loadEnvFile();

const pool = createDatabasePool();

try {
  await pool.query("SELECT 1");

  await resetDevelopmentData({
    database: pool,
    uploadRoot: DEFAULT_UPLOAD_ROOT,
  });

  console.log(
    "Cleared GrooveShare development database tables and uploaded files.",
  );
} finally {
  await pool.end();
}
