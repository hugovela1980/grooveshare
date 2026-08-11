import type {
    CreateUserInput,
    StoredUser,
} from "../../src/auth/types.js";
import type { UsersStore } from "../../src/stores/users-store.js";

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function createTestUsersStore(): UsersStore {
    const users: StoredUser[] = [];

    async function createUser(
        userInput: CreateUserInput,
    ): Promise<StoredUser> {
        const now = new Date().toISOString();

        const user: StoredUser = {
            id: crypto.randomUUID(),
            email: normalizeEmail(userInput.email),
            displayName: userInput.displayName,
            passwordHash: userInput.passwordHash,
            createdAt: now,
            updatedAt: now,
        };

        users.push(user);

        return user;
    }

    async function getUserByEmail(
        email: string,
    ): Promise<StoredUser | null> {
        const normalizedEmail =
            normalizeEmail(email);

        return (
            users.find((user) => {
                return user.email === normalizedEmail;
            }) ?? null
        );
    }

    async function getUserById(
        userId: string,
    ): Promise<StoredUser | null> {
        return (
            users.find((user) => {
                return user.id === userId;
            }) ?? null
        );
    }

    return {
        createUser,
        getUserByEmail,
        getUserById,
    };
}