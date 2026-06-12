import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  ensureProjectUploadDir,
  getProjectUploadDir,
} from "../src/uploads/upload-paths.js";
import { tester } from "./test-runner/tester.js";

const TEST_UPLOAD_ROOT = path.join(process.cwd(), "tests/.tmp/uploads");

async function resetTestUploads(): Promise<void> {
  await rm(TEST_UPLOAD_ROOT, { recursive: true, force: true });
  await mkdir(TEST_UPLOAD_ROOT, { recursive: true });
}

tester.describe("upload path helpers", () => {
  tester.beforeEach(async () => {
    await resetTestUploads();
  });

  tester.it("builds a project-specific upload directory path", () => {
    const uploadDir = getProjectUploadDir({
      uploadRoot: TEST_UPLOAD_ROOT,
      projectId: "project-1",
    });

    tester.expect(uploadDir).toBe(
      path.join(TEST_UPLOAD_ROOT, "projects", "project-1"),
    );
  });

  tester.it("creates the project-specific upload directory", async () => {
    const uploadDir = await ensureProjectUploadDir({
      uploadRoot: TEST_UPLOAD_ROOT,
      projectId: "project-1",
    });

    const stats = await stat(uploadDir);

    tester.expect(stats.isDirectory()).toBe(true);
    tester.expect(uploadDir).toBe(
      path.join(TEST_UPLOAD_ROOT, "projects", "project-1"),
    );
  });

  tester.it("can be called more than once for the same project", async () => {
    await ensureProjectUploadDir({
      uploadRoot: TEST_UPLOAD_ROOT,
      projectId: "project-1",
    });

    const uploadDir = await ensureProjectUploadDir({
      uploadRoot: TEST_UPLOAD_ROOT,
      projectId: "project-1",
    });

    const stats = await stat(uploadDir);

    tester.expect(stats.isDirectory()).toBe(true);
  });
});