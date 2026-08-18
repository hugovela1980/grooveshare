export type InvitationSession = {
  projectId: string;
  token: string;
  pendingContributor: boolean;
};

export type InvitationSessionStore = {
  get(): InvitationSession | null;
  save(session: InvitationSession): void;
  setPendingContributor(pending: boolean): void;
  clear(): void;
};

type BrowserSessionStorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

const INVITATION_SESSION_KEY = "grooveshare:invitation-session";

function isInvitationSession(value: unknown): value is InvitationSession {
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

export function createBrowserInvitationSessionStore(
  storage: BrowserSessionStorageLike,
): InvitationSessionStore {
  function get(): InvitationSession | null {
    try {
      const rawValue = storage.getItem(INVITATION_SESSION_KEY);

      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue) as unknown;
      return isInvitationSession(parsedValue) ? parsedValue : null;
    } catch {
      return null;
    }
  }

  function save(session: InvitationSession): void {
    try {
      storage.setItem(INVITATION_SESSION_KEY, JSON.stringify(session));
    } catch {
      // Invitation state is browser-session convenience state. The invitation
      // route still works for the initial page load when storage is blocked.
    }
  }

  function setPendingContributor(pendingContributor: boolean): void {
    const session = get();

    if (!session) {
      return;
    }

    save({
      ...session,
      pendingContributor,
    });
  }

  function clear(): void {
    try {
      storage.removeItem(INVITATION_SESSION_KEY);
    } catch {
      // A blocked storage implementation has no persistent state to clear.
    }
  }

  return {
    get,
    save,
    setPendingContributor,
    clear,
  };
}

export function getBrowserInvitationSessionStore(): InvitationSessionStore | null {
  if (typeof globalThis.sessionStorage === "undefined") {
    return null;
  }

  return createBrowserInvitationSessionStore(globalThis.sessionStorage);
}
