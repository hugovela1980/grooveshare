import type http from "node:http";
import { verifyPassword } from "../src/auth/password.js";
import type { User } from "../src/auth/types.js";
import { createAppServer } from "../src/app.js";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type { UsersStore } from "../src/stores/users-store.js";
import { createTestUsersStore } from "./helpers/create-test-users-store.js";
import { tester } from "./test-runner/tester.js";

type ApiResponse<T> = {
    ok: boolean;
    data?: T;
    error?: string;
};

function listenOnRandomPort(
    server: http.Server,
): Promise<string> {
    return new Promise((resolve) => {
        server.listen(0, () => {
            const address = server.address();

            if (!address || typeof address === "string") {
                throw new Error(
                    "Could not determine test server address.",
                );
            }

            resolve(
                `http://localhost:${address.port}`,
            );
        });
    });
}

function closeServer(
    server: http.Server,
): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function createTestServer(): Promise<{
    baseUrl: string;
    server: http.Server;
    usersStore: UsersStore;
}> {
    const usersStore = createTestUsersStore();

    const projectsStore =
        createProjectsJsonStore(
            "tests/.tmp/auth-projects-db.json",
        );

    const tracksStore =
        createTracksJsonStore(
            "tests/.tmp/auth-projects-db.json",
        );

    const server = createAppServer({
        projectsStore,
        tracksStore,
        usersStore,
        clientOrigin: "http://localhost:5173",
    });

    const baseUrl =
        await listenOnRandomPort(server);

    return {
        baseUrl,
        server,
        usersStore,
    };
}

async function registerUser(
    baseUrl: string,
): Promise<Response> {
    return fetch(
        `${baseUrl}/api/auth/register`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "Hugo@Example.COM",
                displayName: "Hugo",
                password: "My Long Password 123!",
            }),
        },
    );
}

tester.describe("auth API routes", () => {
    tester.it(
        "registers a user",
        async () => {
            const {
                baseUrl,
                server,
                usersStore,
            } = await createTestServer();

            try {
                const response =
                    await registerUser(baseUrl);

                const body =
                    (await response.json()) as ApiResponse<User>;

                tester.expect(response.status).toBe(201);
                tester.expect(body.ok).toBe(true);

                tester.expect(body.data?.email).toBe(
                    "hugo@example.com",
                );

                tester.expect(body.data?.displayName).toBe(
                    "Hugo",
                );

                tester.expect(
                    "passwordHash" in (body.data ?? {}),
                ).toBe(false);

                const storedUser =
                    await usersStore.getUserByEmail(
                        "hugo@example.com",
                    );

                tester.expect(
                    typeof storedUser?.passwordHash,
                ).toBe("string");

                if (!storedUser) {
                    throw new Error(
                        "Expected registered user to be stored.",
                    );
                }

                const passwordIsValid =
                    await verifyPassword(
                        "My Long Password 123!",
                        storedUser.passwordHash,
                    );

                tester.expect(passwordIsValid).toBe(true);
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "rejects duplicate email registration",
        async () => {
            const { baseUrl, server } =
                await createTestServer();

            try {
                await registerUser(baseUrl);

                const response =
                    await registerUser(baseUrl);

                const body =
                    (await response.json()) as ApiResponse<unknown>;

                tester.expect(response.status).toBe(409);
                tester.expect(body.ok).toBe(false);

                tester.expect(body.error).toBe(
                    "An account with that email already exists.",
                );
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "rejects a registration password that is too short",
        async () => {
            const { baseUrl, server } =
                await createTestServer();

            try {
                const response = await fetch(
                    `${baseUrl}/api/auth/register`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            email: "hugo@example.com",
                            displayName: "Hugo",
                            password: "too-short",
                        }),
                    },
                );

                const body =
                    (await response.json()) as ApiResponse<unknown>;

                tester.expect(response.status).toBe(400);
                tester.expect(body.ok).toBe(false);
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "logs in with valid credentials",
        async () => {
            const { baseUrl, server } =
                await createTestServer();

            try {
                await registerUser(baseUrl);

                const response = await fetch(
                    `${baseUrl}/api/auth/login`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            email: "HUGO@example.com",
                            password:
                                "My Long Password 123!",
                        }),
                    },
                );

                const body =
                    (await response.json()) as ApiResponse<User>;

                tester.expect(response.status).toBe(200);
                tester.expect(body.ok).toBe(true);

                tester.expect(body.data?.email).toBe(
                    "hugo@example.com",
                );

                tester.expect(
                    "passwordHash" in (body.data ?? {}),
                ).toBe(false);
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "rejects an incorrect password",
        async () => {
            const { baseUrl, server } =
                await createTestServer();

            try {
                await registerUser(baseUrl);

                const response = await fetch(
                    `${baseUrl}/api/auth/login`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            email: "hugo@example.com",
                            password:
                                "This Password Is Wrong",
                        }),
                    },
                );

                const body =
                    (await response.json()) as ApiResponse<unknown>;

                tester.expect(response.status).toBe(401);
                tester.expect(body.ok).toBe(false);

                tester.expect(body.error).toBe(
                    "Invalid email or password.",
                );
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "rejects login for an unknown email",
        async () => {
            const { baseUrl, server } =
                await createTestServer();

            try {
                const response = await fetch(
                    `${baseUrl}/api/auth/login`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            email: "missing@example.com",
                            password:
                                "My Long Password 123!",
                        }),
                    },
                );

                const body =
                    (await response.json()) as ApiResponse<unknown>;

                tester.expect(response.status).toBe(401);

                tester.expect(body.error).toBe(
                    "Invalid email or password.",
                );
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "rejects malformed registration JSON",
        async () => {
            const { baseUrl, server } =
                await createTestServer();

            try {
                const response = await fetch(
                    `${baseUrl}/api/auth/register`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: "{not-valid-json",
                    },
                );

                const body =
                    (await response.json()) as ApiResponse<unknown>;

                tester.expect(response.status).toBe(400);
                tester.expect(body.ok).toBe(false);
            } finally {
                await closeServer(server);
            }
        },
    );
});