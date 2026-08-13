import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  RESET_DEVELOPMENT_DATA_SQL,
  resetDevelopmentData,
} from "../src/dev/reset-development-data.js";
import { tester } from "./test-runner/tester.js";

const TEST_UPLOAD_ROOT = path.join(
  process.cwd(),
  "tests/.tmp/reset-development-data/uploads",
);

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

tester.describe("development data reset", () => {
  tester.it("truncates all application tables and clears uploaded files", async () => {
    const queries: string[] = [];
    const uploadedFile = path.join(TEST_UPLOAD_ROOT, "project", "track.wav");

    await rm(TEST_UPLOAD_ROOT, { recursive: true, force: true });
    await mkdir(path.dirname(uploadedFile), { recursive: true });
    await writeFile(uploadedFile, "audio", "utf-8");

    await resetDevelopmentData({
      database: {
        async query(sql: string) {
          queries.push(sql);
          return undefined;
        },
      },
      uploadRoot: TEST_UPLOAD_ROOT,
      nodeEnv: "development",
    });

    tester.expect(queries).toEqual([RESET_DEVELOPMENT_DATA_SQL]);
    tester.expect(await exists(uploadedFile)).toBe(false);
    tester.expect(await exists(TEST_UPLOAD_ROOT)).toBe(true);
  });

  tester.it("requires the development environment before resetting data", async () => {
    let queryCount = 0;
    let errorMessage = "";

    try {
      await resetDevelopmentData({
        database: {
          async query() {
            queryCount += 1;
            return undefined;
          },
        },
        uploadRoot: TEST_UPLOAD_ROOT,
        nodeEnv: "production",
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    tester.expect(queryCount).toBe(0);
    tester.expect(errorMessage).toBe(
      "Development database reset requires NODE_ENV=development.",
    );
  });
});
