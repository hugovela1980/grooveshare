import type { IncomingMessage } from "node:http";
import type { SessionsStore } from "../stores/sessions-store.js";
import type { UsersStore } from "../stores/users-store.js";
import type { User } from "./types.js";
import {
    getSessionToken,
    hashSessionToken,
} from "./session.js";
import { toPublicUser } from "./user.js";

type AuthenticationOptions = {
    req: IncomingMessage;
    usersStore: UsersStore;
    sessionsStore: SessionsStore;
};

export async function getAuthenticatedUser({
    req,
    usersStore,
    sessionsStore,
}: AuthenticationOptions): Promise<User | null> {
    const sessionToken =
        getSessionToken(req);

    if (!sessionToken) {
        return null;
    }

    const tokenHash =
        hashSessionToken(sessionToken);

    const session =
        await sessionsStore.getSessionByTokenHash(
            tokenHash,
        );

    if (!session) {
        return null;
    }

    const storedUser =
        await usersStore.getUserById(
            session.userId,
        );

    if (!storedUser) {
        return null;
    }

    return toPublicUser(storedUser);
}