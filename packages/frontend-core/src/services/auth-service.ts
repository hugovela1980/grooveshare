import type {
  LoginInput,
  RegisterUserInput,
  User,
} from "../domain/types.js";
import type { SessionProvider } from "../platform/session-provider.js";
import {
  parseApiResponse,
  parseApiSuccess,
  type ApiTransport,
} from "./api-transport.js";

export interface AuthService extends SessionProvider {}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createAuthService(input: {
  apiBaseUrl: string;
  transport: ApiTransport;
}): AuthService {
  const { apiBaseUrl, transport } = input;

  return {
    async registerUser(userInput: RegisterUserInput): Promise<User> {
      const response = await transport.request(
        `${apiBaseUrl}/api/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...userInput,
            email: normalizeEmail(userInput.email),
            displayName: userInput.displayName.trim(),
          }),
          notifyOnUnauthorized: false,
        },
      );

      return parseApiResponse<User>(response);
    },

    async login(loginInput: LoginInput): Promise<User> {
      const response = await transport.request(
        `${apiBaseUrl}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizeEmail(loginInput.email),
            password: loginInput.password,
          }),
          notifyOnUnauthorized: false,
        },
      );

      return parseApiResponse<User>(response);
    },

    async getCurrentUser(): Promise<User> {
      const response = await transport.request(
        `${apiBaseUrl}/api/auth/me`,
        { notifyOnUnauthorized: false },
      );

      return parseApiResponse<User>(response);
    },

    async logout(): Promise<void> {
      const response = await transport.request(
        `${apiBaseUrl}/api/auth/logout`,
        {
          method: "POST",
          notifyOnUnauthorized: false,
        },
      );

      await parseApiSuccess(response);
    },
  };
}
