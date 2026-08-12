import {
  getCurrentUser,
  login,
  logout,
  registerUser,
} from "../src/api/auth-api.js";
import type { User } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

type FetchCall = {
  input: Parameters<typeof fetch>[0];
  init: Parameters<typeof fetch>[1];
};

const user: User = {
  id: "user-1",
  email: "musician@example.com",
  displayName: "Musician",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createJsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

tester.describe("auth API", () => {
  tester.it("registers a user with normalized account details and credentials enabled", async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: FetchCall[] = [];

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });

      return createJsonResponse({
        ok: true,
        data: user,
      }, 201);
    }) as typeof fetch;

    try {
      const result = await registerUser({
        email: "  MUSICIAN@EXAMPLE.COM ",
        displayName: "  Musician  ",
        password: "a sufficiently long password",
      });

      tester.expect(result).toEqual(user);
      tester.expect(fetchCalls.length).toBe(1);

      const call = fetchCalls[0];

      if (!call) {
        throw new Error("Expected fetch to be called.");
      }

      tester.expect(String(call.input)).toBe(
        "http://localhost:3000/api/auth/register",
      );
      tester.expect(call.init).toEqual({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "musician@example.com",
          displayName: "Musician",
          password: "a sufficiently long password",
        }),
        credentials: "include",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("logs in and includes session credentials", async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: FetchCall[] = [];

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });

      return createJsonResponse({
        ok: true,
        data: user,
      });
    }) as typeof fetch;

    try {
      const result = await login({
        email: "MUSICIAN@EXAMPLE.COM",
        password: "a sufficiently long password",
      });

      tester.expect(result).toEqual(user);
      const call = fetchCalls[0];

      if (!call) {
        throw new Error("Expected fetch to be called.");
      }

      tester.expect(String(call.input)).toBe(
        "http://localhost:3000/api/auth/login",
      );
      tester.expect(call.init).toEqual({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "musician@example.com",
          password: "a sufficiently long password",
        }),
        credentials: "include",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("checks the current authenticated user without treating 401 as session expiration", async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: FetchCall[] = [];

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });

      return createJsonResponse({
        ok: true,
        data: user,
      });
    }) as typeof fetch;

    try {
      const result = await getCurrentUser();

      tester.expect(result).toEqual(user);
      const call = fetchCalls[0];

      if (!call) {
        throw new Error("Expected fetch to be called.");
      }

      tester.expect(String(call.input)).toBe(
        "http://localhost:3000/api/auth/me",
      );
      tester.expect(call.init).toEqual({
        credentials: "include",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("logs out through the server session route", async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: FetchCall[] = [];

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });

      return createJsonResponse({ ok: true });
    }) as typeof fetch;

    try {
      await logout();

      const call = fetchCalls[0];

      if (!call) {
        throw new Error("Expected fetch to be called.");
      }

      tester.expect(String(call.input)).toBe(
        "http://localhost:3000/api/auth/logout",
      );
      tester.expect(call.init).toEqual({
        method: "POST",
        credentials: "include",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
