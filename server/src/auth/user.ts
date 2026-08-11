import type {
    StoredUser,
    User,
} from "./types.js";

export function toPublicUser(
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