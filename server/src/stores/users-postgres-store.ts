import type { Pool } from "pg";
import type {
  CreateUserInput,
  StoredUser,
} from "../auth/types.js";
import type { UsersStore } from "./users-store.js";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
};

function userRowToStoredUser(
  row: UserRow,
): StoredUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createUsersPostgresStore(
  pool: Pool,
): UsersStore {
  async function createUser(
    userInput: CreateUserInput,
  ): Promise<StoredUser> {
    const userId = crypto.randomUUID();

    const result =
      await pool.query<UserRow>(
        `
          INSERT INTO users (
            id,
            email,
            display_name,
            password_hash
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            email,
            display_name,
            password_hash,
            created_at,
            updated_at
        `,
        [
          userId,
          normalizeEmail(userInput.email),
          userInput.displayName,
          userInput.passwordHash,
        ],
      );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "PostgreSQL did not return the created user.",
      );
    }

    return userRowToStoredUser(row);
  }

  async function getUserByEmail(
    email: string,
  ): Promise<StoredUser | null> {
    const result =
      await pool.query<UserRow>(
        `
          SELECT
            id,
            email,
            display_name,
            password_hash,
            created_at,
            updated_at
          FROM users
          WHERE email = $1
        `,
        [normalizeEmail(email)],
      );

    const row = result.rows[0];

    return row
      ? userRowToStoredUser(row)
      : null;
  }

  async function getUserById(
    userId: string,
  ): Promise<StoredUser | null> {
    const result =
      await pool.query<UserRow>(
        `
          SELECT
            id,
            email,
            display_name,
            password_hash,
            created_at,
            updated_at
          FROM users
          WHERE id = $1
        `,
        [userId],
      );

    const row = result.rows[0];

    return row
      ? userRowToStoredUser(row)
      : null;
  }

  return {
    createUser,
    getUserByEmail,
    getUserById,
  };
}