import type { StoredUser } from "../../src/auth/types.js";
import {
    createSessionToken,
    hashSessionToken,
    SESSION_COOKIE_NAME,
    SESSION_DURATION_MS,
} from "../../src/auth/session.js";
import type { SessionsStore } from "../../src/stores/sessions-store.js";
import type { UsersStore } from "../../src/stores/users-store.js";

type CreateAuthenticatedTestSessionOptions = {
    usersStore: UsersStore;
    sessionsStore: SessionsStore;
    email?: string;
    displayName?: string;
};

type AuthenticatedTestSession = {
    user: StoredUser;
    cookie: string;
};

export async function createAuthenticatedTestSession({
    usersStore,
    sessionsStore,
    email = "owner@example.com",
    displayName = "Project Owner",
}: CreateAuthenticatedTestSessionOptions):
    Promise<AuthenticatedTestSession> {
    const user =
        await usersStore.createUser({
            email,
            displayName,
            passwordHash:
                "test-password-hash",
        });

    const sessionToken =
        createSessionToken();

    await sessionsStore.createSession({
        userId: user.id,
        tokenHash:
            hashSessionToken(sessionToken),
        expiresAt: new Date(
            Date.now() +
            SESSION_DURATION_MS,
        ).toISOString(),
    });

    return {
        user,
        cookie:
            `${SESSION_COOKIE_NAME}=${sessionToken}`,
    };
}