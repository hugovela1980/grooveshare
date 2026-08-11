import type {
    IncomingMessage,
    ServerResponse,
} from "node:http";

import type { UsersStore } from "../stores/users-store.js";
import {
    hashPassword,
    verifyPassword,
} from "./password.js";

import type {
    StoredUser,
    User,
} from "./types.js";

import type { SessionsStore } from "../stores/sessions-store.js";
import {
    createClearedSessionCookie,
    createSessionCookie,
    createSessionToken,
    getSessionToken,
    hashSessionToken,
    SESSION_DURATION_MS,
} from "./session.js";

type JsonResponse =
    Record<string, unknown>;

type SendJson = (
    res: ServerResponse,
    statusCode: number,
    body: JsonResponse,
    clientOrigin: string,
) => void;

type AuthRouteOptions = {
    req: IncomingMessage;
    res: ServerResponse;
    sendJson: SendJson;
    clientOrigin: string;
    usersStore: UsersStore;
};

type AuthSessionRouteOptions =
    AuthRouteOptions & {
        sessionsStore: SessionsStore;
    };

type RegisterInput = {
    email: string;
    displayName: string;
    password: string;
};

type LoginInput = {
    email: string;
    password: string;
};

const EMAIL_PATTERN =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 15;
const MAX_PASSWORD_LENGTH = 128;

function normalizeEmail(
    email: string,
): string {
    return email.trim().toLowerCase();
}

function passwordLength(
    password: string,
): number {
    return Array.from(password).length;
}

function isValidEmail(
    email: string,
): boolean {
    return EMAIL_PATTERN.test(
        normalizeEmail(email),
    );
}

function isRegisterInput(
    data: unknown,
): data is RegisterInput {
    if (!data || typeof data !== "object") {
        return false;
    }

    const input =
        data as Record<string, unknown>;

    if (
        typeof input.email !== "string" ||
        typeof input.displayName !== "string" ||
        typeof input.password !== "string"
    ) {
        return false;
    }

    const length =
        passwordLength(input.password);

    return (
        isValidEmail(input.email) &&
        input.displayName.trim().length > 0 &&
        length >= MIN_PASSWORD_LENGTH &&
        length <= MAX_PASSWORD_LENGTH
    );
}

function isLoginInput(
    data: unknown,
): data is LoginInput {
    if (!data || typeof data !== "object") {
        return false;
    }

    const input =
        data as Record<string, unknown>;

    if (
        typeof input.email !== "string" ||
        typeof input.password !== "string"
    ) {
        return false;
    }

    const length =
        passwordLength(input.password);

    return (
        isValidEmail(input.email) &&
        length > 0 &&
        length <= MAX_PASSWORD_LENGTH
    );
}

function toPublicUser(
    storedUser: StoredUser,
): User {
    return {
        id: storedUser.id,
        email: storedUser.email,
        displayName: storedUser.displayName,
        createdAt: storedUser.createdAt,
        updatedAt: storedUser.updatedAt,
    };
}

async function readRequestBody(
    req: IncomingMessage,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        req.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
        });

        req.on("end", () => {
            resolve(
                Buffer.concat(chunks).toString(
                    "utf-8",
                ),
            );
        });

        req.on("error", () => {
            reject(
                new Error(
                    "Could not read request body.",
                ),
            );
        });
    });
}

async function readJsonBody(
    req: IncomingMessage,
): Promise<unknown | null> {
    const body =
        await readRequestBody(req);

    try {
        return JSON.parse(body) as unknown;
    } catch {
        return null;
    }
}

export async function handleRegisterRoute({
    req,
    res,
    sendJson,
    clientOrigin,
    usersStore,
}: AuthRouteOptions): Promise<void> {
    const parsedBody =
        await readJsonBody(req);

    if (!isRegisterInput(parsedBody)) {
        sendJson(
            res,
            400,
            {
                ok: false,
                error:
                    "Valid email, display name, and password of 15 to 128 characters are required.",
            },
            clientOrigin,
        );

        return;
    }

    const email =
        normalizeEmail(parsedBody.email);

    const existingUser =
        await usersStore.getUserByEmail(email);

    if (existingUser) {
        sendJson(
            res,
            409,
            {
                ok: false,
                error:
                    "An account with that email already exists.",
            },
            clientOrigin,
        );

        return;
    }

    const passwordHash =
        await hashPassword(
            parsedBody.password,
        );

    const storedUser =
        await usersStore.createUser({
            email,
            displayName:
                parsedBody.displayName.trim(),
            passwordHash,
        });

    sendJson(
        res,
        201,
        {
            ok: true,
            data: toPublicUser(storedUser),
        },
        clientOrigin,
    );
}

export async function handleLoginRoute({
    req,
    res,
    sendJson,
    clientOrigin,
    usersStore,
    sessionsStore,
}: AuthSessionRouteOptions): Promise<void> {
    const parsedBody =
        await readJsonBody(req);

    if (!isLoginInput(parsedBody)) {
        sendJson(
            res,
            400,
            {
                ok: false,
                error:
                    "Valid email and password are required.",
            },
            clientOrigin,
        );

        return;
    }

    const storedUser =
        await usersStore.getUserByEmail(
            parsedBody.email,
        );

    if (!storedUser) {
        sendJson(
            res,
            401,
            {
                ok: false,
                error:
                    "Invalid email or password.",
            },
            clientOrigin,
        );

        return;
    }

    const passwordIsValid =
        await verifyPassword(
            parsedBody.password,
            storedUser.passwordHash,
        );

    if (!passwordIsValid) {
        sendJson(
            res,
            401,
            {
                ok: false,
                error:
                    "Invalid email or password.",
            },
            clientOrigin,
        );

        return;
    }

    const sessionToken =
        createSessionToken();

    const tokenHash =
        hashSessionToken(sessionToken);

    const expiresAt =
        new Date(
            Date.now() +
            SESSION_DURATION_MS,
        ).toISOString();

    await sessionsStore.createSession({
        userId: storedUser.id,
        tokenHash,
        expiresAt,
    });

    const secureCookie =
        process.env.NODE_ENV ===
        "production";

    res.setHeader(
        "Set-Cookie",
        createSessionCookie(
            sessionToken,
            secureCookie,
        ),
    );

    res.setHeader(
        "Cache-Control",
        "no-store",
    );

    sendJson(
        res,
        200,
        {
            ok: true,
            data: toPublicUser(storedUser),
        },
        clientOrigin,
    );
}

export async function handleLogoutRoute({
    req,
    res,
    sendJson,
    clientOrigin,
    usersStore: _usersStore,
    sessionsStore,
}: AuthSessionRouteOptions): Promise<void> {
    const sessionToken =
        getSessionToken(req);

    if (sessionToken) {
        await sessionsStore
            .deleteSessionByTokenHash(
                hashSessionToken(
                    sessionToken,
                ),
            );
    }

    const secureCookie =
        process.env.NODE_ENV ===
        "production";

    res.setHeader(
        "Set-Cookie",
        createClearedSessionCookie(
            secureCookie,
        ),
    );

    res.setHeader(
        "Cache-Control",
        "no-store",
    );

    sendJson(
        res,
        200,
        {
            ok: true,
        },
        clientOrigin,
    );
}