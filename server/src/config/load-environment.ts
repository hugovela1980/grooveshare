import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

export function loadLocalEnvironmentFile(
  envFilePath = path.resolve(".env"),
): boolean {
  if (!existsSync(envFilePath)) {
    return false;
  }

  loadEnvFile(envFilePath);
  return true;
}
