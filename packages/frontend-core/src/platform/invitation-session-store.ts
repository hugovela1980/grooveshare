import type { InvitationSessionState } from "../application/application-state.js";

export type InvitationSessionStore = {
  get(): InvitationSessionState | null;
  save(session: InvitationSessionState): void;
  setPendingContributor(pending: boolean): void;
  clear(): void;
};

export function isInvitationSessionState(
  value: unknown,
): value is InvitationSessionState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.projectId === "string" &&
    candidate.projectId.length > 0 &&
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.pendingContributor === "boolean"
  );
}
