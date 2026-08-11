import { createSessionsPostgresStore } from "../src/stores/sessions-postgres-store.js";
import { createUsersPostgresStore } from "../src/stores/users-postgres-store.js";
import {
    postgresTestPool,
    resetPostgresTestDatabase,
} from "./db/postgres-test-db.js";
import { tester } from "./test-runner/tester.js";

async function createTestUser() {
    const usersStore =
        createUsersPostgresStore(postgresTestPool);

    return usersStore.createUser({
        email: "session-user@example.com",
        displayName: "Session User",
        passwordHash: "test-password-hash",
    });
}

tester.describe("sessions PostgreSQL store", () => {
    tester.beforeEach(async () => {
        await resetPostgresTestDatabase();
    });

    tester.it(
        "creates and returns a session",
        async () => {
            const user = await createTestUser();

            const store =
                createSessionsPostgresStore(
                    postgresTestPool,
                );

            const expiresAt =
                new Date(
                    Date.now() + 60_000,
                ).toISOString();

            const session =
                await store.createSession({
                    userId: user.id,
                    tokenHash: "test-token-hash",
                    expiresAt,
                });

            tester.expect(typeof session.id).toBe(
                "string",
            );

            tester.expect(session.userId).toBe(
                user.id,
            );

            tester.expect(session.tokenHash).toBe(
                "test-token-hash",
            );

            tester.expect(typeof session.createdAt).toBe(
                "string",
            );

            tester.expect(session.expiresAt).toBe(
                expiresAt,
            );
        },
    );

    tester.it(
        "returns an active session by token hash",
        async () => {
            const user = await createTestUser();

            const store =
                createSessionsPostgresStore(
                    postgresTestPool,
                );

            const createdSession =
                await store.createSession({
                    userId: user.id,
                    tokenHash: "find-this-token",
                    expiresAt: new Date(
                        Date.now() + 60_000,
                    ).toISOString(),
                });

            const foundSession =
                await store.getSessionByTokenHash(
                    "find-this-token",
                );

            tester.expect(foundSession).toEqual(
                createdSession,
            );
        },
    );

    tester.it(
        "does not return an expired session",
        async () => {
            const user = await createTestUser();

            const store =
                createSessionsPostgresStore(
                    postgresTestPool,
                );

            await store.createSession({
                userId: user.id,
                tokenHash: "expired-token",
                expiresAt: new Date(
                    Date.now() - 60_000,
                ).toISOString(),
            });

            const session =
                await store.getSessionByTokenHash(
                    "expired-token",
                );

            tester.expect(session).toBe(null);
        },
    );

    tester.it(
        "deletes a session by token hash",
        async () => {
            const user = await createTestUser();

            const store =
                createSessionsPostgresStore(
                    postgresTestPool,
                );

            await store.createSession({
                userId: user.id,
                tokenHash: "delete-this-token",
                expiresAt: new Date(
                    Date.now() + 60_000,
                ).toISOString(),
            });

            const deleted =
                await store.deleteSessionByTokenHash(
                    "delete-this-token",
                );

            tester.expect(deleted).toBe(true);

            const session =
                await store.getSessionByTokenHash(
                    "delete-this-token",
                );

            tester.expect(session).toBe(null);
        },
    );
});