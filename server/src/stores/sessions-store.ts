import type {
    CreateSessionInput,
    Session,
} from "../auth/types.js";

export type SessionsStore = {
    createSession: (
        sessionInput: CreateSessionInput,
    ) => Promise<Session>;

    getSessionByTokenHash: (
        tokenHash: string,
    ) => Promise<Session | null>;

    deleteSessionByTokenHash: (
        tokenHash: string,
    ) => Promise<boolean>;
};