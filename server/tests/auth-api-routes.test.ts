import { mkdir, rm, writeFile } from "node:fs/promises";
import type http from "node:http";
import path from "node:path";
import { createAppServer } from "../src/app.js";
import {
    hashSessionToken,
} from "../src/auth/session.js";
import type { User } from "../src/auth/types.js";
import { verifyPassword } from "../src/auth/password.js";
import { createProjectsJsonStore } from "../src/stores/projects-json-store.js";
import { createTracksJsonStore } from "../src/stores/tracks-json-store.js";
import type { SessionsStore } from "../src/stores/sessions-store.js";
import type { UsersStore } from "../src/stores/users-store.js";
import type { Database } from "../src/types.js";
import { createTestProjectMembershipsStore } from "./helpers/create-test-project-memberships-store.js";
import { createTestProjectInvitationsStore } from "./helpers/create-test-project-invitations-store.js";
import { createTestSessionsStore } from "./helpers/create-test-sessions-store.js";
import { createTestUsersStore } from "./helpers/create-test-users-store.js";
import { tester } from "./test-runner/tester.js";

const TEST_DB_DIR = path.join(process.cwd(), "tests/.tmp");
const TEST_DB_FILE_PATH = path.join(TEST_DB_DIR, "auth-api-routes-db.json");
const TEST_UPLOAD_ROOT = path.join(process.cwd(), "tests/.tmp/auth-api-route-uploads");
const CLIENT_ORIGIN = "http://localhost:5173";

const TEST_EMAIL = "hugo@example.com";
const TEST_DISPLAY_NAME = "Hugo";
const TEST_PASSWORD = "My Long Password 123!";

type ApiResponse<T> = {
    ok: boolean;
    data?: T;
    error?: string;
};

async function resetTestDatabase(): Promise<void> {
    const emptyDatabase: Database = {
        projects: [],
        tracks: [],
    };

    await mkdir(TEST_DB_DIR, { recursive: true });
    await writeFile(
        TEST_DB_FILE_PATH,
        `${JSON.stringify(emptyDatabase, null, 2)}\n`,
        "utf-8",
    );

    await rm(TEST_UPLOAD_ROOT, { recursive: true, force: true });
    await mkdir(TEST_UPLOAD_ROOT, { recursive: true });
}

function listenOnRandomPort(server: http.Server): Promise<string> {
    return new Promise((resolve) => {
        server.listen(0, () => {
            const address = server.address();

            if (!address || typeof address === "string") {
                throw new Error("Could not determine test server address.");
            }

            resolve(`http://localhost:${address.port}`);
        });
    });
}

function closeServer(server: http.Server): Promise<void> {
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

async function createTestServer({
    secureCookies = false,
}: {
    secureCookies?: boolean;
} = {}): Promise<{
    baseUrl: string;
    server: http.Server;
    usersStore: UsersStore;
    sessionsStore: SessionsStore;
}> {
    const projectsStore = createProjectsJsonStore(TEST_DB_FILE_PATH);
    const tracksStore = createTracksJsonStore(TEST_DB_FILE_PATH);
    const usersStore = createTestUsersStore();
    const sessionsStore = createTestSessionsStore();
    const projectMembershipsStore = createTestProjectMembershipsStore();

    const server = createAppServer({
        projectsStore,
        tracksStore,
        usersStore,
        sessionsStore,
        projectMembershipsStore,
        projectInvitationsStore: createTestProjectInvitationsStore(),
        clientOrigin: CLIENT_ORIGIN,
        uploadRoot: TEST_UPLOAD_ROOT,
        secureCookies,
    });

    const baseUrl = await listenOnRandomPort(server);

    return {
        baseUrl,
        server,
        usersStore,
        sessionsStore,
    };
}

async function registerUser(baseUrl: string): Promise<Response> {
    return fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email: TEST_EMAIL,
            displayName: TEST_DISPLAY_NAME,
            password: TEST_PASSWORD,
        }),
    });
}

async function loginUser(baseUrl: string): Promise<Response> {
    return fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        }),
    });
}

function getCookiePair(response: Response): string {
    const setCookie = response.headers.get("set-cookie");

    if (!setCookie) {
        throw new Error("Response did not contain a Set-Cookie header.");
    }

    return setCookie.split(";")[0] ?? "";
}

