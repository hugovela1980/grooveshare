import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_UPLOAD_ROOT = path.join(__dirname, "../../uploads");

type ProjectUploadPathOptions = {
  uploadRoot?: string;
  projectId: string;
};

export function getProjectUploadDir({
  uploadRoot = DEFAULT_UPLOAD_ROOT,
  projectId,
}: ProjectUploadPathOptions): string {
  return path.join(uploadRoot, "projects", projectId);
}

export async function ensureProjectUploadDir({
  uploadRoot = DEFAULT_UPLOAD_ROOT,
  projectId,
}: ProjectUploadPathOptions): Promise<string> {
  const uploadDir = getProjectUploadDir({
    uploadRoot,
    projectId,
  });

  await mkdir(uploadDir, { recursive: true });

  return uploadDir;
}