import { loadEnvFile } from "node:process";
import { createDatabasePool } from "./pool.js";

loadEnvFile();

const pool = createDatabasePool();

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