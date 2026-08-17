import type { SessionProvider } from "@hugovela/frontend-core";
import type {
  LoginInput,
  RegisterUserInput,
  User,
} from "../types.js";
import {
  API_BASE_URL,
  apiFetch,
  parseApiResponse,
  parseApiSuccess,
} from "./api-client.js";

export type AuthApi = SessionProvider;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function registerUser(
  input: RegisterUserInput,
): Promise<User> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/auth/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        email: normalizeEmail(input.email),
        displayName: input.displayName.trim(),
      }),
      notifyOnUnauthorized: false,
    },
  );

  return parseApiResponse<User>(response);
}

export async function login(
  input: LoginInput,
): Promise<User> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizeEmail(input.email),
        password: input.password,
      }),
      notifyOnUnauthorized: false,
    },
  );

  return parseApiResponse<User>(response);
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/auth/me`,
    {
      notifyOnUnauthorized: false,
    },
  );

  return parseApiResponse<User>(response);
}

export async function logout(): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/auth/logout`,
    {
      method: "POST",
      notifyOnUnauthorized: false,
    },
  );

  await parseApiSuccess(response);
}

export const authApi: AuthApi = {
  registerUser,
  login,
  logout,
  getCurrentUser,
};
