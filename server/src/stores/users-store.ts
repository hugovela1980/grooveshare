import type {
  CreateUserInput,
  StoredUser,
} from "../auth/types.js";

export type UsersStore = {
  createUser: (
    userInput: CreateUserInput,
  ) => Promise<StoredUser>;

  getUserByEmail: (
    email: string,
  ) => Promise<StoredUser | null>;

  getUserById: (
    userId: string,
  ) => Promise<StoredUser | null>;
};