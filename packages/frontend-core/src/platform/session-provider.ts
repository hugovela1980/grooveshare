import type {
  LoginInput,
  RegisterUserInput,
  User,
} from "../domain/types.js";

/**
 * Platform-facing authentication/session contract.
 *
 * Version 2 still uses the browser's cookie-backed API implementation. The
 * purpose of this interface is to keep application code from depending on the
 * mechanism that maintains the session.
 */
export interface SessionProvider {
  registerUser(input: RegisterUserInput): Promise<User>;
  login(input: LoginInput): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User>;
}
