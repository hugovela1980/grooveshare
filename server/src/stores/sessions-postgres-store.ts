import type { Pool } from "pg";
import type {
    CreateSessionInput,
    Session,
} from "../auth/types.js";
import type { SessionsStore } from "./sessions-store.js";

type SessionRow = {
    id: string;
    user_id: string;
    token_hash: string;
    created_at: Date;
    expires_at: Date;
};

function sessionRowToSession(
    row: SessionRow,
): Session {
    return {
        id: row.id,
        userId: row.user_id,
        tokenHash: row.token_hash,
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
    };
}

export function createSessionsPostgresStore(
    pool: Pool,
): SessionsStore {
    async function createSession(
        sessionInput: CreateSessionInput,
    ): Promise<Session> {
        const sessionId =
            crypto.randomUUID();

        const result =
            await pool.query<SessionRow>(
                `
          INSERT INTO sessions (
            id,
            user_id,
            token_hash,
            expires_at
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            user_id,
            token_hash,
            created_at,
            expires_at
        `,
                [
                    sessionId,
                    sessionInput.userId,
                    sessionInput.tokenHash,
                    sessionInput.expiresAt,
                ],
            );

        const row = result.rows[0];

        if (!row) {
            throw new Error(
                "PostgreSQL did not return the created session.",
            );
        }

        return sessionRowToSession(row);
    }

    async function getSessionByTokenHash(
        tokenHash: string,
    ): Promise<Session | null> {
        const result =
            await pool.query<SessionRow>(
                `
          SELECT
            id,
            user_id,
            token_hash,
            created_at,
            expires_at
          FROM sessions
          WHERE token_hash = $1
            AND expires_at > NOW()
        `,
                [tokenHash],
            );

        const row = result.rows[0];

        return row
            ? sessionRowToSession(row)
            : null;
    }

    async function deleteSessionByTokenHash(
        tokenHash: string,
    ): Promise<boolean> {
        const result =
            await pool.query(
                `
          DELETE FROM sessions
          WHERE token_hash = $1
        `,
                [tokenHash],
            );

        return (
            result.rowCount !== null &&
            result.rowCount > 0
        );
    }

    return {
        createSession,
        getSessionByTokenHash,
        deleteSessionByTokenHash,
    };
}