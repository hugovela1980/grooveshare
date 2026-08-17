import type {
  LoginInput,
  RegisterUserInput,
  User,
} from "@hugovela/frontend-core";
import type { AuthApi } from "../src/api/auth-api.js";
import {
  createBrowserSessionProvider,
} from "../src/platform/browser-session-provider.js";
import {
  createBrowserStorageProvider,
} from "../src/platform/browser-storage-provider.js";
import { tester } from "./test-runner/tester.js";

const user: User = {
  id: "user-1",
  email: "musician@example.com",
  displayName: "Musician",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

tester.describe("Browser platform adapters", () => {
  tester.it("delegates session operations to the current browser auth API", async () => {
    const calls: string[] = [];

    const authenticationApi: AuthApi = {
      async registerUser(input: RegisterUserInput) {
        calls.push(`register:${input.email}`);
        return user;
      },
      async login(input: LoginInput) {
        calls.push(`login:${input.email}`);
        return user;
      },
      async logout() {
        calls.push("logout");
      },
      async getCurrentUser() {
        calls.push("current-user");
        return user;
      },
    };

    const provider = createBrowserSessionProvider(authenticationApi);

    await provider.registerUser({
      email: "new@example.com",
      displayName: "New User",
      password: "password123",
    });
    await provider.login({
      email: "musician@example.com",
      password: "password123",
    });
    await provider.getCurrentUser();
    await provider.logout();

    tester.expect(calls).toEqual([
      "register:new@example.com",
      "login:musician@example.com",
      "current-user",
      "logout",
    ]);
  });

  tester.it("adapts browser-style key/value storage to StorageProvider", () => {
    const values = new Map<string, string>();
    const browserStorage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
    };

    const provider = createBrowserStorageProvider(browserStorage);

    provider.setItem("mix", "saved");
    tester.expect(provider.getItem("mix")).toBe("saved");

    provider.removeItem("mix");
    tester.expect(provider.getItem("mix")).toBe(null);
  });
});
