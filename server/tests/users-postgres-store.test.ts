import { createUsersPostgresStore } from "../src/stores/users-postgres-store.js";
import {
    postgresTestPool,
    resetPostgresTestDatabase,
} from "./db/postgres-test-db.js";
import { tester } from "./test-runner/tester.js";

tester.describe("users PostgreSQL store", () => {
    tester.beforeEach(async () => {
        await resetPostgresTestDatabase();
    });

    tester.it(
        "creates a user and returns the saved user",
        async () => {
            const store =
                createUsersPostgresStore(postgresTestPool);

            const user = await store.createUser({
                email: "hugo@example.com",
                displayName: "Hugo",
                passwordHash: "test-password-hash",
            });

            tester.expect(typeof user.id).toBe("string");

            tester.expect(user.email).toBe(
                "hugo@example.com",
            );

            tester.expect(user.displayName).toBe("Hugo");

            tester.expect(user.passwordHash).toBe(
                "test-password-hash",
            );

            tester.expect(typeof user.createdAt).toBe(
                "string",
            );

            tester.expect(typeof user.updatedAt).toBe(
                "string",
            );
        },
    );

    tester.it(
        "normalizes email addresses before storing them",
        async () => {
            const store =
                createUsersPostgresStore(postgresTestPool);

            const user = await store.createUser({
                email: "  Hugo@Example.COM  ",
                displayName: "Hugo",
                passwordHash: "test-password-hash",
            });

            tester.expect(user.email).toBe(
                "hugo@example.com",
            );
        },
    );

    tester.it(
        "returns a user by email",
        async () => {
            const store =
                createUsersPostgresStore(postgresTestPool);

            const createdUser = await store.createUser({
                email: "hugo@example.com",
                displayName: "Hugo",
                passwordHash: "test-password-hash",
            });

            const foundUser =
                await store.getUserByEmail(
                    "HUGO@EXAMPLE.COM",
                );

            tester.expect(foundUser).toEqual(
                createdUser,
            );
        },
    );

    tester.it(
        "returns null when an email does not exist",
        async () => {
            const store =
                createUsersPostgresStore(postgresTestPool);

            const user = await store.getUserByEmail(
                "missing@example.com",
            );

            tester.expect(user).toBe(null);
        },
    );

    tester.it(
        "returns a user by ID",
        async () => {
            const store =
                createUsersPostgresStore(postgresTestPool);

            const createdUser = await store.createUser({
                email: "hugo@example.com",
                displayName: "Hugo",
                passwordHash: "test-password-hash",
            });

            const foundUser =
                await store.getUserById(createdUser.id);

            tester.expect(foundUser).toEqual(
                createdUser,
            );
        },
    );

    tester.it(
        "returns null when a user ID does not exist",
        async () => {
            const store =
                createUsersPostgresStore(postgresTestPool);

            const user = await store.getUserById(
                "00000000-0000-0000-0000-000000000001",
            );

            tester.expect(user).toBe(null);
        },
    );
});