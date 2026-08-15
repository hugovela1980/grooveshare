import { loadLocalEnvironmentFile } from "./load-environment.js";
import { createServerConfig } from "./server-config.js";

loadLocalEnvironmentFile();

try {
  const config = createServerConfig();

  console.log("GrooveShare server configuration is valid.");
  console.log({
    nodeEnv: config.nodeEnv,
    host: config.host,
    port: config.port,
    clientOrigin: config.clientOrigin,
    uploadRoot: config.uploadRoot,
    database: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
    },
    secureCookies: config.secureCookies,
    developmentRoutesEnabled: config.developmentRoutesEnabled,
  });
} catch (error) {
  console.error("GrooveShare server configuration is invalid.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
