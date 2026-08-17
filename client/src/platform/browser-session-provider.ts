import type { SessionProvider } from "@hugovela/frontend-core";
import { authApi, type AuthApi } from "../api/auth-api.js";

/**
 * Adapts the current browser/cookie-backed auth API to the shared session
 * contract. Checkpoint 2 will make the app composition root consume this
 * provider directly.
 */
export function createBrowserSessionProvider(
  authenticationApi: AuthApi = authApi,
): SessionProvider {
  return {
    registerUser(input) {
      return authenticationApi.registerUser(input);
    },
    login(input) {
      return authenticationApi.login(input);
    },
    logout() {
      return authenticationApi.logout();
    },
    getCurrentUser() {
      return authenticationApi.getCurrentUser();
    },
  };
}

export const browserSessionProvider = createBrowserSessionProvider();