function getSessionTokenFromCookiePair(cookiePair: string): string {
    const separatorIndex = cookiePair.indexOf("=");

    if (separatorIndex === -1) {
        throw new Error("Session cookie did not contain a value.");
    }

    return cookiePair.slice(separatorIndex + 1);
}

tester.describe("auth API routes", () => {
    tester.beforeEach(async () => {
        await resetTestDatabase();
    });

    tester.it("registers a user without exposing the password hash", async () => {
        const { baseUrl, server, usersStore } = await createTestServer();

        try {
            const response = await registerUser(baseUrl);
            const body = (await response.json()) as ApiResponse<User>;

            tester.expect(response.status).toBe(201);
            tester.expect(body.ok).toBe(true);
            tester.expect(body.data?.email).toBe(TEST_EMAIL);
            tester.expect(body.data?.displayName).toBe(TEST_DISPLAY_NAME);
            tester.expect("passwordHash" in (body.data ?? {})).toBe(false);

            const storedUser = await usersStore.getUserByEmail(TEST_EMAIL);

            tester.expect(storedUser !== null).toBe(true);

            if (!storedUser) {
                throw new Error("Registered user was not saved.");
            }

            tester.expect(storedUser.passwordHash === TEST_PASSWORD).toBe(false);
            tester.expect(
                await verifyPassword(TEST_PASSWORD, storedUser.passwordHash),
            ).toBe(true);
        } finally {
            await closeServer(server);
        }
    });

    tester.it("normalizes email during registration", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            const response = await fetch(`${baseUrl}/api/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: "  HUGO@EXAMPLE.COM  ",
                    displayName: TEST_DISPLAY_NAME,
                    password: TEST_PASSWORD,
                }),
            });

            const body = (await response.json()) as ApiResponse<User>;

            tester.expect(response.status).toBe(201);
            tester.expect(body.data?.email).toBe(TEST_EMAIL);
        } finally {
            await closeServer(server);
        }
    });

    tester.it("rejects duplicate registration", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            await registerUser(baseUrl);
            const response = await registerUser(baseUrl);
            const body = (await response.json()) as ApiResponse<unknown>;

            tester.expect(response.status).toBe(409);
            tester.expect(body.ok).toBe(false);
            tester.expect(body.error).toBe(
                "An account with that email already exists.",
            );
        } finally {
            await closeServer(server);
        }
    });

    tester.it("rejects a registration password shorter than 15 characters", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            const response = await fetch(`${baseUrl}/api/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: TEST_EMAIL,
                    displayName: TEST_DISPLAY_NAME,
                    password: "too short",
                }),
            });

            const body = (await response.json()) as ApiResponse<unknown>;

            tester.expect(response.status).toBe(400);
            tester.expect(body.ok).toBe(false);
            tester.expect(body.error).toBe(
                "Valid email, display name, and password of 15 to 128 characters are required.",
            );
        } finally {
            await closeServer(server);
        }
    });

    tester.it("rejects malformed registration JSON", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            const response = await fetch(`${baseUrl}/api/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: "{not valid json",
            });

            tester.expect(response.status).toBe(400);
        } finally {
            await closeServer(server);
        }
    });

    tester.it("logs in with valid credentials without exposing the password hash", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            await registerUser(baseUrl);

            const response = await loginUser(baseUrl);
            const body = (await response.json()) as ApiResponse<User>;

            tester.expect(response.status).toBe(200);
            tester.expect(body.ok).toBe(true);
            tester.expect(body.data?.email).toBe(TEST_EMAIL);
            tester.expect("passwordHash" in (body.data ?? {})).toBe(false);
        } finally {
            await closeServer(server);
        }
    });

    tester.it("rejects login with the wrong password", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            await registerUser(baseUrl);

            const response = await fetch(`${baseUrl}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: TEST_EMAIL,
                    password: "This password is definitely wrong",
                }),
            });

            const body = (await response.json()) as ApiResponse<unknown>;

            tester.expect(response.status).toBe(401);
            tester.expect(body.error).toBe("Invalid email or password.");
        } finally {
            await closeServer(server);
        }
    });

    tester.it("uses the same login error for an unknown email", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            const response = await fetch(`${baseUrl}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: "missing@example.com",
                    password: TEST_PASSWORD,
                }),
            });

            const body = (await response.json()) as ApiResponse<unknown>;

            tester.expect(response.status).toBe(401);
            tester.expect(body.error).toBe("Invalid email or password.");
        } finally {
            await closeServer(server);
        }
    });

    tester.it("creates a server session and HttpOnly cookie after login", async () => {
        const { baseUrl, server, sessionsStore } = await createTestServer();

        try {
            await registerUser(baseUrl);
            const response = await loginUser(baseUrl);

            const setCookie = response.headers.get("set-cookie");

            tester.expect(typeof setCookie).toBe("string");

            if (!setCookie) {
                throw new Error("Login did not set a session cookie.");
            }

            tester.expect(setCookie.includes("HttpOnly")).toBe(true);
            tester.expect(setCookie.includes("SameSite=Lax")).toBe(true);

            const cookiePair = setCookie.split(";")[0] ?? "";
            const sessionToken = getSessionTokenFromCookiePair(cookiePair);
            const session = await sessionsStore.getSessionByTokenHash(
                hashSessionToken(sessionToken),
            );

            tester.expect(session !== null).toBe(true);
        } finally {
            await closeServer(server);
        }
    });

    tester.it(
        "adds Secure to session cookies when production cookie mode is enabled",
        async () => {
            const { baseUrl, server } = await createTestServer({
                secureCookies: true,
            });

            try {
                await registerUser(baseUrl);
                const response = await loginUser(baseUrl);
                const setCookie = response.headers.get("set-cookie");

                tester.expect(typeof setCookie).toBe("string");
                tester.expect(setCookie?.includes("Secure")).toBe(true);
            } finally {
                await closeServer(server);
            }
        },
    );

    tester.it("returns the authenticated current user", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            await registerUser(baseUrl);
            const loginResponse = await loginUser(baseUrl);
            const cookiePair = getCookiePair(loginResponse);

            const response = await fetch(`${baseUrl}/api/auth/me`, {
                headers: {
                    Cookie: cookiePair,
                },
            });

            const body = (await response.json()) as ApiResponse<User>;

            tester.expect(response.status).toBe(200);
            tester.expect(body.ok).toBe(true);
            tester.expect(body.data?.email).toBe(TEST_EMAIL);
            tester.expect(body.data?.displayName).toBe(TEST_DISPLAY_NAME);
            tester.expect("passwordHash" in (body.data ?? {})).toBe(false);
        } finally {
            await closeServer(server);
        }
    });

    tester.it("rejects a current-user request without a session", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            const response = await fetch(`${baseUrl}/api/auth/me`);
            const body = (await response.json()) as ApiResponse<unknown>;

            tester.expect(response.status).toBe(401);
            tester.expect(body.ok).toBe(false);
            tester.expect(body.error).toBe("Authentication required.");
        } finally {
            await closeServer(server);
        }
    });

    tester.it("rejects an invalid session", async () => {
        const { baseUrl, server } = await createTestServer();

        try {
            const response = await fetch(`${baseUrl}/api/auth/me`, {
                headers: {
                    Cookie: `session=${"a".repeat(64)}`,
                },
            });

            const body = (await response.json()) as ApiResponse<unknown>;

            tester.expect(response.status).toBe(401);
            tester.expect(body.error).toBe("Authentication required.");
        } finally {
            await closeServer(server);
        }
    });

    tester.it("logs out and deletes the server session", async () => {
        const { baseUrl, server, sessionsStore } = await createTestServer();

        try {
            await registerUser(baseUrl);
            const loginResponse = await loginUser(baseUrl);
            const cookiePair = getCookiePair(loginResponse);
            const sessionToken = getSessionTokenFromCookiePair(cookiePair);
            const tokenHash = hashSessionToken(sessionToken);

            const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
                method: "POST",
                headers: {
                    Cookie: cookiePair,
                },
            });

            tester.expect(logoutResponse.status).toBe(200);
            tester.expect(
                logoutResponse.headers.get("set-cookie")?.includes("Max-Age=0"),
            ).toBe(true);

            const session = await sessionsStore.getSessionByTokenHash(tokenHash);
            tester.expect(session).toBe(null);
        } finally {
            await closeServer(server);
        }
    });
});