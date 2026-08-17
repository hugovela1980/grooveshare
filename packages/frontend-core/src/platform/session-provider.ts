export type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type RegisterUserInput = {
  email: string;
  displayName: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

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
