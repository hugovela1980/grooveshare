import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";

export const PROJECT_INVITATION_HEADER = "x-grooveshare-invite";

export function createProjectInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashProjectInvitationToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function getProjectInvitationToken(
  req: IncomingMessage,
): string | null {
  const headerValue = req.headers[PROJECT_INVITATION_HEADER];

  if (typeof headerValue !== "string") {
    return null;
  }

  const token = headerValue.trim();

  return token.length > 0 ? token : null;
}
