import {
  isInvitationSessionState,
  type InvitationSessionState,
  type InvitationSessionStore,
} from "@hugovela/frontend-core";

export type InvitationSession = InvitationSessionState;
export type { InvitationSessionStore };

type BrowserSessionStorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

const INVITATION_SESSION_KEY = "grooveshare:invitation-session";

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
      return isInvitationSessionState(parsedValue) ? parsedValue : null;
    } catch {
      return null;
    }
  }

  function save(session: InvitationSession): void {
    try {
      storage.setItem(INVITATION_SESSION_KEY, JSON.stringify(session));
    } catch {
      // Invitation state is convenience state. The initial invitation route
      // still works when sessionStorage is blocked.
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

  return { get, save, setPendingContributor, clear };
}

export function getBrowserInvitationSessionStore(): InvitationSessionStore | null {
  if (typeof globalThis.sessionStorage === "undefined") {
    return null;
  }

  return createBrowserInvitationSessionStore(globalThis.sessionStorage);
}
