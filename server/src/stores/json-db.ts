import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_DB_FILE_PATH = path.join(__dirname, "../../data/db.json");

export async function readDatabase(dbFilePath: string): Promise<Database> {
  const fileContents = await readFile(dbFilePath, "utf-8");
  return JSON.parse(fileContents) as Database;
}

export async function writeDatabase(
  dbFilePath: string,
  database: Database,
): Promise<void> {
  const json = JSON.stringify(database, null, 2);
  await writeFile(dbFilePath, `${json}\n`, "utf-8");
}