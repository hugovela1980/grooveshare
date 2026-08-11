import type {
    CreateSessionInput,
    Session,
} from "../../src/auth/types.js";
import type { SessionsStore } from "../../src/stores/sessions-store.js";

export function createTestSessionsStore(): SessionsStore {
    const sessions: Session[] = [];

    async function createSession(
        sessionInput: CreateSessionInput,
    ): Promise<Session> {
        const session: Session = {
            id: crypto.randomUUID(),
            userId: sessionInput.userId,
            tokenHash:
                sessionInput.tokenHash,
            createdAt:
                new Date().toISOString(),
            expiresAt:
                sessionInput.expiresAt,
        };

        sessions.push(session);

        return session;
    }

    async function getSessionByTokenHash(
        tokenHash: string,
    ): Promise<Session | null> {
        const now = Date.now();

        return (
            sessions.find((session) => {
                return (
                    session.tokenHash === tokenHash &&
                    new Date(
                        session.expiresAt,
                    ).getTime() > now
                );
            }) ?? null
        );
    }

    async function deleteSessionByTokenHash(
        tokenHash: string,
    ): Promise<boolean> {
        const index =
            sessions.findIndex((session) => {
                return session.tokenHash === tokenHash;
            });

        if (index === -1) {
            return false;
        }

        sessions.splice(index, 1);

        return true;
    }

    return {
        createSession,
        getSessionByTokenHash,
        deleteSessionByTokenHash,
    };
}