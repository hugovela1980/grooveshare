import path from "node:path";
import type { PoolConfig } from "pg";
import { DEFAULT_UPLOAD_ROOT } from "../uploads/upload-paths.js";

export type NodeEnvironment =
  | "development"
  | "test"
  | "production";

export type GrooveShareDatabaseConfig = Pick<
  PoolConfig,
  "host" | "port" | "database" | "user" | "password"
>;

export type ServerConfig = {
  nodeEnv: NodeEnvironment;
  host: string;
  port: number;
  clientOrigin: string;
  uploadRoot: string;
  database: GrooveShareDatabaseConfig;
  secureCookies: boolean;
  developmentRoutesEnabled: boolean;
};

const DEFAULT_SERVER_PORT = 3000;
const DEFAULT_SERVER_HOST = "127.0.0.1";
const DEFAULT_POSTGRES_PORT = 5432;
const DEFAULT_CLIENT_ORIGIN = "http://localhost:5173";
const DEFAULT_DATABASE_HOST = "localhost";
const DEFAULT_DATABASE_NAME = "grooveshare_dev";
const DEFAULT_DATABASE_USER = "grooveshare_app";

function readTrimmed(
  env: NodeJS.ProcessEnv,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function readRequired(
  env: NodeJS.ProcessEnv,
  key: string,
): string {
  const value = readTrimmed(env, key);

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}.`,
    );
  }

  return value;
}

function parsePositiveInteger(
  rawValue: string,
  key: string,
): number {
  const parsed = Number(rawValue);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0 ||
    parsed > 65535
  ) {
    throw new Error(
      `${key} must be an integer between 1 and 65535.`,
    );
  }

  return parsed;
}

function parseNodeEnvironment(
  rawValue: string | undefined,
): NodeEnvironment {
  const value = rawValue?.trim() || "development";

  if (
    value !== "development" &&
    value !== "test" &&
    value !== "production"
  ) {
    throw new Error(
      "NODE_ENV must be development, test, or production.",
    );
  }

  return value;
}

function normalizeOrigin(
  rawValue: string,
  key: string,
): string {
  let url: URL;

  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`${key} must be a valid absolute URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${key} must use http or https.`);
  }

  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      `${key} must contain only an origin, without a path, query, hash, or credentials.`,
    );
  }

  return url.origin;
}

export function createDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): GrooveShareDatabaseConfig {
  const nodeEnv = parseNodeEnvironment(env.NODE_ENV);
  const isProduction = nodeEnv === "production";

  const host = isProduction
    ? readRequired(env, "PGHOST")
    : readTrimmed(env, "PGHOST") ?? DEFAULT_DATABASE_HOST;

  const portText = isProduction
    ? readRequired(env, "PGPORT")
    : readTrimmed(env, "PGPORT") ?? String(DEFAULT_POSTGRES_PORT);

  const database = isProduction
    ? readRequired(env, "PGDATABASE")
    : readTrimmed(env, "PGDATABASE") ?? DEFAULT_DATABASE_NAME;

  const user = isProduction
    ? readRequired(env, "PGUSER")
    : readTrimmed(env, "PGUSER") ?? DEFAULT_DATABASE_USER;

  const password = readRequired(env, "PGPASSWORD");

  return {
    host,
    port: parsePositiveInteger(portText, "PGPORT"),
    database,
    user,
    password,
  };
}

export function createServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const nodeEnv = parseNodeEnvironment(env.NODE_ENV);
  const host = readTrimmed(env, "HOST") ?? DEFAULT_SERVER_HOST;
  const isProduction = nodeEnv === "production";

  const portText = isProduction
    ? readRequired(env, "PORT")
    : readTrimmed(env, "PORT") ?? String(DEFAULT_SERVER_PORT);

  const clientOrigin = normalizeOrigin(
    isProduction
      ? readRequired(env, "CLIENT_ORIGIN")
      : readTrimmed(env, "CLIENT_ORIGIN") ?? DEFAULT_CLIENT_ORIGIN,
    "CLIENT_ORIGIN",
  );

  const configuredUploadRoot = readTrimmed(env, "UPLOAD_ROOT");

  if (isProduction && !configuredUploadRoot) {
    throw new Error(
      "Missing required environment variable: UPLOAD_ROOT.",
    );
  }

  if (
    isProduction &&
    configuredUploadRoot &&
    !path.isAbsolute(configuredUploadRoot)
  ) {
    throw new Error(
      "UPLOAD_ROOT must be an absolute path in production.",
    );
  }

  const uploadRoot = configuredUploadRoot
    ? path.resolve(configuredUploadRoot)
    : DEFAULT_UPLOAD_ROOT;

  return {
    nodeEnv,
    host,
    port: parsePositiveInteger(portText, "PORT"),
    clientOrigin,
    uploadRoot,
    database: createDatabaseConfig(env),
    secureCookies: isProduction,
    developmentRoutesEnabled: !isProduction,
  };
}
