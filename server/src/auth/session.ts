import {
    createHash,
    randomBytes,
} from "node:crypto";
import type { IncomingMessage } from "node:http";

export const SESSION_COOKIE_NAME =
    "session";

export const SESSION_DURATION_MS =
    7 * 24 * 60 * 60 * 1000;

const SESSION_TOKEN_BYTES = 32;

const SESSION_TOKEN_PATTERN =
    /^[a-f0-9]{64}$/;

export function createSessionToken(): string {
    return randomBytes(
        SESSION_TOKEN_BYTES,
    ).toString("hex");
}

export function hashSessionToken(
    sessionToken: string,
): string {
    return createHash("sha256")
        .update(sessionToken)
        .digest("hex");
}

export function getSessionToken(
    req: IncomingMessage,
): string | null {
    const cookieHeader =
        req.headers.cookie;

    if (!cookieHeader) {
        return null;
    }

    for (
        const cookie of cookieHeader.split(";")
    ) {
        const separatorIndex =
            cookie.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const name =
            cookie
                .slice(0, separatorIndex)
                .trim();

        if (name !== SESSION_COOKIE_NAME) {
            continue;
        }

        const value =
            cookie
                .slice(separatorIndex + 1)
                .trim();

        return SESSION_TOKEN_PATTERN.test(
            value,
        )
            ? value
            : null;
    }

    return null;
}

export function createSessionCookie(
    sessionToken: string,
    secure: boolean,
): string {
    const attributes = [
        `${SESSION_COOKIE_NAME}=${sessionToken}`,
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
    ];

    if (secure) {
        attributes.push("Secure");
    }

    return attributes.join("; ");
}

export function createClearedSessionCookie(
    secure: boolean,
): string {
    const attributes = [
        `${SESSION_COOKIE_NAME}=`,
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=0",
    ];

    if (secure) {
        attributes.push("Secure");
    }

    return attributes.join("; ");
}