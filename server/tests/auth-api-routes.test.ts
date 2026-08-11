import type http from "node:http";
import { verifyPassword } from "../src/auth/password.js";
import type { User } from "../src/auth/types.js";
import { createAppServer } from "../src/app.js";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type { UsersStore } from "../src/stores/users-store.js";
import { createTestUsersStore } from "./helpers/create-test-users-store.js";
import {
    hashSessionToken,
} from "../src/auth/session.js";
import type { SessionsStore } from "../src/stores/sessions-store.js";
import { createTestSessionsStore } from "./helpers/create-test-sessions-store.js";

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
    sessionsStore: SessionsStore;
}> {
    const usersStore =
        createTestUsersStore();

    const sessionsStore =
        createTestSessionsStore();

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
        sessionsStore,
        clientOrigin: "http://localhost:5173",
    });

    const baseUrl =
        await listenOnRandomPort(server);

    return {
        baseUrl,
        server,
        usersStore,
        sessionsStore,
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

function getSessionTokenFromSetCookie(
    setCookie: string,
): string {
    const cookiePair =
        setCookie.split(";")[0];

    const separatorIndex =
        cookiePair.indexOf("=");

    if (separatorIndex === -1) {
        throw new Error(
            "Session cookie did not contain a value.",
        );
    }

    return cookiePair.slice(
        separatorIndex + 1,
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

    tester.it(
        "creates a server session when login succeeds",
        async () => {
            const {
                baseUrl,
                server,
                sessionsStore,
            } = await createTestServer();

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
                                "My Long Password 123!",
                        }),
                    },
                );

                const setCookie =
                    response.headers.get(
                        "set-cookie",
                    );

                tester.expect(
                    typeof setCookie,
                ).toBe("string");

                if (!setCookie) {
                    throw new Error(
                        "Login did not set a session cookie.",
                    );
                }

                tester.expect(
                    setCookie.includes("HttpOnly"),
                ).toBe(true);

                tester.expect(
                    setCookie.includes(
                        "SameSite=Lax",
                    ),
                ).toBe(true);

                const sessionToken =
                    getSessionTokenFromSetCookie(
                        setCookie,
                    );

                const session =
                    await sessionsStore
                        .getSessionByTokenHash(
                            hashSessionToken(
                                sessionToken,
                            ),
                        );

                tester.expect(
                    session !== null,
                ).toBe(true);
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "logs out and deletes the server session",
        async () => {
            const {
                baseUrl,
                server,
                sessionsStore,
            } = await createTestServer();

            try {
                await registerUser(baseUrl);

                const loginResponse =
                    await fetch(
                        `${baseUrl}/api/auth/login`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            body: JSON.stringify({
                                email:
                                    "hugo@example.com",
                                password:
                                    "My Long Password 123!",
                            }),
                        },
                    );

                const setCookie =
                    loginResponse.headers.get(
                        "set-cookie",
                    );

                if (!setCookie) {
                    throw new Error(
                        "Login did not set a session cookie.",
                    );
                }

                const cookiePair =
                    setCookie.split(";")[0];

                const sessionToken =
                    getSessionTokenFromSetCookie(
                        setCookie,
                    );

                const tokenHash =
                    hashSessionToken(
                        sessionToken,
                    );

                const logoutResponse =
                    await fetch(
                        `${baseUrl}/api/auth/logout`,
                        {
                            method: "POST",
                            headers: {
                                Cookie: cookiePair,
                            },
                        },
                    );

                tester.expect(
                    logoutResponse.status,
                ).toBe(200);

                const session =
                    await sessionsStore
                        .getSessionByTokenHash(
                            tokenHash,
                        );

                tester.expect(session).toBe(null);

                const clearedCookie =
                    logoutResponse.headers.get(
                        "set-cookie",
                    );

                tester.expect(
                    clearedCookie?.includes(
                        "Max-Age=0",
                    ),
                ).toBe(true);
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "returns the authenticated user",
        async () => {
            const {
                baseUrl,
                server,
            } = await createTestServer();

            try {
                await registerUser(baseUrl);

                const loginResponse =
                    await fetch(
                        `${baseUrl}/api/auth/login`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            body: JSON.stringify({
                                email:
                                    "hugo@example.com",
                                password:
                                    "My Long Password 123!",
                            }),
                        },
                    );

                const setCookie =
                    loginResponse.headers.get(
                        "set-cookie",
                    );

                if (!setCookie) {
                    throw new Error(
                        "Login did not set a session cookie.",
                    );
                }

                const cookiePair =
                    setCookie.split(";")[0];

                const response = await fetch(
                    `${baseUrl}/api/auth/me`,
                    {
                        headers: {
                            Cookie: cookiePair,
                        },
                    },
                );

                const body =
                    (await response.json()) as ApiResponse<User>;

                tester.expect(response.status).toBe(200);
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
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "rejects a current-user request without a session",
        async () => {
            const {
                baseUrl,
                server,
            } = await createTestServer();

            try {
                const response = await fetch(
                    `${baseUrl}/api/auth/me`,
                );

                const body =
                    (await response.json()) as ApiResponse<unknown>;

                tester.expect(response.status).toBe(401);
                tester.expect(body.ok).toBe(false);

                tester.expect(body.error).toBe(
                    "Authentication required.",
                );
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it(
        "rejects an invalid session",
        async () => {
            const {
                baseUrl,
                server,
            } = await createTestServer();

            try {
                const response = await fetch(
                    `${baseUrl}/api/auth/me`,
                    {
                        headers: {
                            Cookie:
                                `session=${"a".repeat(64)}`,
                        },
                    },
                );

                const body =
                    (await response.json()) as ApiResponse<unknown>;

                tester.expect(response.status).toBe(401);
                tester.expect(body.ok).toBe(false);

                tester.expect(body.error).toBe(
                    "Authentication required.",
                );
            } finally {
                await closeServer(server);
            }
        },
    );
});